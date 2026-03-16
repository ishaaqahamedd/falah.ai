from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import PostgresDsn
from typing import Optional

class Settings(BaseSettings):
    GOOGLE_API_KEY: str
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

    # Context window management (Gemini sliding window compression)
    CONTEXT_TRIGGER_TOKENS: int = 90000   # Start compressing at ~70% of 128K
    CONTEXT_TARGET_TOKENS: int = 45000    # Compress down to ~35% of 128K

    # Video frame management
    VIDEO_SPEAKING_FPS: float = 0.5       # Frames/sec while user talks
    VIDEO_SILENT_FPS: float = 0.2         # Frames/sec while silent
    VIDEO_INTERVAL_DIRECT: float = 2.0    # Min seconds between frames (direct WS path)

    # System instruction limits
    MAX_BRIEFING_CHARS: int = 2000        # ~500 tokens
    MAX_CRM_CHARS: int = 1000             # ~250 tokens

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
