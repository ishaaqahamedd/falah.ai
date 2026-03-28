# 3-Layer Architecture Refactoring Plan

> **Purpose:** Bring the remaining 3 backend modules (context, onboarding, livekit) into full compliance with the Router → Service → Repository pattern.
> **Date:** 2026-03-28
> **Status:** ✅ COMPLETE

---

## Current State

| Module | Router | Service | Repository | Models | Schemas | Verdict |
|--------|--------|---------|------------|--------|---------|---------|
| auth | ✅ | ✅ | ✅ | ✅ | ✅ | **Compliant** |
| personas | ✅ | ✅ | ✅ | ✅ | ✅ | **Compliant** |
| sessions | ✅ | ✅ | ✅ | ✅ | ✅ | **Compliant** |
| **context** | ⚠️ | ✅ | ✅ | ✅ | ✅ | Validation logic in router |
| **onboarding** | ✅ | ⚠️ | ❌ | ❌ | ✅ | No repository, service hits DB directly |
| **livekit** | ✅ | ⚠️ | ❌ | ❌ | ❌ | No repo/schemas, db_helpers creates own engine |

---

## Module 1: context (LOW RISK) ✅

### Problem
`context/router.py` lines 46–64 contain business logic:
- File size validation (`MAX_UPLOAD_SIZE`)
- Content type check (`ALLOWED_CONTENT_TYPES`)
- UTF-8 decode
- JSON metadata parsing

Router also builds inline dict responses instead of using the existing Pydantic schemas in `schemas.py`.

### Changes

#### `context/service.py`
- Add `validate_and_extract_text(content: bytes, content_type: str | None, metadata_json: str) -> tuple[str, dict]` to `ContextService`
- Move `MAX_UPLOAD_SIZE` and `ALLOWED_CONTENT_TYPES` constants from router into service

#### `context/router.py`
- Upload endpoint becomes: `content = await file.read()` → `service.validate_and_extract_text()` → `service.upload_document()` → return Pydantic model
- Remove `import json`, all constants, all inline validation logic
- Add `response_model=` to all 4 endpoints

#### `context/schemas.py`
- Add `ContextDocumentListItem` (id, filename, content_type, created_at)
- Add `ContextSearchResult` (id, content, filename)
- Add `BriefingResponse` (briefing, sources, cached, generated_at)
- Update `ContextDocumentResponse` to handle content truncation

### Files Touched
- `context/service.py` — add method + constants
- `context/router.py` — thin down to HTTP-only
- `context/schemas.py` — add response models

---

## Module 2: onboarding (MEDIUM RISK) ✅

### Problem
- `OnboardingService` takes raw `AsyncSession` and directly mutates User fields + commits
- No `repository.py` — violates 3-layer separation
- Standalone `save_onboarding_summary()` uses `AsyncSessionLocal` directly (workaround for LiveKit agent worker)

### Changes

#### `onboarding/repository.py` (NEW)
```python
class OnboardingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def update_progress(self, user, step, status, completed_at=None) -> User
    async def save_summary(self, user, summary) -> User
    async def get_user_by_id(self, user_id) -> User | None
```

#### `onboarding/service.py`
- Constructor: `__init__(self, repository: OnboardingRepository)` instead of `__init__(self, db)`
- `update_progress` keeps validation (VALID_STEPS, VALID_STATUSES), delegates DB write to `self.repository`
- Standalone `save_onboarding_summary()`: create `OnboardingRepository(db)` inside the `AsyncSessionLocal` context, route through repo

#### `onboarding/router.py`
- DI factory: `OnboardingService(repository=OnboardingRepository(db))` instead of `OnboardingService(db)`

### Files Touched
- `onboarding/repository.py` — NEW
- `onboarding/service.py` — refactor to use repository
- `onboarding/router.py` — update DI factory

### Note
No `models.py` needed — onboarding fields live on the `User` model in `auth/models.py`. Reusing cross-module models is acceptable when the module doesn't own a table.

---

## Module 3: livekit (HIGHER RISK — real-time pipeline) ✅

