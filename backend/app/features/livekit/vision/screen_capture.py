import asyncio
import base64
import io
import time
import logging
from PIL import Image
from livekit import rtc

logger = logging.getLogger("vision-pipeline")

async def stream_screen_to_gemini(room: rtc.Room, gemini_session, fps: float = 0.3):
    """
    Subscribes to all screen-share tracks and pushes frames to Gemini's Live API.
    This bypasses the livekit-plugins-google missing VideoFrame handler by manually
    calling `send_realtime_input` on the underlying Gemini session.
    """
    interval = 1.0 / fps
    active_tasks = {}

    async def capture_track(track: rtc.RemoteVideoTrack):
        stream = rtc.VideoStream(track)
        last_sent = 0
        logger.info(f"[Vision] Started capturing screen share track {track.sid}")
        
        try:
            async for frame_event in stream:
                now = time.monotonic()
                if now - last_sent < interval:
                    continue
                last_sent = now
                
                # Convert the raw rtc.VideoFrame (RGBA) to a JPEG base64 string
                frame = frame_event.frame
                # Width and height might be swapped depending on orientation, but PIL expects (w, h)
                img = Image.frombytes("RGBA", (frame.width, frame.height), frame.data)
                
                # Optimize to JPEG
                buf = io.BytesIO()
                img.convert("RGB").save(buf, format="JPEG", quality=75)
                b64_data = base64.b64encode(buf.getvalue()).decode("utf-8")
                
                # Push directly into the LiveKit RealtimeSession's internal event queue
                # using the proper Google GenAI types schema.
                from google.genai import types
                
                realtime_input = types.LiveClientRealtimeInput(
                    media_chunks=[
                        types.Blob(
                            mime_type="image/jpeg",
                            data=b64_data
                        )
                    ]
                )
                
                # Send it into the active internal session tunnel
                gemini_session._send_client_event(
                    types.LiveClientContent(
                        realtime_input=realtime_input
                    )
                )
                logger.debug("[Vision] Sent screen frame to Gemini")
        except asyncio.CancelledError:
            logger.info(f"[Vision] Stopped capturing screen share track {track.sid}")
        except Exception as e:
            logger.error(f"[Vision] Frame capture error: {e}", exc_info=True)

    @room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        if publication.source == rtc.TrackSource.SOURCE_SCREENSHARE and isinstance(track, rtc.RemoteVideoTrack):
            task = asyncio.create_task(capture_track(track))
            active_tasks[track.sid] = task

    @room.on("track_unsubscribed")
    def on_track_unsubscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        if track.sid in active_tasks:
            active_tasks[track.sid].cancel()
            del active_tasks[track.sid]

    logger.info("[Vision] Screen capture pipeline initialized and watching for tracks.")
