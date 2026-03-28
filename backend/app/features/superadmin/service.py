from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import Optional
import uuid

from app.features.auth.models import User
from app.features.sessions.models import PitchSession
from app.features.personas.models import Persona
from .models import AIModelConfig
from .model_registry import (
    DEFAULT_MODEL_ID,
    get_available_models,
    get_default_settings,
    is_valid_model,
    validate_settings,
)


class SuperadminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Users ──────────────────────────────────────────────────────────────

    async def list_users(
        self,
        page: int = 1,
        limit: int = 20,
        search: str = "",
        role: Optional[str] = None,
    ):
        offset = (page - 1) * limit

        session_count_sq = (
            select(func.count(PitchSession.id))
            .where(PitchSession.user_id == User.id)
            .correlate(User)
            .scalar_subquery()
        )
        agent_count_sq = (
            select(func.count(Persona.id))
            .where(Persona.user_id == User.id)
            .correlate(User)
            .scalar_subquery()
        )

        query = select(
            User,
            session_count_sq.label("session_count"),
            agent_count_sq.label("agent_count"),
        )

        if search:
            query = query.where(
                (User.email.ilike(f"%{search}%")) | (User.full_name.ilike(f"%{search}%"))
            )
        if role:
            query = query.where(User.role == role)

        count_query = select(func.count()).select_from(User)
        if search:
            count_query = count_query.where(
                (User.email.ilike(f"%{search}%")) | (User.full_name.ilike(f"%{search}%"))
            )
        if role:
            count_query = count_query.where(User.role == role)

        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        query = query.order_by(User.created_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        rows = result.all()

        users = []
        for row in rows:
            user = row[0]
            users.append({
                "id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "auth_provider": user.auth_provider,
                "created_at": user.created_at,
                "session_count": row[1] or 0,
                "agent_count": row[2] or 0,
            })

        return {"users": users, "total": total, "page": page, "limit": limit}

    # ── AI Model Config ─────────────────────────────────────────────────────

    async def get_live_model(self) -> AIModelConfig:
        """Fetch the current live model config, seeding the default if missing."""
        result = await self.db.execute(
            select(AIModelConfig).where(AIModelConfig.config_key == "live_agent_model")
        )
        config = result.scalar_one_or_none()

        if not config:
            default_settings = get_default_settings(DEFAULT_MODEL_ID)
            config = AIModelConfig(
                config_key="live_agent_model",
                model_id=DEFAULT_MODEL_ID,
                settings=default_settings,
            )
            self.db.add(config)
            await self.db.commit()
            await self.db.refresh(config)

        return config

    async def update_live_model(
        self,
        model_id: str,
        settings: Optional[dict],
        updated_by: uuid.UUID,
    ) -> AIModelConfig:
        """
        Validate and persist a new model + settings selection.
        Raises HTTP 400 if model_id is unknown or settings are invalid.
        """
        from fastapi import HTTPException, status

        if not is_valid_model(model_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown model: '{model_id}'. Add it to model_registry.py first.",
            )

        # Fill missing settings with registry defaults
        resolved_settings = get_default_settings(model_id)
        if settings:
            resolved_settings.update({k: v for k, v in settings.items() if v is not None})

        errors = validate_settings(model_id, resolved_settings)
        if errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Invalid model settings.", "errors": errors},
            )

        result = await self.db.execute(
            select(AIModelConfig).where(AIModelConfig.config_key == "live_agent_model")
        )
        config = result.scalar_one_or_none()

        if config:
            config.model_id = model_id
            config.settings = resolved_settings
            config.updated_by = updated_by
        else:
            config = AIModelConfig(
                config_key="live_agent_model",
                model_id=model_id,
                settings=resolved_settings,
                updated_by=updated_by,
            )
            self.db.add(config)

        await self.db.commit()
        await self.db.refresh(config)
        return config

    def get_available_models(self) -> list[dict]:
        """Return all models from the registry for the superadmin UI."""
        return get_available_models()
