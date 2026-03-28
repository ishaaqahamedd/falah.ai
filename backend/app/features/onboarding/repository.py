import logging
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import User

logger = logging.getLogger("onboarding-repository")


class OnboardingRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_user_by_id(self, user_id: str) -> User | None:
        return await self._session.get(User, user_id)

    async def update_progress(
        self,
        user: User,
        step: str,
        status: str,
        completed_at: datetime | None = None,
    ) -> User:
        user.onboarding_step = step
        user.onboarding_status = status
        if completed_at:
            user.onboarding_completed_at = completed_at
        await self._session.commit()
        await self._session.refresh(user)
        return user

    async def save_summary(self, user: User, summary: str) -> User:
        user.onboarding_summary = summary
        await self._session.commit()
        return user
