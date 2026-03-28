import asyncio
import os
import json
import logging
import time

from livekit import api, rtc
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli
from livekit.protocol.room import ListRoomsRequest
from livekit.agents.voice import Agent, AgentSession, VoiceActivityVideoSampler, room_io
from livekit.plugins import google
from google.genai import types

from app.core.config import settings
from app.features.livekit.personas import get_persona_prompt
from app.features.livekit.handlers.onboarding_handler import setup_onboarding
from app.features.livekit.handlers.session_handler import setup_session

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
                model=settings.GEMINI_LIVE_MODEL,
                voice=voice_id,
                context_window_compression=types.ContextWindowCompressionConfig(
                    trigger_tokens=settings.CONTEXT_TRIGGER_TOKENS,
                    sliding_window=types.SlidingWindow(
                        target_tokens=settings.CONTEXT_TARGET_TOKENS,
                    ),
                ),
                thinking_config=types.ThinkingConfig(
                    thinking_budget=settings.THINKING_BUDGET,
                ),
                enable_affective_dialog=True,
                proactivity=True,
                session_resumption=types.SessionResumptionConfig(handle=None),
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
        if len(self.turns) > self.MAX_TURNS:
            self.turns = self.turns[-self.MAX_TURNS:]

    def get_transcript(self) -> list[dict]:
        return self.turns


# ---------------------------------------------------------------------------
# Dynamic Prompt Builder — works for ANY persona type
# ---------------------------------------------------------------------------

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
    """Build a system prompt from a dynamic persona config dictionary."""
    persona_type = config.get("type", "investor")
    name = config.get("name", "AI Persona")
    role = config.get("role", "Business Professional")
    personality = config.get("personality", "Professional and direct.")
    focus_areas = config.get("focus_areas", "General business topics.")

    focus_label = FOCUS_LABELS.get(persona_type, "KEY FOCUS AREAS")

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

    custom_rules = config.get("behavior_rules")
    if custom_rules:
        rules_text = "\n".join(f"{i+1}. {rule}" for i, rule in enumerate(custom_rules))
    else:
        rules_text = "\n".join(f"{i+1}. {rule}" for i, rule in enumerate(DEFAULT_BEHAVIOR_RULES))

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


# ---------------------------------------------------------------------------
# Entrypoint — routes to onboarding or regular session handler
# ---------------------------------------------------------------------------

async def entrypoint(ctx: JobContext):
    # Environment-aware room filtering
    env = settings.ENVIRONMENT
    expected_prefix = f"{env}-session-"

    if not ctx.room.name.startswith(expected_prefix) and not ctx.room.name.startswith("onboarding-"):
        logger.info(f"[Agent] Skipping room '{ctx.room.name}' — expected '{expected_prefix}' or 'onboarding-' prefix (env={env})")
        return

    logger.info(f"[Agent] Room '{ctx.room.name}' active. Connecting...")

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)

    # 1. Extract context from room metadata
    #    ctx.room.metadata can be stale if agent dispatch races room creation (e.g. local BE + deployed worker).
    #    Fallback: fetch metadata directly from LiveKit Room Service API.
    meta_str = ctx.room.metadata or ""
    if not meta_str or meta_str == "{}":
        logger.info("[Agent] Room metadata empty on connect — fetching from Room Service API...")
        for attempt in range(5):
            await asyncio.sleep(1)
            try:
                async with api.LiveKitAPI(
                    url=settings.LIVEKIT_URL,
                    api_key=settings.LIVEKIT_API_KEY,
                    api_secret=settings.LIVEKIT_API_SECRET,
                ) as lk_api:
                    rooms = await lk_api.room.list_rooms(ListRoomsRequest(names=[ctx.room.name]))
                    if rooms and rooms.rooms:
                        meta_str = rooms.rooms[0].metadata or ""
                        if meta_str and meta_str != "{}":
                            logger.info(f"[Agent] Room metadata fetched via API after {attempt + 1}s")
                            break
            except Exception as e:
                logger.warning(f"[Agent] Room Service API fetch attempt {attempt + 1} failed: {e}")
        else:
            logger.warning("[Agent] Room metadata still empty after 5 API retries — proceeding with defaults")
            meta_str = meta_str or "{}"
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
    is_onboarding = meta.get("mode") == "onboarding"

    logger.info(f"[Agent] persona_id={persona_id}, has_config={persona_config is not None}, "
                f"briefing_len={len(briefing_context)}, history_count={len(session_history) if session_history else 0}, "
                f"mode={'onboarding' if is_onboarding else 'session'}")

    # 2. Build the system prompt
    opening_instruction = None
    if persona_config:
        system_prompt = _build_dynamic_prompt(persona_config, crm_context, briefing_context, session_history)
        voice_id = persona_config.get("voice", "Puck")
        opening_instruction = persona_config.get("opening_message")
        logger.info(f"[Agent] Using DYNAMIC persona: {persona_config.get('name', 'Unknown')} (voice={voice_id})")
    else:
        system_prompt, voice_id = get_persona_prompt(persona_id, crm_context)
        logger.info(f"[Agent] Using HARDCODED persona: {persona_id} (voice={voice_id})")

    # 3. Initialize agent + session
    agent = PersonaAgent(
        system_prompt=system_prompt,
        voice_id=voice_id,
        opening_instruction=opening_instruction,
    )

    session = AgentSession(
        video_sampler=VoiceActivityVideoSampler(
            speaking_fps=settings.VIDEO_SPEAKING_FPS,
            silent_fps=settings.VIDEO_SILENT_FPS,
        )
    )

    # 4. Attach transcript recorder
    recorder = TranscriptRecorder(session)
    start_time = time.time()

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

    # 5. Route to the appropriate handler
    if is_onboarding:
        await setup_onboarding(ctx, session, recorder, start_time, meta)
    else:
        await setup_session(ctx, session, recorder, start_time, meta)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
