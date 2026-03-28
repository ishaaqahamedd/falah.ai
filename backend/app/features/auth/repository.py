from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional
import uuid

from .models import User
from .schemas import UserCreate
from app.core.security import get_password_hash


class AuthRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_user_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_by_google_id(self, google_id: str) -> Optional[User]:
        result = await self.session.execute(
            select(User).where(User.google_id == google_id)
        )
        return result.scalar_one_or_none()

    async def create_user(self, user_in: UserCreate) -> User:
        db_user = User(
            email=user_in.email,
            full_name=user_in.full_name,
            password_hash=get_password_hash(user_in.password),
        )
        self.session.add(db_user)
        await self.session.commit()
        await self.session.refresh(db_user)
        return db_user

    async def create_google_user(
        self, email: str, full_name: str, google_id: str
    ) -> User:
        db_user = User(
            email=email,
            full_name=full_name,
            password_hash=None,
            auth_provider="google",
            google_id=google_id,
        )
        self.session.add(db_user)
        await self.session.commit()
        await self.session.refresh(db_user)
        return db_user

    async def link_google_account(self, user: User, google_id: str) -> User:
        user.google_id = google_id
        await self.session.commit()
        await self.session.refresh(user)
        return user
