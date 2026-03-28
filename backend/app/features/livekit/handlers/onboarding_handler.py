"""Onboarding-specific agent behaviors: screen share detection, silence nudges, auto-end."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import TYPE_CHECKING

from livekit import rtc
from livekit.agents import JobContext
from livekit.agents.voice import AgentSession

from app.features.livekit.repository import LivekitRepository

if TYPE_CHECKING:
    from app.features.livekit.agent import TranscriptRecorder

logger = logging.getLogger("persona-agent")


async def setup_onboarding(
    ctx: JobContext,
    session: AgentSession,
    recorder: "TranscriptRecorder",
    start_time: float,
    meta: dict,
):
    """Wire up all onboarding-specific behaviors after the session has started.

    This includes:
    - Screen share start/stop detection with agent acknowledgments
    - Multi-signal activity tracking (user speech, agent speech, screen share)
    - Escalating silence nudge (max 3, then stop)
    - Activity-aware auto-end (idle timer + hard cap)
    - Shutdown callback for onboarding summary generation
    """
    user_id = meta.get("user_id", "")
    persona_config = meta.get("persona_config", None)

    # Task handles — populated after tasks are created, referenced by on_shutdown
    _tasks: list[asyncio.Task] = []

    # --- Shutdown callback: generate onboarding summary ---
    async def on_shutdown(reason: str):
        logger.info(f"[Agent] Onboarding shutdown triggered: {reason}")
        for t in _tasks:
            t.cancel()
        transcript = recorder.get_transcript()
        duration = int(time.time() - start_time)
        logger.info(f"[Agent] Captured {len(transcript)} turns over {duration}s.")

        if len(transcript) > 0 and user_id:
            try:
                from app.features.sessions.service import generate_session_summary

                summary = await generate_session_summary(transcript, persona_config)
                async with LivekitRepository.create_standalone() as repo:
                    await repo.save_onboarding_summary(user_id, summary)
                logger.info(f"[Agent] Onboarding summary saved: {summary[:100]}...")
            except Exception as e:
                logger.error(
                    f"[Agent] Failed to save onboarding summary: {e}", exc_info=True
                )

    ctx.add_shutdown_callback(on_shutdown)

    # --- Heartbeat ---
    async def _heartbeat():
        while True:
            await asyncio.sleep(60)
            elapsed = int(time.time() - start_time)
            turns = len(recorder.get_transcript())
            logger.info(
                f"[Agent] Onboarding heartbeat: {elapsed // 60}m elapsed, {turns} turns"
            )

    _tasks.append(asyncio.create_task(_heartbeat()))

    # --- Screen share start detection ---
    @ctx.room.on("track_subscribed")
    def _on_track_subscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if publication.source == rtc.TrackSource.SOURCE_SCREENSHARE:
            logger.info(
                "[Agent] Onboarding — screen share detected, triggering acknowledgment"
            )
            session.generate_reply(
                user_input="The user just started sharing their screen. Acknowledge it with energy and enthusiasm, thank them, and continue guiding them."
            )

    # --- Screen share stop detection ---
    @ctx.room.on("track_unsubscribed")
    def _on_track_unsubscribed(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if publication.source == rtc.TrackSource.SOURCE_SCREENSHARE:
            logger.info("[Agent] Onboarding — screen share stopped")
            session.generate_reply(
                user_input="The user just stopped sharing their screen. In a friendly, encouraging tone, ask them to share their screen again so you can guide them better. Keep it to 1-2 sentences."
            )

    # --- Multi-signal activity tracking (mutable lists to avoid nonlocal scope issues) ---
    last_activity_ts = [
        time.time()
    ]  # Any activity (user + agent) — used for nudge timing
    last_user_activity_ts = [time.time()]  # User-only activity — used for idle auto-end
    nudge_counter = [0]
    screen_share_active = [False]

    @session.on("user_speech_committed")
    def _on_user_speech(ev):
        last_activity_ts[0] = time.time()
        last_user_activity_ts[0] = time.time()
        nudge_counter[0] = 0  # Reset escalation on user speech

    @session.on("agent_speech_committed")
    def _on_agent_speech(ev):
        last_activity_ts[0] = (
            time.time()
        )  # Give user time to process after agent speaks

    @ctx.room.on("track_subscribed")
    def _on_screenshare_start_activity(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if publication.source == rtc.TrackSource.SOURCE_SCREENSHARE:
            last_activity_ts[0] = time.time()
            last_user_activity_ts[0] = time.time()
            screen_share_active[0] = True

    @ctx.room.on("track_unsubscribed")
    def _on_screenshare_stop_activity(
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if publication.source == rtc.TrackSource.SOURCE_SCREENSHARE:
            screen_share_active[0] = False

    # --- Escalating silence nudge: max 3, then stop ---
    NUDGE_PROMPTS = [
        "The user has been quiet for a bit. Gently say something like 'Take your time, I'm here when you need me.' Keep it to 1 sentence.",
        "The user is still quiet. Offer help: 'Want me to explain what you're looking at?' Keep it to 1 sentence.",
        "The user has been quiet for a while. Check in: 'Still there? No pressure — just let me know when you're ready.' Keep it to 1 sentence.",
    ]
    NUDGE_INTERVALS = [30, 45, 60]  # seconds without screen share
    NUDGE_INTERVALS_SCREEN = [
        45,
        60,
        90,
    ]  # longer when screen sharing (user is navigating)

    async def _silence_nudge():
        """Escalating nudge — max 3, then stop until user speaks."""
        while True:
            await asyncio.sleep(10)
            if nudge_counter[0] >= len(NUDGE_PROMPTS):
                continue

            intervals = (
                NUDGE_INTERVALS_SCREEN if screen_share_active[0] else NUDGE_INTERVALS
            )
            idx = nudge_counter[0]
            threshold = intervals[idx]
            elapsed = time.time() - last_activity_ts[0]

            if elapsed >= threshold:
                logger.info(
                    f"[Agent] Onboarding — silence nudge #{idx + 1} after {int(elapsed)}s (screen_share={screen_share_active[0]})"
                )
                session.generate_reply(user_input=NUDGE_PROMPTS[idx])
                last_activity_ts[0] = time.time()
                nudge_counter[0] += 1

    _tasks.append(asyncio.create_task(_silence_nudge()))

    # --- Activity-aware auto-end: idle timer + hard cap ---
    IDLE_WARNING = 90
    IDLE_GOODBYE = 30
    IDLE_SHUTDOWN = 15
    HARD_CAP = 480  # 8 minutes max session
    HARD_CAP_WARNING = 30

    async def _onboarding_auto_end():
        session_start = time.time()
        warned_idle = False
        goodbye_sent = False
        hard_cap_warned = False

        while True:
            await asyncio.sleep(5)
            now = time.time()
            elapsed_total = now - session_start
            idle_time = now - last_user_activity_ts[0]

            # Hard cap: 8 minutes max
            if elapsed_total >= HARD_CAP:
                logger.info(
                    f"[Agent] Onboarding hard cap reached ({int(elapsed_total)}s) — shutting down"
                )
                ctx.shutdown()
                return

            # Hard cap warning at 7:30
            if not hard_cap_warned and elapsed_total >= (HARD_CAP - HARD_CAP_WARNING):
                hard_cap_warned = True
                logger.info("[Agent] Onboarding hard cap warning")
                session.generate_reply(
                    user_input="Gently let the user know that you've been having a great time but the setup session will wrap up soon. Be friendly and encouraging — don't make it feel abrupt. Keep it to 1-2 sentences."
                )
                continue

            # Idle-based shutdown sequence
            if goodbye_sent and idle_time >= (
                IDLE_WARNING + IDLE_GOODBYE + IDLE_SHUTDOWN
            ):
                logger.info(
                    f"[Agent] Onboarding idle shutdown after goodbye ({int(idle_time)}s idle)"
                )
                ctx.shutdown()
                return

            if (
                warned_idle
                and not goodbye_sent
                and idle_time >= (IDLE_WARNING + IDLE_GOODBYE)
            ):
                goodbye_sent = True
                logger.info(f"[Agent] Onboarding idle goodbye ({int(idle_time)}s idle)")
                session.generate_reply(
                    user_input="Say a warm goodbye to the user. Tell them it was awesome setting up together, they can always come back, and encourage them to keep exploring. Keep it to 2-3 sentences max."
                )
                continue

            if not warned_idle and idle_time >= IDLE_WARNING:
                warned_idle = True
                logger.info(f"[Agent] Onboarding idle warning ({int(idle_time)}s idle)")
                session.generate_reply(
                    user_input="The user has been inactive for a while. Gently check in — ask if they're still there and if they'd like to continue or wrap up. Keep it warm and to 1-2 sentences."
                )
                continue

            # Reset idle sequence only when user genuinely becomes active
            if idle_time < 10 and (warned_idle or goodbye_sent):
                logger.info(
                    "[Agent] Onboarding — user active again, resetting idle sequence"
                )
                warned_idle = False
                goodbye_sent = False
                nudge_counter[0] = 0

    _tasks.append(asyncio.create_task(_onboarding_auto_end()))
