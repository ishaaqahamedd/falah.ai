import uuid
from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.database import Base


class Persona(Base):
    __tablename__ = "personas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    type = Column(String(100), nullable=False, default="investor")
    name = Column(String(255), nullable=False)
    role = Column(String(255), nullable=False)
    personality = Column(Text, nullable=False)
    focus_areas = Column(Text, nullable=False)
    voice = Column(String(50), nullable=False, default="Puck")

    # Universal persona fields
    scoring_criteria = Column(JSONB, nullable=True)  # [{key, label, desc}, ...]
    behavior_rules = Column(JSONB, nullable=True)  # ["rule1", "rule2", ...]
    opening_message = Column(Text, nullable=True)  # custom opening instruction

    # Capabilities
    grounding_enabled = Column(
        Boolean, default=False, nullable=False, server_default="false"
    )

    # Community sharing
    is_public = Column(
        Boolean, default=False, nullable=False, server_default="false", index=True
    )
    use_count = Column(Integer, default=0, nullable=False, server_default="0")

    cached_briefing = Column(Text, nullable=True)
    briefing_generated_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
