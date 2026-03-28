# Production Readiness: 7.5 → 10/10

> **Purpose:** Close the 5 remaining gaps blocking full production readiness before Phase 2 features (Live RAG, MCP, Super Admin, Chrome Extension).
> **Date:** 2026-03-28
> **Status:** PENDING

---

## Current Score: 7.5/10

| Area | Score | Status |
|------|-------|--------|
| Architecture (3-layer BE, FSD FE) | 9/10 | Done |
| Code Quality | 9/10 | Done |
| CI/CD | 8/10 | Done |
| DevOps (Docker, logging, OTel) | 8/10 | Done |
| **Test suite broken (SQLite/JSONB)** | 0/10 | Blocked |
| **Test coverage** | 4/10 | Gaps |
| **Health endpoint** | 5/10 | Bug |
| **FSD compliance** | 9/10 | Minor |
| **Error UX** | 3/10 | Missing |

---

## Execution Order

| # | Gap | Priority | Effort | Depends On |
|---|-----|----------|--------|------------|
| 1 | SQLite/JSONB test fix | P0 blocker | 15 min | — |
| 2 | Health endpoint 503 | P0 | 10 min | — |
| 3 | Test expansion (BE + FE) | P1 | 1–2 hrs | Gap 1 |
| 4 | FSD types/ move | P2 | 15 min | — |
| 5 | Error toast system | P2 | 30 min | — |

---

## Gap 1: SQLite/JSONB Test Compatibility (BLOCKER)

### Problem
`Base.metadata.create_all` crashes because SQLite has no JSONB or pgvector Vector type. **All 20 backend tests fail before executing.**

**Affected columns (7 total):**
- `personas.scoring_criteria` (JSONB)
- `personas.behavior_rules` (JSONB)
- `pitch_sessions.persona_snapshot` (JSONB)
- `pitch_sessions.transcript` (JSONB)
- `pitch_sessions.scorecard` (JSONB)
- `context_documents.metadata_` (JSONB)
- `context_documents.embedding` (pgvector Vector(3072))

### Fix
Register SQLAlchemy compiler hooks in conftest that map JSONB→JSON and Vector→TEXT for SQLite dialect. Zero changes to production models.

### File: `backend/tests/conftest.py`
Add at module top (before model imports):
```python
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector

@compiles(JSONB, "sqlite")
def _jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

@compiles(Vector, "sqlite")
def _vector_sqlite(type_, compiler, **kw):
    return "TEXT"
```

### Trade-off
pgvector L2 distance queries won't work in tests (TEXT column). Context search tests must mock the repository. Acceptable — pgvector semantics belong in integration tests against real PostgreSQL.

### Files Touched
- `backend/tests/conftest.py` — add compiler hooks

---

## Gap 2: Health Endpoint Returns 503 on Degraded

### Problem
`/health` returns HTTP 200 even when database is unreachable. Cloud Run health checks won't detect failures and will keep routing traffic to sick instances.

### Fix

#### `backend/main.py`
- Import `JSONResponse` from `fastapi.responses`
- Change return:
```python
if status == "healthy":
    return {"status": status, "checks": checks}
return JSONResponse(content={"status": status, "checks": checks}, status_code=503)
```

#### `backend/tests/test_health.py`
- Add `test_health_degraded`: patch `AsyncSessionLocal` to raise, assert 503

### Files Touched
- `backend/main.py` — fix status code
- `backend/tests/test_health.py` — add degraded test

---

## Gap 3: Test Expansion

**Depends on:** Gap 1 (tests must run first).

### Backend: New test files

#### `backend/tests/test_onboarding.py` (~3 tests)
- `test_update_progress` — PATCH with valid step/status, assert 200
- `test_update_invalid_step` — invalid step, assert 400
- `test_unauthenticated` — anon_client, assert 401

No external mocking needed — onboarding just updates User fields.

#### `backend/tests/test_context.py` (~4 tests)
- `test_upload_document` — mock `generate_embedding` → `[0.0] * 3072`, POST upload, assert 201
- `test_list_documents` — upload then GET list, assert doc appears
- `test_upload_unsupported_type` — content_type `application/zip`, assert 400
- `test_briefing_no_docs` — GET briefing with no docs, assert "no context" message

Mock target: `app.features.context.service.generate_embedding`
Skip: `test_search` (needs pgvector — integration test territory)

#### `backend/tests/test_livekit.py` (~3 tests)
- `test_get_token` — mock `LivekitService.create_room` + `generate_token`, assert 200 with `token` + `room`
- `test_get_onboarding_token` — same mock approach, assert 200
- `test_unauthenticated` — anon_client, assert 401

