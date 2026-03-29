import asyncio
import os
import json
import logging
import time

from livekit import api
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli
from livekit.protocol.room import ListRoomsRequest
from livekit.agents.voice import Agent, AgentSession, VoiceActivityVideoSampler, room_io
from livekit.plugins import google
from google.genai import types

from app.core.config import settings
from app.features.livekit.personas import get_persona_prompt
from app.features.livekit.handlers.onboarding_handler import setup_onboarding
from app.features.livekit.handlers.session_handler import setup_session
from app.features.livekit.foundation_config import (
    GLOBAL_PROMPT_ADDENDUM,
    FEATURE_FLAGS,
    VISION_CONFIG,
)
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from sqlalchemy.future import select
from app.features.superadmin.models import AIModelConfig
from app.features.superadmin.model_registry import MODEL_REGISTRY, DEFAULT_MODEL_ID

logger = logging.getLogger("persona-agent")

os.environ.setdefault("GOOGLE_API_KEY", settings.GOOGLE_API_KEY)
os.environ.setdefault("LIVEKIT_URL", settings.LIVEKIT_URL)
os.environ.setdefault("LIVEKIT_API_KEY", settings.LIVEKIT_API_KEY)
os.environ.setdefault("LIVEKIT_API_SECRET", settings.LIVEKIT_API_SECRET)


async def get_active_live_config() -> tuple[str, dict]:
    """
    Fetch the active model_id + settings from DB.
    Validates the model_id against the registry — normalizes to DEFAULT if stale.
    Falls back to settings defaults if DB is unavailable.

    Uses NullPool so the agent worker's event loop never inherits pooled connections
    from the FastAPI app's loop, avoiding asyncpg "attached to a different loop" errors.
    """
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

    engine = create_async_engine(db_url, poolclass=NullPool)
    try:
        SessionLocal = async_sessionmaker(
            bind=engine, class_=AsyncSession, expire_on_commit=False
        )
        async with SessionLocal() as db:
            result = await db.execute(
                select(AIModelConfig).where(
                    AIModelConfig.config_key == "live_agent_model"
                )
            )
            config = result.scalar_one_or_none()
            if config:
                model_id = config.model_id
                if model_id not in MODEL_REGISTRY:
                    logger.warning(
                        f"[Agent] DB model '{model_id}' not in registry — falling back to {DEFAULT_MODEL_ID}"
                    )
                    model_id = DEFAULT_MODEL_ID
                return model_id, config.settings or {}
    except Exception:
        pass
    finally:
        await engine.dispose()

    return settings.GEMINI_LIVE_MODEL, {"thinking_level": settings.THINKING_LEVEL}


def build_realtime_model(
    model_id: str, voice_id: str, model_settings: dict
) -> google.realtime.RealtimeModel:
    """
    Build a RealtimeModel using the model registry spec.
    Only passes flags the model actually supports — no unsupported kwargs sent to the API.
    """
    spec = MODEL_REGISTRY.get(model_id)
    if spec is None:
        logger.warning(
            f"[Agent] Model '{model_id}' not in registry — using {DEFAULT_MODEL_ID}"
        )
        model_id = DEFAULT_MODEL_ID
        spec = MODEL_REGISTRY[DEFAULT_MODEL_ID]
    thinking_spec = spec.get("thinking", {})

    if thinking_spec.get("type") == "level":
        thinking_cfg = None
    elif thinking_spec.get("type") == "budget":
        budget = model_settings.get(
            "thinking_budget", thinking_spec.get("default", 128)
        )
        thinking_cfg = types.ThinkingConfig(thinking_budget=budget)
    else:
        thinking_cfg = None

    kwargs: dict = dict(
        model=model_id,
        voice=voice_id,
    )

    # Preview models require v1alpha — the plugin defaults to v1beta which rejects them
    if spec.get("api_version"):
        kwargs["api_version"] = spec["api_version"]

    if thinking_cfg is not None:
        kwargs["thinking_config"] = thinking_cfg

    # Only pass flags the model actually supports
    if spec.get("affective_dialog"):
        kwargs["enable_affective_dialog"] = True
    if spec.get("proactivity"):
        kwargs["proactivity"] = True
    if spec.get("context_window_compression"):
        kwargs["context_window_compression"] = types.ContextWindowCompressionConfig(
            trigger_tokens=settings.CONTEXT_TRIGGER_TOKENS,
            sliding_window=types.SlidingWindow(
                target_tokens=settings.CONTEXT_TARGET_TOKENS,
            ),
        )

    return google.realtime.RealtimeModel(**kwargs)


