from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
import jwt
import uuid
from typing import Annotated

from app.db.database import get_db
from app.core.config import settings
from .schemas import UserCreate, UserResponse, Token, TokenPayload, GoogleAuthRequest
from .service import AuthService
from .repository import AuthRepository
from .models import User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(repository=AuthRepository(db))

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db)
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    auth_service = AuthService(repository=AuthRepository(db))
    return await auth_service.get_user_by_id(uuid.UUID(token_data.sub))

# Manual auth routes commented out — Google OAuth only for now
# @router.post("/register", response_model=UserResponse)
# async def register(
#     user_in: UserCreate,
#     auth_service: AuthService = Depends(get_auth_service)
# ):
#     return await auth_service.register_user(user_in)

# @router.post("/login", response_model=Token)
# async def login(
#     form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
#     auth_service: AuthService = Depends(get_auth_service)
# ):
#     return await auth_service.authenticate_user(form_data.username, form_data.password)

@router.post("/google", response_model=Token)
async def google_auth(
    body: GoogleAuthRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    return await auth_service.authenticate_google(body.credential)

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user
