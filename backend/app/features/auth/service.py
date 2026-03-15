from fastapi import HTTPException, status
from .schemas import UserCreate, Token
from .repository import AuthRepository
from .models import User
from app.core.security import verify_password, create_access_token
import uuid

class AuthService:
    def __init__(self, repository: AuthRepository):
        self.repository = repository

    async def register_user(self, user_in: UserCreate) -> User:
        existing_user = await self.repository.get_user_by_email(user_in.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered."
            )
        return await self.repository.create_user(user_in)

    async def authenticate_user(self, email: str, password: str) -> Token:
        user = await self.repository.get_user_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user."
            )
        
        access_token = create_access_token(subject=user.id)
        return Token(access_token=access_token, token_type="bearer")

    async def get_user_by_id(self, user_id: uuid.UUID) -> User:
        user = await self.repository.get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user",
            )
        return user