class PersonaAgent(Agent):
    """A Gemini-powered agent configured dynamically via persona config."""

    def __init__(
        self,
        system_prompt: str,
        opening_instruction: str | None = None,
    ):
        super().__init__(instructions=system_prompt)
        self._opening_instruction = (
            opening_instruction
            or "Please greet the user warmly and begin the session."
        )

    async def on_enter(self):
        """Triggered when the agent connects and is ready to speak."""
        logger.info("[Agent] Triggering opening greeting.")
        await self.session.generate_reply(user_input=self._opening_instruction)


# ---------------------------------------------------------------------------
# Transcript Recorder — captures conversation turns via AgentSession events
# ---------------------------------------------------------------------------


class TranscriptRecorder:
    """Listens to AgentSession events and records user/agent conversation turns.
    Also broadcasts each turn in real-time to the frontend via LiveKit data channel.
    """

    MAX_TURNS = 100

    def __init__(self, session: AgentSession, room=None):
        self.session = session
        self._room = room  # LiveKit room for real-time broadcast
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
        turn = {
            "role": role,
            "text": text,
            "timestamp": round(event.created_at - self._start_time, 2),
        }
        self.turns.append(turn)
        if len(self.turns) > self.MAX_TURNS:
            self.turns = self.turns[-self.MAX_TURNS :]

        # Broadcast to frontend in real-time via LiveKit data channel
        if self._room:
            payload = json.dumps({"type": "transcript_turn", **turn}).encode("utf-8")
            asyncio.ensure_future(
                self._room.local_participant.publish_data(payload, reliable=True)
            )

    def get_transcript(self) -> list[dict]:
        return self.turns


# ---------------------------------------------------------------------------
# Dynamic Prompt Builder — works for ANY persona type
# ---------------------------------------------------------------------------

FOCUS_LABELS = {
    "investor": "INVESTMENT THESIS",
    "sales_client": "TOP CONCERNS",
}

