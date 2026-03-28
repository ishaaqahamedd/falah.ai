from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.router import get_current_user
from app.features.auth.models import User
from app.db.database import get_db
from .schemas import OnboardingProgressUpdate
from .service import OnboardingService

router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])


def get_onboarding_service(db: AsyncSession = Depends(get_db)) -> OnboardingService:
    return OnboardingService(db)


@router.patch("/progress")
async def update_onboarding_progress(
    body: OnboardingProgressUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    service: OnboardingService = Depends(get_onboarding_service),
):
    try:
        user = await service.update_progress(current_user, body.step, body.status)
        return {
            "onboarding_status": user.onboarding_status,
            "onboarding_step": user.onboarding_step,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
