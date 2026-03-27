# Falah.ai Conventions

> This file is the **first thing an AI coding assistant should read** before making any changes. It defines naming patterns, architectural rules, and anti-patterns specific to this codebase.

## Project Structure

```
falah/
├── backend/app/         # FastAPI backend
│   ├── core/            # Config (Pydantic Settings), security (JWT/bcrypt)
│   ├── db/              # SQLAlchemy async engine & session
│   └── features/        # Modular business logic (auth, personas, sessions, livekit, onboarding, context)
├── frontend/src/        # React SPA (Feature-Sliced Design)
│   ├── app/             # Router, layouts, ProtectedRoute
│   ├── pages/           # Route-level page components
│   ├── features/        # Feature modules (API clients, stores)
│   ├── widgets/         # Composite UI blocks
│   ├── entities/        # Domain types & constants
│   └── shared/          # Reusable UI components & utilities
├── docs/                # Structured documentation (you are here)
└── .agents/             # AI agent skills and workflows
```

## Backend Conventions

### Feature Module Pattern
Every backend feature lives in `backend/app/features/<name>/` and follows this structure:
- `models.py` — SQLAlchemy models
- `schemas.py` — Pydantic request/response schemas
- `router.py` — FastAPI router with endpoints
- `service.py` — Business logic
- `repository.py` — Database queries

**DO NOT** put business logic in routers. Routers only validate input and delegate to services.

### Naming
- Files: `snake_case.py`
- Classes: `PascalCase`
- Functions/variables: `snake_case`
- API prefixes: `/api/v1/<feature>`
- Router tags match the feature name

### Auth Pattern
All protected endpoints use: `current_user: Annotated[User, Depends(get_current_user)]`

### Database
- All operations are async (`await`)
- Use `AsyncSession` from `get_db()` dependency
- UUIDs as primary keys (auto-generated)
- Timestamps use `server_default=func.now()`
- JSONB for flexible structured data (transcripts, scorecards, metadata)

## Frontend Conventions

### FSD Layer Rules
- `pages/` components import from `features/`, `widgets/`, `shared/`
- `features/` modules import from `entities/`, `shared/`
- `shared/` NEVER imports from `features/` or `pages/`

### API Calls
- All API calls go through feature-specific API client files (e.g., `features/sessions/api.js`)
- Always include `Authorization: Bearer <token>` header
- Base URL from `VITE_API_URL` env var

### State
- Zustand stores per feature (not global state)
- Auth state in `features/auth/` store

## Anti-Patterns (DO NOT DO)

- ❌ Do NOT use synchronous DB drivers (psycopg2). Always use asyncpg.
- ❌ Do NOT import between feature modules at the model level (use IDs/UUIDs to reference).
- ❌ Do NOT put Gemini API calls in routers. All AI logic goes in services or the agent worker.
- ❌ Do NOT hardcode API URLs in frontend components. Use the env var.
- ❌ Do NOT create new top-level routers without registering them in `main.py`.
- ❌ Do NOT block the event loop with `time.sleep()`. Use `asyncio.sleep()`.

## Configuration

All backend config is in `backend/app/core/config.py` via Pydantic `BaseSettings`. Key tuning params:

| Setting | Default | Purpose |
|---------|---------|---------|
| `CONTEXT_TRIGGER_TOKENS` | 90000 | Start compressing Gemini context window |
| `CONTEXT_TARGET_TOKENS` | 45000 | Compress down to this target |
| `THINKING_BUDGET` | 128 | Gemini reasoning budget (128=fast, 0=off, -1=auto) |
| `VIDEO_INTERVAL_DIRECT` | 2.0s | Min seconds between screen share frames |
| `MAX_BRIEFING_CHARS` | 2000 | Max briefing text injected into prompts |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 10080 | JWT expiry (7 days for dev) |
