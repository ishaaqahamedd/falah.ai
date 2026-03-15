import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from google import genai

from .models import PitchSession, SessionStatus
from .repository import SessionRepository
from .schemas import SessionCreate, SessionUpdate

logger = logging.getLogger("sessions-service")


def get_genai_client():
    api_key = os.environ.get("GOOGLE_API_KEY")
    return genai.Client(api_key=api_key)


DEFAULT_SCORING_CRITERIA = [
    {"key": "clarity", "label": "Clarity", "desc": "Clear and structured pitch"},
    {"key": "objection_handling", "label": "Objection Handling", "desc": "Addressed concerns effectively"},
    {"key": "engagement", "label": "Engagement", "desc": "Natural conversation flow"},
    {"key": "context_awareness", "label": "Context Awareness", "desc": "Referenced background info"},
    {"key": "closing_strength", "label": "Closing Strength", "desc": "Drove toward next steps"},
]


def _resolve_criteria(persona_snapshot: dict | None) -> list[dict]:
    """Get scoring criteria from persona snapshot, or fall back to defaults."""
    if persona_snapshot and persona_snapshot.get("scoring_criteria"):
        return persona_snapshot["scoring_criteria"]
    return DEFAULT_SCORING_CRITERIA


async def score_session(transcript: list[dict], persona_snapshot: dict | None) -> dict:
    """Score a session on dynamic dimensions using Gemini Flash.

    Reads scoring_criteria from persona_snapshot when available,
    otherwise falls back to the 5 default pitch dimensions.
    """
    client = get_genai_client()
    criteria = _resolve_criteria(persona_snapshot)

    persona_desc = "an AI persona"
    if persona_snapshot:
        persona_desc = f"{persona_snapshot.get('name', 'AI')} ({persona_snapshot.get('role', 'Business Professional')})"

    transcript_text = "\n".join(
        f"[{turn.get('role', '?').upper()}]: {turn.get('text', '')}"
        for turn in transcript
        if turn.get("text")
    )

    if not transcript_text.strip():
        return _empty_scorecard("Session had no meaningful dialogue to evaluate.", criteria)

    # Build dimension list dynamically
    dim_lines = "\n".join(
        f"{i+1}. **{c['label']}** — {c['desc']}"
        for i, c in enumerate(criteria)
    )

    # Build expected JSON shape dynamically
    json_dims = ",\n  ".join(
        f'"{c["key"]}": {{"score": <1-10>, "feedback": "<1-2 sentences>"}}'
        for c in criteria
    )

    prompt = f"""You are an expert session coach. Analyze this practice session between a user and {persona_desc}.

TRANSCRIPT:
{transcript_text}

Score the user's performance on these {len(criteria)} dimensions (1-10 each):

{dim_lines}

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{{
  {json_dims},
  "overall_score": <float 1.0-10.0>,
  "overall_feedback": "<2-3 sentences summarizing strengths and areas for improvement>"
}}"""

    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=prompt,
        )
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
        return json.loads(text)
    except Exception as e:
        logger.error(f"Scoring failed: {e}", exc_info=True)
        return _empty_scorecard(f"Scoring failed: {e}", criteria)


async def generate_session_summary(transcript: list[dict], persona_snapshot: dict | None) -> str:
    """Generate a 2-3 sentence summary of what happened in the session."""
    client = get_genai_client()

    persona_desc = "an AI persona"
    persona_type = "practice"
    if persona_snapshot:
        persona_desc = f"{persona_snapshot.get('name', 'AI')} ({persona_snapshot.get('role', 'Business Professional')})"
        persona_type = persona_snapshot.get("type", "practice")

    transcript_text = "\n".join(
        f"[{turn.get('role', '?').upper()}]: {turn.get('text', '')}"
        for turn in transcript
        if turn.get("text")
    )

    if not transcript_text.strip():
        return "Session ended without meaningful dialogue."

    prompt = f"""Summarize this {persona_type} session between a user and {persona_desc} in 2-3 sentences.
Focus on: what topics were covered, what the user did well, and where they struggled.
This summary will be used to help the AI persona adapt future sessions.

TRANSCRIPT:
{transcript_text}

Summary:"""

    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        logger.error(f"Summary generation failed: {e}", exc_info=True)
        return "Could not generate session summary."


