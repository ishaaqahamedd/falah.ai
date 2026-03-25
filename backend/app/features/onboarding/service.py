import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import User
from app.db.database import AsyncSessionLocal

logger = logging.getLogger("onboarding-service")

VALID_STEPS = {"welcome", "explore_ui", "create_first_agent", "first_session"}
VALID_STATUSES = {"in_progress", "completed", "skipped"}


class OnboardingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def update_progress(self, user: User, step: str, status: str) -> User:
        if step not in VALID_STEPS:
            raise ValueError(f"Invalid onboarding step: {step}")
        if status not in VALID_STATUSES:
            raise ValueError(f"Invalid onboarding status: {status}")

        user.onboarding_step = step
        user.onboarding_status = status

        if status == "completed" and step == "first_session":
            user.onboarding_completed_at = datetime.now(timezone.utc)

        if status == "skipped":
            user.onboarding_completed_at = datetime.now(timezone.utc)

        await self.db.commit()
        await self.db.refresh(user)
        return user


async def save_onboarding_summary(user_id: str, summary: str):
    """Save AI-generated onboarding session summary to user record.

    Standalone function (no DI) for use from the LiveKit agent worker.
    """
    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if user:
            user.onboarding_summary = summary
            await db.commit()
            logger.info(f"[Onboarding] Summary saved for user {user_id}")
        else:
            logger.warning(f"[Onboarding] User {user_id} not found — skipping summary save")
