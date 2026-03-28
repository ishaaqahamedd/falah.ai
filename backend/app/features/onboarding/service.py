import logging
from datetime import datetime, timezone

from app.features.auth.models import User
from app.db.database import AsyncSessionLocal
from .repository import OnboardingRepository

logger = logging.getLogger("onboarding-service")

VALID_STEPS = {"welcome", "explore_ui", "create_first_agent", "first_session"}
VALID_STATUSES = {"in_progress", "completed", "skipped"}


class OnboardingService:
    def __init__(self, repository: OnboardingRepository):
        self.repository = repository

    async def update_progress(self, user: User, step: str, status: str) -> User:
        if step not in VALID_STEPS:
            raise ValueError(f"Invalid onboarding step: {step}")
        if status not in VALID_STATUSES:
            raise ValueError(f"Invalid onboarding status: {status}")

        completed_at = None
        if status == "completed" and step == "first_session":
            completed_at = datetime.now(timezone.utc)
        elif status == "skipped":
            completed_at = datetime.now(timezone.utc)

        return await self.repository.update_progress(user, step, status, completed_at)


async def save_onboarding_summary(user_id: str, summary: str):
    """Save AI-generated onboarding session summary to user record.

    Standalone function (no DI) for use from the LiveKit agent worker.
    """
    async with AsyncSessionLocal() as db:
        repo = OnboardingRepository(db)
        user = await repo.get_user_by_id(user_id)
        if user:
            await repo.save_summary(user, summary)
            logger.info(f"[Onboarding] Summary saved for user {user_id}")
        else:
            logger.warning(
                f"[Onboarding] User {user_id} not found — skipping summary save"
            )
