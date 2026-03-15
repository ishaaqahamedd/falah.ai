import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.database import Base
import enum


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CRASHED = "crashed"


class PitchSession(Base):
    __tablename__ = "pitch_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("personas.id", ondelete="SET NULL"), nullable=True, index=True)

    # Frozen persona config at time of session (so analytics survive persona edits/deletes)
    persona_snapshot = Column(JSONB, nullable=True)

    # [{role: "user"|"agent", text: str, timestamp: float}]
    transcript = Column(JSONB, nullable=True)

    duration_seconds = Column(Integer, nullable=True)
    status = Column(SAEnum(SessionStatus), nullable=False, default=SessionStatus.ACTIVE)

    # AI scoring results (filled post-call)
    scorecard = Column(JSONB, nullable=True)
    ai_summary = Column(Text, nullable=True)

    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