DEFAULT_BEHAVIOR_RULES: dict[str, list[str]] = {
    "investor": [
        'HIGHLY CONVERSATIONAL — React naturally. Use "Ah I see", "That makes sense", "Wait, let me stop you there."',
        "VISION AWARE — Comment on visible slides, charts, and numbers on screen. Ask about specific claims you can see.",
        "Be SHORT — Maximum 2-3 sentences per response. No monologues. Let the user speak.",
        "PROBE METRICS — Push back on vague claims. Ask for ARR, growth rate, CAC, LTV, gross margin.",
        "REALISTIC BUT ENCOURAGING — Appreciate strong metrics when you hear or see them.",
        "USE YOUR DOSSIER — If you have intelligence about this person's past concerns or interests, weave them in naturally.",
    ],
    "sales_client": [
        'HIGHLY CONVERSATIONAL — React naturally to what the user says.',
        "VISION AWARE — Comment on product demos, UI walkthroughs, and diagrams you can see on screen.",
        "Be SHORT — Maximum 2-3 sentences per response.",
        "PROBE TECHNICAL CONCERNS — Ask about integration complexity, data privacy, SLA guarantees, and compliance.",
        "RISK-AWARE — Raise realistic procurement objections: vendor risk, switching cost, POC requirements.",
    ],
    "interview": [
        'HIGHLY CONVERSATIONAL — React naturally and warmly to the candidate\'s answers.',
        "Be SHORT — Ask one question at a time. Let the candidate speak.",
        "STRUCTURED — Guide toward STAR format (Situation, Task, Action, Result) when answers are vague.",
        "ENCOURAGING — Validate strong answers. Redirect weak answers constructively, not harshly.",
        "PROBE DEPTH — Ask follow-ups: 'What specifically did you do?', 'What was the outcome?'",
    ],
    "onboarding": [
        "WARM AND PATIENT — This may be the user's first experience. Be welcoming, not rushed.",
        "Be SHORT — One step at a time. Confirm understanding before moving on.",
        "ENCOURAGING — Celebrate small wins and progress.",
        "ADAPTIVE — If the user is stuck, offer a different explanation or example.",
    ],
    "training": [
        "KNOWLEDGEABLE — Teach by showing, not just telling. Use real examples.",
        "Be SHORT — One concept at a time. Ask comprehension questions after explaining.",
        "ADAPTIVE — Adjust pace based on the learner's responses.",
        "STRUCTURED — Summarize key takeaways at the end of each section.",
    ],
    "support": [
        "CALM AND EMPATHETIC — Never blame the user. Stay solution-oriented.",
        "Be SHORT — Walk through solutions step-by-step, confirming each step works.",
        "STRUCTURED — Understand the issue fully before jumping to solutions.",
        "ESCALATE GRACEFULLY — If out of scope, explain why and describe the escalation path.",
    ],
    "_default": [
        'HIGHLY CONVERSATIONAL — React naturally. Don\'t just fire off lists of questions.',
        "Be SHORT — Maximum 2-3 sentences per response.",
        "PROACTIVE DURING DEAD AIR — If the user goes silent, gently prompt them.",
        "ADAPTIVE — Match the user's energy and pace throughout the conversation.",
    ],
}


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

    dossier_parts: list[str] = []
    if briefing_context:
        truncated = briefing_context[: settings.MAX_BRIEFING_CHARS]
        suffix = (
            "... [truncated]"
            if len(briefing_context) > settings.MAX_BRIEFING_CHARS
            else ""
        )
        dossier_parts.append(
            f"--- AI-Generated Briefing (from uploaded docs) ---\n{truncated}{suffix}"
        )
    if crm_context:
        truncated = crm_context[: settings.MAX_CRM_CHARS]
        suffix = "... [truncated]" if len(crm_context) > settings.MAX_CRM_CHARS else ""
        dossier_parts.append(f"--- Manual Notes from User ---\n{truncated}{suffix}")

    dossier = (
        "\n\n".join(dossier_parts) if dossier_parts else "No prior context provided."
    )

    history_section = ""
    if session_history:
        session_history = session_history[-1:]
        history_entries = []
        for i, entry in enumerate(session_history, 1):
            date = entry.get("date", "Unknown date")
            summary = entry.get("summary", "No summary available.")
            score = entry.get("score", None)
            score_str = f" (Score: {score}/10)" if score else ""
            history_entries.append(
                f"--- Session {i} ({date}){score_str} ---\n{summary}"
            )

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
        rules_text = "\n".join(
            f"{i + 1}. {rule}" for i, rule in enumerate(custom_rules)
        )
    else:
        persona_type = config.get("type", "_default")
        fallback_rules = DEFAULT_BEHAVIOR_RULES.get(
            persona_type, DEFAULT_BEHAVIOR_RULES["_default"]
        )
        rules_text = "\n".join(
            f"{i + 1}. {rule}" for i, rule in enumerate(fallback_rules)
        )

    DEFAULT_OPENING: dict[str, str] = {
        "investor": "Open with a warm but efficient greeting. You're busy — ask them to get started with their pitch.",
        "sales_client": "Greet them professionally. Mention you have limited time and ask them to show you the product.",
        "interview": "Welcome them warmly to the practice session. Ask what role they're interviewing for so you can tailor your questions.",
        "onboarding": "Welcome them warmly to the platform. Ask what they'd like to set up or explore first today.",
        "training": "Greet them and ask which feature or workflow they'd like to learn about today.",
        "knowledge_transfer": "Greet them and explain you're here to help ensure a smooth knowledge transfer. Ask where they'd like to start.",
        "support": "Greet them warmly and ask how you can help today.",
        "_default": "Greet the user warmly and ask how you can help them today.",
    }
    persona_type = config.get("type", "_default")
    opening = (
        config.get("opening_message")
        or DEFAULT_OPENING.get(persona_type, DEFAULT_OPENING["_default"])
    )

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

