import asyncio
import os
import json
import logging
import time

from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli
from livekit.agents.voice import Agent, AgentSession, VoiceActivityVideoSampler, room_io
from livekit.plugins import google
from google.genai import types

from app.core.config import settings

# Import our FSD Persona Factory (legacy hardcoded personas)
from app.features.livekit.personas import get_persona_prompt

logger = logging.getLogger("persona-agent")

os.environ.setdefault("GOOGLE_API_KEY", settings.GOOGLE_API_KEY)
os.environ.setdefault("LIVEKIT_URL", settings.LIVEKIT_URL)
os.environ.setdefault("LIVEKIT_API_KEY", settings.LIVEKIT_API_KEY)
os.environ.setdefault("LIVEKIT_API_SECRET", settings.LIVEKIT_API_SECRET)


class PersonaAgent(Agent):
    """A Gemini-powered agent configured dynamically via persona config."""

    def __init__(self, system_prompt: str, voice_id: str, opening_instruction: str | None = None):
        super().__init__(
            instructions=system_prompt,
            llm=google.realtime.RealtimeModel(
                model="gemini-2.5-flash-native-audio-preview-12-2025",
                voice=voice_id,
                context_window_compression=types.ContextWindowCompressionConfig(
                    trigger_tokens=settings.CONTEXT_TRIGGER_TOKENS,
                    sliding_window=types.SlidingWindow(
                        target_tokens=settings.CONTEXT_TARGET_TOKENS,
                    ),
                ),
            ),
        )
        self._opening_instruction = (
            opening_instruction
            or "Please greet the user and ask them to begin their presentation."
        )

    async def on_enter(self):
        """Triggered when the agent connects and is ready to speak."""
        logger.info("[Agent] Triggering opening greeting.")
        self.session.generate_reply(user_input=self._opening_instruction)


# ---------------------------------------------------------------------------
# Transcript Recorder — captures conversation turns via AgentSession events
# ---------------------------------------------------------------------------

class TranscriptRecorder:
    """Listens to AgentSession events and records user/agent conversation turns."""

    MAX_TURNS = 100

    def __init__(self, session: AgentSession):
        self.session = session
        self.turns: list[dict] = []
        self._start_time = time.time()

        # conversation_item_added fires for both user and agent committed messages
        session.on("conversation_item_added", self._on_item_added)

    def _on_item_added(self, event) -> None:
        """Capture final committed messages (user AND agent)."""
        msg = event.item
        text = msg.text_content
        if not text:
            return

        role = "agent" if msg.role == "assistant" else "user"
        self.turns.append({
            "role": role,
            "text": text,
            "timestamp": round(event.created_at - self._start_time, 2),
        })
        # Prune old turns to prevent unbounded memory growth
        if len(self.turns) > self.MAX_TURNS:
            self.turns = self.turns[-self.MAX_TURNS:]

    def get_transcript(self) -> list[dict]:
        return self.turns


# ---------------------------------------------------------------------------
# DB helpers — direct DB access from agent worker (same Python package)
# ---------------------------------------------------------------------------

async def _save_session_to_db(
    user_id: str,
    persona_id: str | None,
    persona_snapshot: dict | None,
    transcript: list[dict],
    duration_seconds: int,
):
    """Save a completed session and auto-trigger scoring + summary."""
    from app.db.database import AsyncSessionLocal
    # Import models so SQLAlchemy metadata knows about FK-referenced tables.
    from app.features.auth.models import User  # noqa: F401
    from app.features.personas.models import Persona  # noqa: F401
    from app.features.sessions.service import SessionService
    from app.features.sessions.repository import SessionRepository

    async with AsyncSessionLocal() as db:
        try:
            service = SessionService(repository=SessionRepository(db))
            session_record = await service.create_completed_session(
                user_id=user_id,
                persona_id=persona_id,
                persona_snapshot=persona_snapshot,
                transcript=transcript,
                duration_seconds=duration_seconds,
            )
            logger.info(f"[Agent] Session saved to DB: {session_record.id}")
        except Exception as e:
            logger.error(f"[Agent] Failed to save session: {e}", exc_info=True)
            await db.rollback()


