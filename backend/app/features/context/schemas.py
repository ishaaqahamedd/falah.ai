from pydantic import BaseModel, field_validator
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime


class ContextDocumentBase(BaseModel):
    persona_id: Optional[UUID] = None
    filename: Optional[str] = None
    content_type: Optional[str] = None
    content: str
    metadata_: Optional[Dict[str, Any]] = None


class ContextDocumentCreate(ContextDocumentBase):
    pass


class ContextDocumentResponse(ContextDocumentBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("content", mode="before")
    @classmethod
    def truncate_content(cls, v: str) -> str:
        if isinstance(v, str) and len(v) > 200:
            return v[:200] + "..."
        return v


class ContextDocumentListItem(BaseModel):
    id: UUID
    filename: Optional[str] = None
    content_type: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ContextSearchResult(BaseModel):
    id: UUID
    content: str
    filename: Optional[str] = None

    model_config = {"from_attributes": True}


class BriefingResponse(BaseModel):
    briefing: str
    sources: int
    cached: bool
    generated_at: Optional[str] = None
