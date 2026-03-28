import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.database import Base

# Valid roles for RBAC
VALID_ROLES = ("user", "creator", "admin")

class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(320), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    auth_provider = Column(String(20), nullable=False, server_default="local")
    google_id = Column(String(255), nullable=True, unique=True, index=True)
    role = Column(String(20), nullable=False, server_default="user")

    # Onboarding
    onboarding_status = Column(String(20), nullable=False, server_default="pending")
    onboarding_step = Column(String(50), nullable=True)
    onboarding_completed_at = Column(DateTime(timezone=True), nullable=True)
    onboarding_summary = Column(Text, nullable=True)
