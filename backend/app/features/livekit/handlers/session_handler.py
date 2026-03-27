"""Regular practice session behaviors: transcript saving, heartbeat."""

import asyncio
import logging
import time

from livekit.agents import JobContext
from livekit.agents.voice import AgentSession

from app.features.livekit.db_helpers import save_session_to_db, update_session_in_db

logger = logging.getLogger("persona-agent")


async def setup_session(
    ctx: JobContext,
    session: AgentSession,
    recorder: "TranscriptRecorder",
    start_time: float,
    meta: dict,
):
    """Wire up regular practice session behaviors after the session has started.

    This includes:
    - Shutdown callback to save transcript and trigger scoring
    - Periodic heartbeat logger
    """
    user_id = meta.get("user_id", "")
    session_id = meta.get("session_id", "")
    persona_id = meta.get("persona_id", "investor_1")
    persona_config = meta.get("persona_config", None)

    # --- Shutdown callback: save transcript ---
    async def on_shutdown(reason: str):
        logger.info(f"[Agent] Shutdown triggered: {reason}")
        heartbeat_task.cancel()
        transcript = recorder.get_transcript()
        duration = int(time.time() - start_time)
        logger.info(f"[Agent] Captured {len(transcript)} turns over {duration}s. Saving...")

        if len(transcript) < 1:
            logger.warning("[Agent] Skipping save: no transcript turns captured")
        elif session_id:
            await update_session_in_db(
                session_id=session_id,
                transcript=transcript,
                duration_seconds=duration,
            )
        elif user_id:
            persona_snapshot = persona_config or {"persona_id": persona_id}
            await save_session_to_db(
                user_id=user_id,
                persona_id=persona_id,
                persona_snapshot=persona_snapshot,
                transcript=transcript,
                duration_seconds=duration,
            )
        else:
            logger.warning("[Agent] Skipping save: no session_id or user_id")

    ctx.add_shutdown_callback(on_shutdown)

    # --- Heartbeat ---
    async def _heartbeat():
        while True:
            await asyncio.sleep(60)
            elapsed = int(time.time() - start_time)
            turns = len(recorder.get_transcript())
            logger.info(f"[Agent] Heartbeat: {elapsed // 60}m elapsed, {turns} transcript turns captured")

    heartbeat_task = asyncio.create_task(_heartbeat())
