"""Regular practice session behaviors: transcript saving, heartbeat."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import TYPE_CHECKING

from livekit.agents import JobContext
from livekit.agents.voice import AgentSession

from app.features.livekit.repository import LivekitRepository

if TYPE_CHECKING:
    from app.features.livekit.agent import TranscriptRecorder

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
        logger.info(
            f"[Agent] Captured {len(transcript)} turns over {duration}s. Saving..."
        )

        artifacts = session.userdata.get("artifacts", [])
        logger.info(f"[Agent] Canvas artifacts captured: {len(artifacts)}")

        if len(transcript) < 1:
            logger.warning("[Agent] Skipping save: no transcript turns captured")
        elif session_id:
            async with LivekitRepository.create_standalone() as repo:
                await repo.update_session(
                    session_id=session_id,
                    transcript=transcript,
                    duration_seconds=duration,
                    artifacts=artifacts,
                )
        elif user_id:
            persona_snapshot = persona_config or {"persona_id": persona_id}
            async with LivekitRepository.create_standalone() as repo:
                await repo.save_session(
                    user_id=user_id,
                    persona_id=persona_id,
                    persona_snapshot=persona_snapshot,
                    transcript=transcript,
                    duration_seconds=duration,
                    artifacts=artifacts,
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
            logger.info(
                f"[Agent] Heartbeat: {elapsed // 60}m elapsed, {turns} transcript turns captured"
            )

    heartbeat_task = asyncio.create_task(_heartbeat())