{GLOBAL_PROMPT_ADDENDUM}
"""


# ---------------------------------------------------------------------------
# Entrypoint — routes to onboarding or regular session handler
# ---------------------------------------------------------------------------


async def entrypoint(ctx: JobContext):
    # Environment-aware room filtering
    env = settings.ENVIRONMENT
    expected_prefix = f"{env}-session-"

    if not ctx.room.name.startswith(expected_prefix) and not ctx.room.name.startswith(
        "onboarding-"
    ):
        logger.info(
            f"[Agent] Skipping room '{ctx.room.name}' — expected '{expected_prefix}' or 'onboarding-' prefix (env={env})"
        )
        return

    logger.info(f"[Agent] Room '{ctx.room.name}' active. Connecting...")

    # 1. Extract context from room metadata
    #    ctx.room.metadata can be stale if agent dispatch races room creation (e.g. local BE + deployed worker).
    #    Fallback: fetch metadata directly from LiveKit Room Service API.
    meta_str = ctx.room.metadata or ""
    if not meta_str or meta_str == "{}":
        logger.info(
            "[Agent] Room metadata empty on connect — fetching from Room Service API..."
        )
        for attempt in range(5):
            await asyncio.sleep(1)
            try:
                async with api.LiveKitAPI(
                    url=settings.LIVEKIT_URL,
                    api_key=settings.LIVEKIT_API_KEY,
                    api_secret=settings.LIVEKIT_API_SECRET,
                ) as lk_api:
                    rooms = await lk_api.room.list_rooms(
                        ListRoomsRequest(names=[ctx.room.name])
                    )
                    if rooms and rooms.rooms:
                        meta_str = rooms.rooms[0].metadata or ""
                        if meta_str and meta_str != "{}":
                            logger.info(
                                f"[Agent] Room metadata fetched via API after {attempt + 1}s"
                            )
                            break
            except Exception as e:
                logger.warning(
                    f"[Agent] Room Service API fetch attempt {attempt + 1} failed: {e}"
                )
        else:
            logger.warning(
                "[Agent] Room metadata still empty after 5 API retries — proceeding with defaults"
            )
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
    grounding_enabled = meta.get("grounding_enabled", False)
    is_onboarding = meta.get("mode") == "onboarding"

    logger.info(
        f"[Agent] persona_id={persona_id}, has_config={persona_config is not None}, "
        f"briefing_len={len(briefing_context)}, history_count={len(session_history) if session_history else 0}, "
        f"mode={'onboarding' if is_onboarding else 'session'}"
    )

    # 2. Build the system prompt
    opening_instruction = None
    if persona_config:
        system_prompt = _build_dynamic_prompt(
            persona_config, crm_context, briefing_context, session_history
        )
        voice_id = persona_config.get("voice", "Puck")
        opening_instruction = persona_config.get("opening_message")
        logger.info(
            f"[Agent] Using DYNAMIC persona: {persona_config.get('name', 'Unknown')} (voice={voice_id})"
        )
    else:
        system_prompt, voice_id = get_persona_prompt(persona_id, crm_context)
        logger.info(f"[Agent] Using HARDCODED persona: {persona_id} (voice={voice_id})")

    # 3. Initialize agent + session
    active_model, model_settings = await get_active_live_config()
    logger.info(
        f"[Agent] Using Gemini model: {active_model} | settings: {model_settings}"
    )

    agent = PersonaAgent(
        system_prompt=system_prompt,
        opening_instruction=opening_instruction,
    )

    session_tools = []
    if grounding_enabled:
        session_tools.append(google.tools.GoogleSearch())
        logger.info("[Agent] Google Search grounding enabled")
        if FEATURE_FLAGS["citations_panel"]:
            logger.info("[Agent] Citations panel enabled — grounding metadata will be broadcast")

    session: AgentSession = AgentSession(
        llm=build_realtime_model(active_model, voice_id, model_settings),
        tools=session_tools,
        video_sampler=VoiceActivityVideoSampler(
            speaking_fps=VISION_CONFIG["speaking_fps"],
            silent_fps=VISION_CONFIG["silent_fps"],
        ),
    )

    # 4. Attach transcript recorder (pass room for real-time broadcast)
    recorder = TranscriptRecorder(session, room=ctx.room)
    start_time = time.time()

    logger.info("[Agent] Starting audio/vision session...")

    await session.start(
        agent,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=True, audio_output=True, video_input=True
        ),
    )

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)

    # 5. Route to the appropriate handler
    if is_onboarding:
        await setup_onboarding(ctx, session, recorder, start_time, meta)
    else:
        await setup_session(ctx, session, recorder, start_time, meta)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