### Problem
- `db_helpers.py` creates its own SQLAlchemy engine per call, duplicating `database.py` logic
- No repository, no schemas
- Business logic scattered across `service.py`, `agent.py`, `db_helpers.py`, `handlers/`

### Key Constraint
The LiveKit agent worker (`agent.py`, `handlers/`) runs via `livekit-agents start` as a **separate process**. It has NO access to FastAPI dependency injection. It genuinely needs standalone DB sessions. The repository must support both modes:
1. **FastAPI DI mode** — accepts `AsyncSession` from `get_db()`
2. **Agent worker mode** — creates its own engine via `create_standalone()` context manager

### Changes

#### `livekit/repository.py` (NEW)
```python
class LivekitRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    @classmethod
    @asynccontextmanager
    async def create_standalone(cls):
        """Self-contained session for agent worker (no FastAPI DI)."""
        # Creates engine from settings.DATABASE_URL, yields repo, disposes engine

    async def save_session(user_id, persona_id, persona_snapshot, transcript, duration_seconds)
    async def update_session(session_id, transcript, duration_seconds)
    async def save_onboarding_summary(user_id, summary)
```

This replaces all 3 functions + the `_create_agent_session()` / `_get_async_db_url()` helpers in `db_helpers.py`.

#### `livekit/schemas.py` (NEW)
```python
class TokenResponse(BaseModel):
    token: str
    room: str
```

#### `livekit/handlers/session_handler.py`
- Replace `from db_helpers import save_session_to_db, update_session_in_db`
- In `on_shutdown`: `async with LivekitRepository.create_standalone() as repo:` → `repo.save_session()` / `repo.update_session()`

#### `livekit/handlers/onboarding_handler.py`
- Replace `from db_helpers import save_onboarding_summary`
- In `on_shutdown`: `async with LivekitRepository.create_standalone() as repo:` → `repo.save_onboarding_summary()`

#### `livekit/router.py`
- Add `response_model=TokenResponse` to both endpoints
- Import from `.schemas`

#### `livekit/db_helpers.py` → DELETE
After all callers migrated to `LivekitRepository`.

### NOT Touched (real-time pipeline — 9/10 score)
- `agent.py` — no db_helpers imports, no changes needed
- `personas/` — config/prompts, no changes
- `vision/` — screen capture, no changes
- Handler behavior logic (nudges, auto-end, screen share) — no changes

### Files Touched
- `livekit/repository.py` — NEW
- `livekit/schemas.py` — NEW
- `livekit/handlers/session_handler.py` — switch to repository
- `livekit/handlers/onboarding_handler.py` — switch to repository
- `livekit/router.py` — add response_model
- `livekit/db_helpers.py` — DELETE

---

## Execution Order

```
1. context   (LOW)    — move code between existing files, add schemas
2. onboarding (MEDIUM) — one new file, straightforward extraction
3. livekit   (HIGHER) — two new files, one deletion, handler updates
```

## Verification

1. **Existing tests**: `cd backend && python -m pytest tests/ -v`
2. **Manual API check**: hit `/api/v1/livekit/token`, `/api/v1/context/upload`, `/api/v1/onboarding/progress`
3. **Agent worker**: run `livekit-agents start` and verify session save + onboarding summary still persist to DB
4. **Frontend**: no changes needed — response shapes are preserved

## Post-Refactoring State

| Module | Router | Service | Repository | Models | Schemas | Verdict |
|--------|--------|---------|------------|--------|---------|---------|
| auth | ✅ | ✅ | ✅ | ✅ | ✅ | Compliant |
| personas | ✅ | ✅ | ✅ | ✅ | ✅ | Compliant |
| sessions | ✅ | ✅ | ✅ | ✅ | ✅ | Compliant |
| **context** | ✅ | ✅ | ✅ | ✅ | ✅ | **Compliant** |
| **onboarding** | ✅ | ✅ | ✅ | N/A | ✅ | **Compliant** |
| **livekit** | ✅ | ✅ | ✅ | N/A | ✅ | **Compliant** |

> N/A for models = module doesn't own a DB table (reuses auth/sessions models). This is acceptable.
