from pydantic import BaseModel


class OnboardingProgressUpdate(BaseModel):
    step: str
    status: str  # "in_progress" | "completed" | "skipped"