# ---------------------------------------------------------------------------
# Dynamic Prompt Builder — works for ANY persona type
# ---------------------------------------------------------------------------

# Known focus area labels for legacy persona types; everything else gets a generic label
FOCUS_LABELS = {
    "investor": "INVESTMENT THESIS",
    "sales_client": "TOP CONCERNS",
}

DEFAULT_BEHAVIOR_RULES = [
    "HIGHLY CONVERSATIONAL — Do not just fire off lists of questions. React naturally with \"Ah, I see\", \"That makes sense\", or \"Wait, let me stop you there.\"",
    "PROACTIVE DURING DEAD AIR — If the user goes silent or pauses for too long, jump in! Say something like \"Take your time,\" or \"Should we move on?\" or prompt them on a previous point.",
    "VISION AWARE — You receive live frames from the user's screen share. When slides are visible, ALWAYS comment on them. Ask about specific numbers, charts, or claims you can see on the screen.",
    "Be SHORT — Maximum 2-3 sentences per response. No monologues. Let the user speak.",
    "REALISTIC BUT ENCOURAGING — Push back on vague claims, but appreciate good metrics when you hear/see them.",
    "USE YOUR DOSSIER — If you have intelligence about this person's past concerns, objections, or interests, naturally weave them into the conversation.",
]


def _build_dynamic_prompt(
    config: dict,
    crm_context: str = "",
    briefing_context: str = "",
    session_history: list[dict] | None = None,
) -> str:
    """Build a system prompt from a dynamic persona config dictionary.

    Works for ANY persona type — investor, onboarding, training, support, etc.
    """
    persona_type = config.get("type", "investor")
    name = config.get("name", "AI Persona")
    role = config.get("role", "Business Professional")
    personality = config.get("personality", "Professional and direct.")
    focus_areas = config.get("focus_areas", "General business topics.")

    # Dynamic focus label — known types get specific labels, others get generic
    focus_label = FOCUS_LABELS.get(persona_type, "KEY FOCUS AREAS")

    # Build the intelligence dossier from all available context (truncated to limit token usage)
    _MAX_BRIEFING = 2000
    _MAX_CRM = 1000
    dossier_parts: list[str] = []
    if briefing_context:
        truncated = briefing_context[:_MAX_BRIEFING]
        suffix = "... [truncated]" if len(briefing_context) > _MAX_BRIEFING else ""
        dossier_parts.append(f"--- AI-Generated Briefing (from uploaded docs) ---\n{truncated}{suffix}")
    if crm_context:
        truncated = crm_context[:_MAX_CRM]
        suffix = "... [truncated]" if len(crm_context) > _MAX_CRM else ""
        dossier_parts.append(f"--- Manual Notes from User ---\n{truncated}{suffix}")

    dossier = "\n\n".join(dossier_parts) if dossier_parts else "No prior context provided."

    # Build session history section for cross-session adaptation (limit to most recent)
    history_section = ""
    if session_history:
        session_history = session_history[-1:]
        history_entries = []
        for i, entry in enumerate(session_history, 1):
            date = entry.get("date", "Unknown date")
            summary = entry.get("summary", "No summary available.")
            score = entry.get("score", None)
            score_str = f" (Score: {score}/10)" if score else ""
            history_entries.append(f"--- Session {i} ({date}){score_str} ---\n{summary}")

        history_text = "\n\n".join(history_entries)
        history_section = f"""
SESSION HISTORY (previous sessions — use this to adapt your approach):
{history_text}

ADAPTIVE BEHAVIOR RULES:
- Do NOT repeat the same opening questions from previous sessions. Find new angles.
- PROBE WEAK AREAS — if previous sessions reveal struggles, dig into those early.
- ACKNOWLEDGE IMPROVEMENT — if the user has clearly improved, say so naturally.
- ESCALATE DIFFICULTY — each session should push harder. Go deeper into edge cases.
- INTRODUCE NEW ANGLES — bring up topics that weren't covered in previous sessions.
"""

    # Custom behavior rules from persona config, or defaults
    custom_rules = config.get("behavior_rules")
    if custom_rules:
        rules_text = "\n".join(f"{i+1}. {rule}" for i, rule in enumerate(custom_rules))
    else:
        rules_text = "\n".join(f"{i+1}. {rule}" for i, rule in enumerate(DEFAULT_BEHAVIOR_RULES))

    # Opening instruction
    opening = config.get("opening_message") or "Open with a warm, casual greeting and ask them to begin their presentation."

    return f"""You are {name}, {role}.

CORE PERSONALITY:
{personality}

{focus_label} (what you care about):
{focus_areas}

INTELLIGENCE DOSSIER (use this knowledge naturally — reference it, ask about it, push back on it):
{dossier}
{history_section}
BEHAVIOR RULES:
{rules_text}

{opening}
"""


