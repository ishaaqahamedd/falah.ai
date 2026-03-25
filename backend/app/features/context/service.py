import json
import logging
import os
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from google import genai
from google.genai import types

from .models import ContextDocument
from .repository import ContextRepository
from app.features.personas.repository import PersonaRepository

logger = logging.getLogger("context-service")


def get_genai_client():
    api_key = os.environ.get("GOOGLE_API_KEY")
    # For safety, ensure we have a client. (Ideally, instantiate once globally or via DI)
    return genai.Client(api_key=api_key)

async def generate_embedding(text: str) -> list[float]:
    """Generate a 768-dimensional embedding using text-embedding-004."""
    client = get_genai_client()
    try:
        # Use simple asynchronous call or synchronous call for embedding
        # The new Google GenAI SDK usage for models/text-embedding-004
        result = client.models.embed_content(
            model='gemini-embedding-2-preview',
            contents=text,
        )
        return result.embeddings[0].values
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise ValueError(f"Failed to generate embedding: {e}")

async def summarize_context(texts: list[str], persona_name: str, persona_role: str) -> str:
    """Uses Gemini Flash to synthesize multiple documents into a concise pre-call briefing."""
    if not texts:
        return "No prior context available."
        
    client = get_genai_client()
    
    combined_text = "\n\n---\n\n".join(texts)
    
    prompt = f"""You are an AI assistant preparing a salesperson for a pitch with {persona_name} ({persona_role}).

Below are excerpts from previous emails, transcripts, and notes regarding this specific target.

Synthesize this information into a structured pre-call briefing (~300-400 words) using these sections:

**KEY CONCERNS & OBJECTIONS**
- List the main objections, worries, or pushback this person has expressed
- Include specific quotes or paraphrased concerns when available

**RECENT COMMUNICATION SUMMARY**
- Summarize the most recent interaction (email thread, call, meeting)
- Note the tone and any action items that were promised

**DECISION FACTORS**
- What will likely close this deal or move to next step?
- What could kill the deal or cause them to walk away?

**SPECIFIC DATA POINTS TO REFERENCE**
- Any exact numbers, metrics, dates, or statements the salesperson should know
- Things the AI persona can naturally bring up during conversation

Be specific and actionable. The salesperson will use this briefing to prepare for a live simulated pitch.

Context Data:
{combined_text}
"""
    
    try:
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite-preview',
            contents=prompt,
        )
        return response.text
    except Exception as e:
        import traceback
        traceback.print_exc()
        return "Error: Could not generate briefing from provided context."


class ContextService:
    def __init__(self, repository: ContextRepository, persona_repository: PersonaRepository):
        self.repository = repository
        self.persona_repository = persona_repository

    async def upload_document(
        self,
        user_id: UUID,
        text: str,
        filename: str,
        persona_id: Optional[UUID],
        content_type: str,
        metadata: dict,
    ) -> ContextDocument:
        if not text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty document content",
            )
        try:
            embedding = await generate_embedding(text)
        except ValueError as e:
            raise HTTPException(status_code=500, detail=str(e))

        doc = ContextDocument(
            user_id=user_id,
            persona_id=persona_id,
            filename=filename,
            content_type=content_type,
            content=text,
            embedding=embedding,
            metadata_=metadata,
        )
        return await self.repository.create_document(doc)

    async def list_documents(self, persona_id: UUID, user_id: UUID) -> list[ContextDocument]:
        return await self.repository.list_by_persona_and_user(persona_id, user_id)

    async def get_briefing(
        self,
        persona_id: UUID,
        user_id: UUID,
        force_refresh: bool = False,
        limit: int = 5,
    ) -> dict:
        persona = await self.persona_repository.get_by_id_and_user(persona_id, user_id)
        if not persona:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Persona not found",
            )

        if persona.cached_briefing and not force_refresh:
            return {
                "briefing": persona.cached_briefing,
                "sources": -1,
                "cached": True,
                "generated_at": persona.briefing_generated_at.isoformat() if persona.briefing_generated_at else None,
            }

        docs = await self.repository.list_recent_by_persona(persona_id, user_id, limit)
        if not docs:
            return {
                "briefing": "No previous context or emails uploaded for this persona yet.",
                "sources": 0,
                "cached": False,
            }

        texts = [d.content for d in docs]
        briefing = await summarize_context(texts, persona.name, persona.role)

        persona = await self.persona_repository.update_briefing_cache(persona, briefing)

        return {
            "briefing": briefing,
            "sources": len(docs),
            "cached": False,
            "generated_at": persona.briefing_generated_at.isoformat(),
        }

    async def search_context(
        self, query: str, persona_id: UUID, user_id: UUID, top_k: int = 3
    ) -> list[ContextDocument]:
        try:
            query_embedding = await generate_embedding(query)
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to embed query")
        return await self.repository.search_by_embedding(persona_id, user_id, query_embedding, top_k)
