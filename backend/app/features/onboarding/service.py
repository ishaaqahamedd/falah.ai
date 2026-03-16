from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import User

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