async def entrypoint(ctx: JobContext):
    logger.info(f"[Agent] Room '{ctx.room.name}' active. Connecting...")

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)

    # 1. Extract context from ROOM METADATA (set by the token router via Room Service API)
    meta_str = ctx.room.metadata or "{}"
    logger.info(f"[Agent] Raw room metadata: {meta_str[:300]}...")

    try:
        meta = json.loads(meta_str)
    except Exception as e:
        logger.warning(f"[Agent] Failed to parse room metadata: {e}")
        meta = {}

    persona_id = meta.get("persona_id", "investor_1")
    crm_context = meta.get("context", "")
    persona_config = meta.get("persona_config", None)
    briefing_context = meta.get("briefing_context", "")
    session_history = meta.get("session_history", None)
    user_id = meta.get("user_id", "")

    logger.info(f"[Agent] persona_id={persona_id}, has_config={persona_config is not None}, "
                f"briefing_len={len(briefing_context)}, history_count={len(session_history) if session_history else 0}")

    # 2. Build the system prompt
    opening_instruction = None
    if persona_config:
        # Dynamic user-created persona — full config passed via room metadata
        system_prompt = _build_dynamic_prompt(persona_config, crm_context, briefing_context, session_history)
        voice_id = persona_config.get("voice", "Puck")
        opening_instruction = persona_config.get("opening_message")
        logger.info(f"[Agent] Using DYNAMIC persona: {persona_config.get('name', 'Unknown')} (voice={voice_id})")
    else:
        # Legacy hardcoded persona — use factory lookup
        system_prompt, voice_id = get_persona_prompt(persona_id, crm_context)
        logger.info(f"[Agent] Using HARDCODED persona: {persona_id} (voice={voice_id})")

    # 3. Initialize Agent with Native Multimodal capabilities
    agent = PersonaAgent(
        system_prompt=system_prompt,
        voice_id=voice_id,
        opening_instruction=opening_instruction,
    )

    # Passing the VoiceActivityVideoSampler to the Session tells LiveKit to automatically
    # grab frames from the screenshare track and push them to Google Realtime Model.
    session = AgentSession(
        video_sampler=VoiceActivityVideoSampler(
            speaking_fps=settings.VIDEO_SPEAKING_FPS,
            silent_fps=settings.VIDEO_SILENT_FPS,
        )
    )

    # 4. Attach transcript recorder
    recorder = TranscriptRecorder(session)
    start_time = time.time()

    # 5. Register shutdown callback to save transcript after session ends
    async def on_shutdown(reason: str):
        logger.info(f"[Agent] Shutdown triggered: {reason}")
        transcript = recorder.get_transcript()
        duration = int(time.time() - start_time)
        logger.info(f"[Agent] Captured {len(transcript)} turns over {duration}s. Saving...")

        if user_id and len(transcript) >= 1:
            persona_snapshot = persona_config or {"persona_id": persona_id}
            await _save_session_to_db(
                user_id=user_id,
                persona_id=persona_id,
                persona_snapshot=persona_snapshot,
                transcript=transcript,
                duration_seconds=duration,
            )
        else:
            logger.warning(f"[Agent] Skipping save: user_id={bool(user_id)}, turns={len(transcript)}")

    ctx.add_shutdown_callback(on_shutdown)

    logger.info("[Agent] Starting audio/vision session...")

    await session.start(
        agent,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=True,
            audio_output=True,
            video_input=True
        )
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
