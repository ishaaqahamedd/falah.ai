from fastapi import HTTPException, status
from .schemas import UserCreate, Token
from .repository import AuthRepository
from .models import User
from app.core.security import verify_password, create_access_token
from app.core.config import settings
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import uuid
import logging

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, repository: AuthRepository):
        self.repository = repository

    async def register_user(self, user_in: UserCreate) -> User:
        existing_user = await self.repository.get_user_by_email(user_in.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered.",
            )
        return await self.repository.create_user(user_in)

    async def authenticate_user(self, email: str, password: str) -> Token:
        user = await self.repository.get_user_by_email(email)
        if (
            not user
            or not user.password_hash
            or not verify_password(password, user.password_hash)
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user."
            )

        access_token = create_access_token(subject=user.id)
        return Token(access_token=access_token, token_type="bearer")

    async def authenticate_google(self, credential: str) -> Token:
        try:
            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
        except ValueError as e:
            logger.error(f"Google token verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google credentials",
            )
        except Exception as e:
            logger.error(f"Google auth unexpected error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google credentials",
            )

        if not idinfo.get("email_verified"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google email not verified",
            )

        google_id = idinfo["sub"]
        email = idinfo["email"]
        full_name = idinfo.get("name", email.split("@")[0])

        # 1. Try lookup by google_id
        user = await self.repository.get_user_by_google_id(google_id)

        if not user:
            # 2. Try lookup by email (link existing local account)
            user = await self.repository.get_user_by_email(email)
            if user:
                user = await self.repository.link_google_account(user, google_id)
            else:
                # 3. Create new Google user
                user = await self.repository.create_google_user(
                    email, full_name, google_id
                )

        # Auto-promote to superadmin if email matches env variable
        if (
            settings.SUPERADMIN_EMAIL
            and user.email == settings.SUPERADMIN_EMAIL
            and user.role != "superadmin"
        ):
            user = await self.repository.update_role(user, "superadmin")

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user.",
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
