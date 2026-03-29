import asyncio
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()


async def main():
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=types.Content(
            parts=[types.Part(text="You are a helpful assistant.")]
        ),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
            )
        ),
    )
    print("Connecting...")
    try:
        async with client.aio.live.connect(
            model="gemini-3.1-flash-live-preview", config=config
        ) as session:
            print("Connected successfully!")
            await session.send_realtime_input(text="Hello")
            print("Message sent.")
            async for msg in session.receive():
                print("Received msg:", getattr(msg, "server_content", {}))
                break
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
