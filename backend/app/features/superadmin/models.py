import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.database import Base


class AIModelConfig(Base):
    __tablename__ = "ai_model_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_key = Column(String(50), unique=True, nullable=False)  # e.g. "live_agent_model"
    model_id = Column(String(100), nullable=False)                # e.g. "gemini-3.1-flash-live-preview"
    settings = Column(JSONB, nullable=True)                       # e.g. {"thinking_level": "minimal"}
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
