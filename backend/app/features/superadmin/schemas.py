from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
import uuid


class UserRow(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: str
    is_active: bool
    auth_provider: str
    created_at: datetime
    session_count: int
    agent_count: int

    model_config = ConfigDict(from_attributes=True)


class UsersListResponse(BaseModel):
    users: list[UserRow]
    total: int
    page: int
    limit: int


class ModelSettings(BaseModel):
    """Per-model settings stored in DB and sent from superadmin UI."""

    thinking_level: Optional[str] = (
        None  # gemini-3.x: "minimal" | "low" | "medium" | "high"
    )
    thinking_budget: Optional[int] = None  # gemini-2.x: int (0=disabled, -1=auto)


class ModelConfigResponse(BaseModel):
    config_key: str
    model_id: str
    settings: Optional[ModelSettings] = None
    updated_at: Optional[datetime] = None


class ModelConfigUpdate(BaseModel):
    model_id: str
    settings: Optional[ModelSettings] = None


class ModelCapability(BaseModel):
    """Full spec for one model — returned by GET /superadmin/ai/models."""

    id: str
    label: str
    tier: str
    capabilities: dict  # thinking config schema + feature flags from model_registry


class AIModelsResponse(BaseModel):
    current: ModelConfigResponse
    available: list[ModelCapability]
