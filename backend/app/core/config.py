from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import PostgresDsn
from typing import Optional

class Settings(BaseSettings):
    GOOGLE_API_KEY: str
    GOOGLE_CLIENT_ID: Optional[str] = None
    LIVEKIT_URL: str
    LIVEKIT_API_KEY: str
    LIVEKIT_API_SECRET: str
    DATABASE_URL: str
    
    # Custom JWT Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days for dev

    # Production settings
    CORS_ORIGINS: str = "http://localhost:5173"  # comma-separated origins
    ENVIRONMENT: str = "development"  # "development" | "production"

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
