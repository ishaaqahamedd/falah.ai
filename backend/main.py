from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
from google import genai
from google.genai import types
import os
import logging
import traceback
from dotenv import load_dotenv

load_dotenv()

from app.core.config import settings
from app.features.auth.router import router as auth_router
from app.features.livekit.router import router as livekit_router
from app.features.personas.router import router as personas_router
from app.features.context.router import router as context_router
from app.features.sessions.router import router as sessions_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.ENVIRONMENT == "production" else logging.DEBUG,
    format="%(asctime)s %(name)s %(levelname)s %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS — driven by CORS_ORIGINS env var
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(livekit_router)
app.include_router(personas_router)
app.include_router(context_router)
app.include_router(sessions_router)

api_key = os.environ.get("GOOGLE_API_KEY")
if not api_key or api_key == "PASTE_YOUR_GEMINI_API_KEY_HERE":
    logger.critical("Please add your real Gemini API Key to backend/.env")

# Initialize the GenAI Client
client = genai.Client()

MOCK_CRM_DATA = {
    "investor_1": "Target: Tier 1 VC. Known to be strict, hates buzzwords, cares deeply about ARR growth and capital efficiency.",
    "client_1": "Target: Enterprise CTO. Highly technical, extremely concerned about SOC2 compliance, data privacy, and SLA guarantees."
}

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Live Pitch AI Backend is running. Connect via WebSocket at /ws/pitch/{persona_id}"}

@app.websocket("/ws/pitch/{persona_id}")
async def pitch_websocket(websocket: WebSocket, persona_id: str):
    await websocket.accept()
    
    # 1. Wait for Critical Setup Handshake
    try:
        setup_data = await websocket.receive_json()
        dynamic_transcript = setup_data.get("transcript", "")[:settings.MAX_CRM_CHARS]
    except Exception as e:
        logger.error(f"Handshake failed: {e}")
        await websocket.close(code=1008)
        return

    # 2. Formulate the Context
    base_persona_context = MOCK_CRM_DATA.get(persona_id, "Unknown Persona. Treat as a general friendly pitch.")
    system_instruction = f"""
    You are roleplaying as the following target persona during a live sales pitch:
    {base_persona_context}
    
    Here are the notes/transcript from previous interactions with this user:
    {dynamic_transcript}
    
    Respond verbally to their pitch. Be realistic. If they miss key things you care about, object to it.
    Keep your responses short, punchy, and conversational.
    
    CRITICAL VISION RULES:
    1. The user will be sharing their screen. You MUST acknowledge what you see on their presentation slides or screen share material.
    2. Try to ask questions specifically related to the content visible on their screen.
    3. If the slides change or they switch to a new screen, react to it naturally in conversation.
    
    IMPORTANT: You must DRIVE the conversation. Start by warmly greeting the user and asking them to present their pitch. If the user is silent, ask a follow-up question. Do not just wait for them.
    """

    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=types.Content(parts=[types.Part.from_text(text=system_instruction)]),
        context_window_compression=types.ContextWindowCompressionConfig(
            trigger_tokens=settings.CONTEXT_TRIGGER_TOKENS,
            sliding_window=types.SlidingWindow(
                target_tokens=settings.CONTEXT_TARGET_TOKENS,
            ),
        ),
    )
    
    logger.info(f"Connecting to Gemini Live for Persona: {persona_id}")
    
    try:
        # Establish Live API Connection
        async with client.aio.live.connect(model="gemini-2.5-flash-native-audio-preview-12-2025", config=config) as session:
            logger.info("Connected! Sending initial greeting trigger...")
            # Force the AI to speak first
            await session.send_realtime_input(text="[System]: The user has joined. Please greet them now to start the pitch.")
            
            async def receive_from_client():
                _last_video_sent = 0.0
                try:
                    while True:
                        data = await websocket.receive_json()
                        if "audio" in data:
                            # Forward PCM payload to Gemini
                            base64_audio = data["audio"]
                            raw_bytes = __import__('base64').b64decode(base64_audio)
                            try:
                                await session.send_realtime_input(
                                    audio=types.Blob(data=raw_bytes, mime_type="audio/pcm;rate=16000")
                                )
                            except Exception as e:
                                logger.error(f"Failed to send to Gemini: {e}")
                                break
                        elif "video" in data:
                            # Throttle video frames to reduce context growth
                            import time as _time
                            now = _time.monotonic()
                            if now - _last_video_sent < settings.VIDEO_INTERVAL_DIRECT:
                                continue
                            _last_video_sent = now
                            # Forward Video Canvas frame to Gemini
                            base64_video = data["video"]
                            raw_bytes = __import__('base64').b64decode(base64_video)
                            try:
                                await session.send_realtime_input(
                                    video=types.Blob(data=raw_bytes, mime_type="image/jpeg")
                                )
                            except Exception as e:
                                logger.error(f"Failed to send video to Gemini: {e}")
                                break
                except WebSocketDisconnect:
                    logger.info("Client disconnected.")
                except Exception as e:
                    logger.error(f"Error receiving from client: {e}\n{traceback.format_exc()}")
                    
            async def receive_from_gemini():
                try:
                    while True: # Safe-guard in case receive() yields only one turn
                        async for response in session.receive():
                            server_content = response.server_content
                            if server_content is not None:
                                # Handle AI Interruptions
                                if server_content.interrupted:
                                    await websocket.send_json({"interrupted": True})
                                    logger.debug("Interrupted!")
                                    
                                # Handle Incoming Audio
                                if server_content.model_turn is not None:
                                    for part in server_content.model_turn.parts:
                                        if part.inline_data:
                                            # Convert bytes to base64
                                            encoded_audio = __import__('base64').b64encode(part.inline_data.data).decode("utf-8")
                                            await websocket.send_json({"audio": encoded_audio})
                        logger.debug("Gemini session.receive() yield exhausted. Restarting loop...")
                        await asyncio.sleep(0.1)
                except Exception as e:
                    logger.error(f"Error receiving from Gemini: {e}\n{traceback.format_exc()}")
                finally:
                    pass # Don't aggressively close UI websocket here, let it live

            # Run loops concurrently using TaskGroup for safe cancellation
            try:
                async with asyncio.TaskGroup() as tg:
                    tg.create_task(receive_from_client())
                    tg.create_task(receive_from_gemini())
            except Exception as e:
                logger.info(f"TaskGroup exited: {e}")
            
    except Exception as e:
        logger.error(f"Gemini connection failed: {e}")
        await websocket.close(code=1011)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
    
