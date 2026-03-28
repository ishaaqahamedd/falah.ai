import asyncio
import json
import logging
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.genai import get_genai_client
from .models import ContextDocument
from .repository import ContextRepository
from app.features.personas.repository import PersonaRepository

logger = logging.getLogger("context-service")

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {"text/plain", "application/pdf", "text/csv", "text/markdown"}


async def generate_embedding(text: str) -> list[float]:
    """Generate a 768-dimensional embedding using Gemini embedding model."""
    client = get_genai_client()
    try:
        result = await asyncio.to_thread(
            client.models.embed_content,
            model=settings.GEMINI_EMBEDDING_MODEL,
            contents=text,
        )
        embeddings = result.embeddings
        if not embeddings:
            raise ValueError("Embedding API returned no embeddings")
        return list(embeddings[0].values)
    except Exception as e:
        logger.exception("Embedding generation failed")
        raise ValueError(f"Failed to generate embedding: {e}")


async def summarize_context(
    texts: list[str], persona_name: str, persona_role: str
) -> str:
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
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=settings.GEMINI_FLASH_LITE_MODEL,
            contents=prompt,
        )
        return response.text or "Error: Empty response from model."
    except Exception:
        logger.exception("Briefing generation failed")
        return "Error: Could not generate briefing from provided context."


class ContextService:
    def __init__(
        self, repository: ContextRepository, persona_repository: PersonaRepository
    ):
        self.repository = repository
        self.persona_repository = persona_repository

    def validate_and_extract_text(
        self, content: bytes, file_content_type: str | None, metadata_json: str
    ) -> tuple[str, dict]:
        """Validate upload constraints and extract text + metadata.

        Raises ValueError on validation failure.
        """
        if len(content) > MAX_UPLOAD_SIZE:
            raise ValueError(
                f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)}MB"
            )

        if file_content_type and file_content_type not in ALLOWED_CONTENT_TYPES:
            raise ValueError(f"Unsupported file type: {file_content_type}")

        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            raise ValueError("File is not valid UTF-8 text")

        meta: dict = {}
        try:
            meta = json.loads(metadata_json)
        except (json.JSONDecodeError, TypeError):
            logger.warning("Invalid metadata JSON, ignoring")

        return text, meta

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

    async def list_documents(
        self, persona_id: UUID, user_id: UUID
    ) -> list[ContextDocument]:
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
                "generated_at": persona.briefing_generated_at.isoformat()
                if persona.briefing_generated_at
                else None,
            }

        docs = await self.repository.list_recent_by_persona(persona_id, user_id, limit)
        if not docs:
            return {
                "briefing": "No previous context or emails uploaded for this persona yet.",
                "sources": 0,
                "cached": False,
            }

        texts = [d.content for d in docs if d.content]
        briefing = await summarize_context(
            texts, persona.name or "", persona.role or ""
        )

        persona = await self.persona_repository.update_briefing_cache(persona, briefing)

        return {
            "briefing": briefing,
            "sources": len(docs),
            "cached": False,
            "generated_at": persona.briefing_generated_at.isoformat()
            if persona.briefing_generated_at
            else None,
        }

    async def search_context(
        self, query: str, persona_id: UUID, user_id: UUID, top_k: int = 3
    ) -> list[ContextDocument]:
        try:
            query_embedding = await generate_embedding(query)
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to embed query")
        return await self.repository.search_by_embedding(
            persona_id, user_id, query_embedding, top_k
        )
