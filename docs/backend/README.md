# Backend Documentation

This folder contains documentation for all backend implementations, API specs, and architecture decisions.

## Files

| File | Description | Status |
|------|-------------|--------|
| *(Add files as backend features are documented)* | | |

> **Rule:** Add new docs here whenever a backend feature is built, an API is designed, or a data model changes.

## Backend Feature Modules

The backend follows a **3-Layer Architecture** per feature module inside `backend/app/features/`:

| Module | Files | Purpose |
|--------|-------|---------|
| `auth/` | models, schemas, router, service, repository | Google OAuth, JWT token generation, user management |
| `personas/` | models, schemas, router, service, repository, templates | AI persona CRUD, community sharing, starter templates |
| `sessions/` | models, schemas, router, service, repository | Session tracking, transcript storage, AI scoring + summary |
| `livekit/` | agent, router, service, db_helpers, handlers/, personas/, vision/ | LiveKit agent worker, WebRTC token generation, Gemini Live session orchestration |
| `onboarding/` | router, service, schemas, prompts | Voice-guided onboarding flow, step tracking |
| `context/` | models, schemas, router, service, repository | Document upload, pgvector embeddings, semantic search, pre-call briefings |

## Core Modules

| Module | Purpose |
|--------|---------|
| `app/core/config.py` | Pydantic Settings — all env vars with defaults |
| `app/core/security.py` | JWT creation + bcrypt password hashing |
| `app/db/database.py` | SQLAlchemy async engine, session factory, `get_db()` dependency |

## Entrypoints

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app init, CORS config, router registration, legacy WebSocket endpoint |
| `app/features/livekit/agent.py` | LiveKit agent worker — runs as a separate process, joins WebRTC rooms |
