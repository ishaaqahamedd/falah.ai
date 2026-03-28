from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
import logging
from dotenv import load_dotenv

load_dotenv()

from app.core.config import settings

# Rate limiter — keyed by remote IP address
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
from app.features.auth.router import router as auth_router
from app.features.livekit.router import router as livekit_router
from app.features.personas.router import router as personas_router
from app.features.context.router import router as context_router
from app.features.sessions.router import router as sessions_router
from app.features.onboarding.router import router as onboarding_router

# Configure structured logging
from app.core.logging import setup_logging
setup_logging(production=settings.ENVIRONMENT == "production")
logger = logging.getLogger(__name__)

app = FastAPI()

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — driven by CORS_ORIGINS env var
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

# OpenTelemetry — opt-in via OTEL_EXPORTER_OTLP_ENDPOINT
from app.core.telemetry import setup_telemetry
setup_telemetry(app)

app.include_router(auth_router)
app.include_router(livekit_router)
app.include_router(personas_router)
app.include_router(context_router)
app.include_router(sessions_router)
app.include_router(onboarding_router)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Falah.ai backend is running."}


@app.get("/health")
async def health_check():
    """Deep health check — verifies database connectivity."""
    from app.db.database import AsyncSessionLocal

    checks: dict[str, str] = {}
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"

    status = "healthy" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": status, "checks": checks}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
