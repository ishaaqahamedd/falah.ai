import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from app.db.database import Base

class ContextDocument(Base):
    __tablename__ = "context_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("personas.id", ondelete="CASCADE"), nullable=True, index=True)
    
    filename = Column(String(255), nullable=True)
    content_type = Column(String(50), nullable=True) # e.g. 'email', 'transcript', 'notes'
    
    content = Column(Text, nullable=False)
    embedding = Column(Vector(3072), nullable=False)  # Gemini Embedding 2 uses 3072 dims
    
    metadata_ = Column("metadata", JSONB, nullable=True, default=dict)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
