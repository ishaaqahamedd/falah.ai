from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class ScoringCriterion(BaseModel):
    key: str = Field(..., min_length=1, max_length=100)
    label: str = Field(..., min_length=1, max_length=100)
    desc: str = Field(..., min_length=1, max_length=255)


class PersonaCreate(BaseModel):
    type: str = Field(default="investor", min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    role: str = Field(..., min_length=1, max_length=255)
    personality: str = Field(..., min_length=1)
    focus_areas: str = Field(..., min_length=1)
    voice: str = Field(
        default="Puck", pattern=r"^(Puck|Charon|Kore|Fenrir|Aoede|Leda|Orus|Zephyr)$"
    )
    scoring_criteria: Optional[list[ScoringCriterion]] = None
    behavior_rules: Optional[list[str]] = None
    opening_message: Optional[str] = None
    is_public: bool = False
    grounding_enabled: bool = False


class PersonaUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    personality: Optional[str] = None
    focus_areas: Optional[str] = None
    voice: Optional[str] = None
    type: Optional[str] = None
    scoring_criteria: Optional[list[ScoringCriterion]] = None
    behavior_rules: Optional[list[str]] = None
    opening_message: Optional[str] = None
    is_public: Optional[bool] = None
    grounding_enabled: Optional[bool] = None


class PersonaResponse(BaseModel):
    id: UUID
    type: str
    name: str
    role: str
    personality: str
    focus_areas: str
    voice: str
    scoring_criteria: Optional[list[dict]] = None
    behavior_rules: Optional[list[str]] = None
    opening_message: Optional[str] = None
    is_public: bool
    use_count: int
    grounding_enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommunityPersonaResponse(PersonaResponse):
    creator_name: str
    user_id: UUID
