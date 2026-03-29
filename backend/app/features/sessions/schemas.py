from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime
from .models import SessionStatus


class TranscriptTurn(BaseModel):
    role: str  # "user" | "agent"
    text: str
    timestamp: float


class DimensionScore(BaseModel):
    score: int = Field(..., ge=1, le=10)
    feedback: str


class ScorecardSchema(BaseModel):
    clarity: DimensionScore
    objection_handling: DimensionScore
    engagement: DimensionScore
    context_awareness: DimensionScore
    closing_strength: DimensionScore
    overall_score: float
    overall_feedback: str


class SessionCreate(BaseModel):
    persona_id: Optional[str] = None
    persona_snapshot: Optional[dict] = None


class SessionUpdate(BaseModel):
    transcript: Optional[list[dict]] = None
    duration_seconds: Optional[int] = None
    status: Optional[SessionStatus] = None
    scorecard: Optional[dict] = None
    ai_summary: Optional[str] = None


class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    persona_id: Optional[UUID] = None
    persona_snapshot: Optional[dict] = None
    transcript: Optional[list[dict]] = None
    duration_seconds: Optional[int] = None
    status: SessionStatus
    scorecard: Optional[dict] = None
    ai_summary: Optional[str] = None
    artifacts: Optional[list[dict]] = None
    started_at: datetime
    ended_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SessionListItem(BaseModel):
    id: UUID
    persona_id: Optional[UUID] = None
    persona_snapshot: Optional[dict] = None
    duration_seconds: Optional[int] = None
    status: SessionStatus
    scorecard: Optional[dict] = None
    ai_summary: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