def _empty_scorecard(reason: str, criteria: list[dict] | None = None) -> dict:
    """Build a neutral scorecard for the given criteria."""
    if not criteria:
        criteria = DEFAULT_SCORING_CRITERIA
    empty_dim = {"score": 5, "feedback": reason}
    scorecard = {c["key"]: empty_dim for c in criteria}
    scorecard["overall_score"] = 5.0
    scorecard["overall_feedback"] = reason
    return scorecard


class SessionService:
    def __init__(self, repository: SessionRepository):
        self.repository = repository

    async def create_session(self, user_id: UUID, data: SessionCreate) -> PitchSession:
        session_record = PitchSession(
            user_id=user_id,
            persona_id=data.persona_id,
            persona_snapshot=data.persona_snapshot,
            status=SessionStatus.ACTIVE,
        )
        return await self.repository.create(session_record)

    async def update_session(
        self, session_id: UUID, user_id: UUID, data: SessionUpdate
    ) -> PitchSession:
        session_record = await self._get_or_404(session_id, user_id)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(session_record, field, value)
        if data.status in (SessionStatus.COMPLETED, SessionStatus.CRASHED):
            session_record.ended_at = datetime.now(timezone.utc)
        return await self.repository.update(session_record)

    async def trigger_scoring(self, session_id: UUID, user_id: UUID) -> PitchSession:
        session_record = await self._get_or_404(session_id, user_id)
        if not session_record.transcript:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No transcript to score",
            )
        scorecard = await score_session(session_record.transcript, session_record.persona_snapshot)
        summary = await generate_session_summary(session_record.transcript, session_record.persona_snapshot)
        session_record.scorecard = scorecard
        session_record.ai_summary = summary
        return await self.repository.update(session_record)

    async def list_sessions(
        self, user_id: UUID, persona_id: Optional[UUID] = None, limit: int = 20
    ) -> list[PitchSession]:
        return await self.repository.list_by_user(user_id, persona_id, limit)

    async def get_session(self, session_id: UUID, user_id: UUID) -> PitchSession:
        return await self._get_or_404(session_id, user_id)

    async def create_completed_session(
        self,
        user_id: str,
        persona_id: str | None,
        persona_snapshot: dict | None,
        transcript: list[dict],
        duration_seconds: int,
    ) -> PitchSession:
        """Called by the livekit agent worker. Creates a completed session and auto-scores."""
        persona_uuid = None
        if persona_id:
            try:
                persona_uuid = uuid.UUID(persona_id)
            except ValueError:
                pass

        session_record = PitchSession(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id),
            persona_id=persona_uuid,
            persona_snapshot=persona_snapshot,
            transcript=transcript,
            duration_seconds=duration_seconds,
            status=SessionStatus.COMPLETED,
            ended_at=datetime.now(timezone.utc),
        )
        session_record = await self.repository.create(session_record)

        if len(transcript) >= 2:
            try:
                scorecard = await score_session(transcript, persona_snapshot)
                summary = await generate_session_summary(transcript, persona_snapshot)
                session_record.scorecard = scorecard
                session_record.ai_summary = summary
                await self.repository.update(session_record)
                logger.info(f"Session scored: {scorecard.get('overall_score', '?')}/10")
            except Exception as e:
                logger.error(f"Scoring failed (session still saved): {e}")

        return session_record

    async def _get_or_404(self, session_id: UUID, user_id: UUID) -> PitchSession:
        session_record = await self.repository.get_by_id_and_user(session_id, user_id)
        if not session_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )
        return session_record