#### Additions to existing files (~2 tests)
- `test_personas.py`: `test_get_nonexistent_persona` (assert 404)
- `test_sessions.py`: `test_get_nonexistent_session` (assert 404)

**Backend total: 21 → ~34 tests**

### Frontend: New test files

#### `frontend/src/app/ProtectedRoute.test.tsx` (~2 tests)
- `test_redirects_unauthenticated` — no user in store → Navigate to /login
- `test_renders_when_authenticated` — set user, mock fetchCurrentUser → Outlet renders

#### `frontend/src/widgets/scorecard/Scorecard.test.tsx` (~2 tests)
- `test_renders_scores` — pass scorecard data, assert scores visible
- `test_handles_null_scorecard` — pass null, assert fallback state

**Frontend total: 8 → ~12 tests**

### Files Touched
- `backend/tests/test_onboarding.py` — NEW
- `backend/tests/test_context.py` — NEW
- `backend/tests/test_livekit.py` — NEW
- `backend/tests/test_personas.py` — add 1 test
- `backend/tests/test_sessions.py` — add 1 test
- `frontend/src/app/ProtectedRoute.test.tsx` — NEW
- `frontend/src/widgets/scorecard/Scorecard.test.tsx` — NEW

---

## Gap 4: Move `src/types/` → `src/shared/types/` (FSD Fix)

### Problem
`frontend/src/types/` lives at root level, violating FSD layer rules. Types belong in `shared/`.

### Actions
1. Move `src/types/index.ts` → `src/shared/types/index.ts`
2. Move `src/types/google.d.ts` → `src/shared/types/google.d.ts`
3. Delete empty `src/types/` directory
4. Update imports in ~9 files → use `@shared/types` path alias

### Files with import changes
- `widgets/agent-preview-drawer/AgentPreviewDrawer.tsx`
- `widgets/scorecard/Scorecard.tsx`
- `widgets/preflight-drawer/PreFlightDrawer.tsx`
- `features/sessions/hooks.ts`
- `features/personas/PersonaForm.tsx`
- `pages/sessions/SessionsPage.tsx`
- `pages/sessions/SessionDetailPage.tsx`
- `pages/community/CommunityPage.tsx`
- `pages/agents/AgentsPage.tsx`

---

## Gap 5: Error Toast System

### Problem
API errors (4xx/5xx except 401) are silently swallowed. Users get no feedback when operations fail.

### Choice
**sonner** — 4KB, modern animations, Tailwind-compatible, zero-config dark mode. No Zustand wiring needed.

### Changes

#### `frontend/package.json`
- Add dependency: `"sonner": "^2.0.0"`

#### `frontend/src/main.tsx`
- Add `<Toaster position="top-right" richColors closeButton theme="dark" />` as sibling to `<RouterProvider />`

#### `frontend/src/shared/api/client.ts`
- Extend error interceptor (after 401 check):
```typescript
import { toast } from 'sonner';
import { getErrorMessage } from '../lib/api-error';

} else if (error.response?.status >= 400) {
  toast.error(getErrorMessage(error));
}
```

Auto-surfaces all API errors to users without any per-component wiring.

### Files Touched
- `frontend/package.json` — add sonner
- `frontend/src/main.tsx` — mount Toaster
- `frontend/src/shared/api/client.ts` — wire toast into interceptor

---

## Verification

1. **Backend tests green**: `cd backend && python -m pytest tests/ -v --tb=short`
2. **Frontend tests green**: `cd frontend && npm run test`
3. **Health endpoint**: `curl localhost:8000/health` → 200 healthy / 503 degraded
4. **Toast system**: Trigger a 400/500 in browser → toast appears
5. **FSD compliance**: No imports from `../../types` remain; all use `@shared/types`
6. **CI**: Both GitHub Actions pipelines pass

## Post-Fix Score

| Area | Before | After |
|------|--------|-------|
| Test suite | Broken | Green |
| Test coverage | ~30% BE / ~5% FE | ~60% BE / ~15% FE |
| Health endpoint | 200 always | 503 on degraded |
| FSD compliance | 1 violation | Clean |
| Error UX | Silent failures | Toast notifications |
| **Overall** | **7.5/10** | **9.5/10** |

> The remaining 0.5 comes from areas that need real production traffic to validate: connection pool tuning, OTel dashboard setup, and comprehensive integration tests against PostgreSQL. These are operational concerns, not code concerns.
