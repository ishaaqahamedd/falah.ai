from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
import jwt
import uuid
from typing import Annotated, Optional

from app.db.database import get_db
from app.core.config import settings
from .schemas import UserResponse, Token, TokenPayload, GoogleAuthRequest
from .service import AuthService
from .repository import AuthRepository
from .models import User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
limiter = Limiter(key_func=get_remote_address)

COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # seconds
IS_PROD = settings.ENVIRONMENT == "production"


def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(repository=AuthRepository(db))


async def get_current_user(
    request: Request,
    bearer_token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Try httpOnly cookie first, fall back to Authorization header
    token = request.cookies.get(COOKIE_NAME) or bearer_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
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


def _set_auth_cookie(response: Response, token: str) -> None:
    """Set the httpOnly auth cookie on the response."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=IS_PROD,
        samesite="lax",
    )


@router.post("/google", response_model=Token)
@limiter.limit("10/minute")
async def google_auth(
    request: Request,
    response: Response,
    body: GoogleAuthRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    result = await auth_service.authenticate_google(body.credential)
    _set_auth_cookie(response, result.access_token)
    return result


@router.post("/logout")
async def logout(response: Response):
    """Clear the auth cookie."""
    response.delete_cookie(
        key=COOKIE_NAME, httponly=True, secure=IS_PROD, samesite="lax"
    )
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user
