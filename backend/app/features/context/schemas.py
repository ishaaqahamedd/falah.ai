from pydantic import BaseModel
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
