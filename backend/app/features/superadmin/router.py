from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.database import get_db
from app.core.security import require_role
from app.features.auth.models import User
from .service import SuperadminService
from .schemas import UsersListResponse, AIModelsResponse, ModelConfigUpdate

router = APIRouter(prefix="/api/v1/superadmin", tags=["superadmin"])


def get_service(db: AsyncSession = Depends(get_db)) -> SuperadminService:
    return SuperadminService(db)


# ── Users ───────────────────────────────────────────────────────────────────

@router.get("/users", response_model=UsersListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    role: Optional[str] = Query(None),
    _: User = Depends(require_role("superadmin")),
    service: SuperadminService = Depends(get_service),
):
    return await service.list_users(page=page, limit=limit, search=search, role=role)


# ── AI Models ────────────────────────────────────────────────────────────────

@router.get("/ai/models", response_model=AIModelsResponse)
async def get_ai_models(
    _: User = Depends(require_role("superadmin")),
    service: SuperadminService = Depends(get_service),
):
    current = await service.get_live_model()
    return {
        "current": {
            "config_key": current.config_key,
            "model_id": current.model_id,
            "settings": current.settings,
            "updated_at": current.updated_at,
        },
        "available": service.get_available_models(),
    }


@router.put("/ai/models", response_model=AIModelsResponse)
async def update_ai_model(
    body: ModelConfigUpdate,
    current_user: User = Depends(require_role("superadmin")),
    service: SuperadminService = Depends(get_service),
):
    config = await service.update_live_model(
        model_id=body.model_id,
        settings=body.settings.model_dump() if body.settings else None,
        updated_by=current_user.id,
    )
    return {
        "current": {
            "config_key": config.config_key,
            "model_id": config.model_id,
            "settings": config.settings,
            "updated_at": config.updated_at,
        },
        "available": service.get_available_models(),
    }
