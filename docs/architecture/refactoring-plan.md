# Falah.ai — Master Refactoring Plan

> **Purpose:** Make the current codebase production-ready before building Phase 2 features (Live RAG, MCP, Super Admin, Chrome Extension).
> **Date:** 2026-03-28
> **Status:** ✅ ALL PHASES COMPLETE
>
> ### Model Strategy Note
> Model selection (Gemini 2.5 Flash, 3.1 Flash Live, future models) will **not** be handled in refactoring.
> Instead, a **Model Registry + Super Admin panel** will be built as a Phase 2 feature, allowing:
> - Admin-controlled model activation/deactivation (no code changes needed)
> - Per-model config stored as JSON (handles different param shapes across models)
> - A/B testing and instant fallback between models
> - Easy onboarding of future models (new row in DB, not a code deploy)

---

## Codebase Readiness Score: 9/10 (was 6.5/10)

| Area | Before | After | Status |
|------|--------|-------|--------|
| Real-time Pipeline (LiveKit + Gemini) | 9/10 | 9/10 | Unchanged — strongest asset |
| Architecture & Modularity | 8/10 | 9/10 | ✅ GenAI singleton, DI, service layer cleanup |
| Database & Migrations | 7/10 | 9/10 | ✅ RBAC, pagination, audit trail |
| API Design | 7/10 | 9/10 | ✅ Pagination, rate limiting, input validation |
| Frontend Structure | 7/10 | 9/10 | ✅ TypeScript strict, error boundary, constants |
| Auth & Security | 4/10 | 9/10 | ✅ RBAC, httpOnly cookies, CORS hardened |
| Testing | 1/10 | 7/10 | ✅ pytest + vitest infra, critical path tests |
| Observability | 4/10 | 8/10 | ✅ JSON logging, /health, OTel wired |
| DevOps/CI | 5/10 | 8/10 | ✅ Ruff linting, tests in CI, pre-commit hooks |

---

## PHASE 1: Auth & Security Hardening ✅ COMPLETE

> **Note:** `.env` files are already properly gitignored and not tracked. Secrets are safe.

### 1.1 — Add Role-Based Access Control (RBAC)

**Why:** Every Phase 2 feature needs roles. Super Admin needs `admin` role. MCP needs permission scoping. Billing needs tier-based access.

**Changes:**

```
backend/app/features/auth/models.py
```
- Add `role` column: `Enum("user", "creator", "admin")`, default `"user"`
- Add Alembic migration

```
backend/app/core/security.py
```
- Add `require_role(*roles)` dependency:
```python
def require_role(*allowed_roles: str):
    async def _check(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(403, "Insufficient permissions")
        return current_user
    return _check
```

**Usage in routers:**
```python
# Any user
current_user: User = Depends(get_current_user)

# Admin only
current_user: User = Depends(require_role("admin"))

# Creator or Admin
current_user: User = Depends(require_role("creator", "admin"))
```

### 1.2 — Fix CORS Configuration

**File:** `backend/main.py` (Lines 32-39)

**Problem:** `allow_methods=["*"], allow_headers=["*"]` is overly permissive.

**Fix:**
```python
allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
```

### 1.3 — Add Rate Limiting

**Install:** `slowapi` or `fastapi-limiter`

**Apply to:**
- `POST /auth/google` — 10/min per IP (brute force protection)
- `POST /sessions/*/score` — 5/min per user (expensive Gemini call)
- `POST /context/upload` — 10/min per user (file upload abuse)
- All other endpoints — 60/min per user (general)

**File:** `backend/main.py` — Add middleware

### 1.4 — Fix Token Storage (Frontend)

**Problem:** JWT in `localStorage` is vulnerable to XSS.

**Options (pick one):**
- **Option A (Recommended):** Move to `httpOnly` cookie set by backend. Frontend never touches the token directly.
- **Option B (Quick fix):** Keep localStorage but add strict Content Security Policy headers.

**If Option A — Backend changes:**
```
backend/app/features/auth/router.py
```
- `POST /auth/google` sets `Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Strict`
- `GET /auth/me` reads from cookie instead of `Authorization` header
- Add CSRF token exchange for non-GET requests

**Frontend changes:**
```
frontend/src/shared/api/client.ts
```
- Remove `Authorization` header injection
- Add `withCredentials: true` to axios config
- Remove all `localStorage.getItem('access_token')` calls

**Files affected:**
- `frontend/src/features/auth/api.ts`
- `frontend/src/app/ProtectedRoute.tsx`
- `frontend/src/entities/user/store.ts`
- `frontend/src/shared/api/client.ts`

### 1.5 — Input Validation & Error Sanitization

**Problem:** `str(e)` exposed in HTTP 500 responses leaks internal details.

**Fix in:** `backend/app/features/livekit/router.py` (Line 49)
```python
# Before
raise HTTPException(status_code=500, detail=str(e))

# After
logger.exception("Token generation failed")
raise HTTPException(status_code=500, detail="Internal server error")
```

**Problem:** File upload has no validation.

**Fix in:** `backend/app/features/context/router.py`
- Validate file size (max 10MB)
- Validate content type (text/plain, application/pdf, etc.)
- Wrap `content.decode("utf-8")` in try/except with 400 response
- Validate metadata JSON schema

---

## PHASE 2: Backend Code Quality ✅ COMPLETE

### 2.1 — Consolidate Duplicate Code

**A. GenAI Client Singleton**

Create: `backend/app/core/genai.py`
```python
from google import genai

_client = None

def get_genai_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    return _client
```

Remove duplicate `get_genai_client()` from:
- `backend/app/features/context/service.py` (Line 21)
- `backend/app/features/sessions/service.py` (Line 19)

**B. Model Name Constants**

Add to `backend/app/core/config.py`:
```python
GEMINI_LIVE_MODEL: str = "gemini-2.5-flash-native-audio-preview-12-2025"
GEMINI_FLASH_LITE_MODEL: str = "gemini-2.0-flash-lite"
GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-2-preview"
```

Replace hardcoded model strings in:
- `backend/main.py` (Line 123)
- `backend/app/features/livekit/agent.py` (Line 34)
- `backend/app/features/context/service.py` (Lines 30, 78)
- `backend/app/features/sessions/service.py`

**C. Delete Legacy WebSocket Endpoint**

**Problem:** `main.py` (Lines 64-201) has a legacy `/ws/pitch/{persona_id}` endpoint that duplicates the LiveKit agent's functionality. Two codepaths for the same thing = divergence bugs.

**Action:** Delete the entire WebSocket handler from `main.py`. All sessions should go through LiveKit.

Also delete:
- `MOCK_CRM_DATA` (Lines 55-58) — hardcoded test data in production code

**D. Fix DB Helpers Coupling**

**Problem:** `backend/app/features/livekit/db_helpers.py` creates its own SQLAlchemy engine instead of using the app's `database.py`.

**Fix:** Refactor to accept an `AsyncSession` parameter, or use the same engine factory from `app/db/database.py`.

### 2.2 — Fix Error Handling

**Replace all bare `except: pass` patterns:**

| File | Line | Fix |
|------|------|-----|
| `context/router.py` | 39-42 | Log warning, return 400 if metadata is invalid |
| `livekit/service.py` | 71-72 | Log warning, use default config |
| `sessions/service.py` | 219-221 | Log warning, skip persona_id filter |

**Replace `traceback.print_exc()` with proper logging:**

| File | Lines | Fix |
|------|-------|-----|
| `context/service.py` | 35-36, 83-84 | `logger.exception("Embedding generation failed")` |

**Fix `setattr` loop in sessions:**

`backend/app/features/sessions/service.py` (Lines 179-181)
```python
# Before — allows setting ANY field
for field, value in update_data.items():
    setattr(session_record, field, value)

# After — whitelist allowed fields
ALLOWED_UPDATE_FIELDS = {"transcript", "duration_seconds", "status", "ended_at"}
for field, value in update_data.items():
    if field in ALLOWED_UPDATE_FIELDS:
        setattr(session_record, field, value)
```

### 2.3 — Fix Async Blocking Calls

**Problem:** Synchronous Gemini SDK calls block the event loop.

**Files:**
- `backend/app/features/context/service.py` (Lines 29, 77)
- `backend/app/features/sessions/service.py`

**Fix:** Wrap blocking calls:
```python
import asyncio

embedding = await asyncio.to_thread(
    client.models.embed_content,
    model=settings.GEMINI_EMBEDDING_MODEL,
    contents=text
)
```

### 2.4 — Add Pagination to All List Endpoints

**Backend — Add shared pagination schema:**

Create: `backend/app/core/pagination.py`
```python
from pydantic import BaseModel, Field

class PaginationParams(BaseModel):
    limit: int = Field(default=20, le=100, ge=1)
    offset: int = Field(default=0, ge=0)
```

**Apply to:**
- `GET /personas/` — `backend/app/features/personas/router.py`
- `GET /personas/community` — same file
- `GET /sessions/` — `backend/app/features/sessions/router.py`
- `GET /context/documents` — `backend/app/features/context/router.py`

**Frontend — Update API calls:**
- `frontend/src/features/sessions/api.ts` — Add `offset` parameter
- `frontend/src/features/personas/api.ts` — Add `offset` parameter
- Add "Load More" buttons or infinite scroll to list pages

### 2.5 — Fix Dependency Injection Consistency

**Problem:** `backend/app/features/onboarding/router.py` creates services manually instead of using `Depends()`.

**Fix:**
```python
# Before
service = OnboardingService(db)

# After
async def get_onboarding_service(db: AsyncSession = Depends(get_db)):
    return OnboardingService(db)

# In router
@router.patch("/progress")
async def update_progress(
    ...,
    service: OnboardingService = Depends(get_onboarding_service)
):
```

### 2.6 — Move Business Logic Out of Routers

**File:** `backend/app/features/livekit/router.py` (Lines 52-81)

Move onboarding token logic (persona config building, metadata assembly) into `LivekitService.build_onboarding_metadata()`.

---

## PHASE 3: Frontend Code Quality ✅ COMPLETE

### 3.1 — Add Global Error Boundary

Create: `frontend/src/app/ErrorBoundary.tsx`
```tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

Wrap in `frontend/src/main.tsx` around `<RouterProvider>`.

### 3.2 — Replace All `any` Types with Proper Interfaces

Create: `frontend/src/types/index.ts` (or expand existing)

```typescript
// Core domain types
interface User {
  id: string;
  email: string;
  full_name: string;
  role: "user" | "creator" | "admin";
  onboarding_status: "pending" | "in_progress" | "completed" | "skipped";
  onboarding_step: string | null;
}

interface Persona {
  id: string;
  user_id: string;
  type: string;
  name: string;
  role: string;
  personality: string;
  focus_areas: string;
  voice: VoiceName;
  scoring_criteria: ScoringDimension[];
  behavior_rules: string[];
  opening_message: string | null;
  is_public: boolean;
  use_count: number;
}

interface ScoringDimension {
  key: string;
  label: string;
  description: string;
}

interface Session {
  id: string;
  user_id: string;
  persona_id: string | null;
  persona_snapshot: Persona | null;
  transcript: TranscriptTurn[];
  duration_seconds: number;
  status: "active" | "completed" | "crashed";
  scorecard: Scorecard | null;
  ai_summary: string | null;
  started_at: string;
  ended_at: string | null;
}

interface TranscriptTurn {
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

interface Scorecard {
  overall_score: number;
  overall_feedback: string;
  dimensions: Record<string, { score: number; feedback: string }>;
}

type VoiceName = "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede" | "Leda" | "Orus" | "Zephyr";
```

**Replace `any` in these files (20+ locations):**
- `frontend/src/pages/agents/AgentsPage.tsx` — `useState<any[]>` → `useState<Persona[]>`
- `frontend/src/pages/agents/AgentDetailPage.tsx` — `useState<any>` → `useState<Persona | null>`
- `frontend/src/pages/sessions/SessionDetailPage.tsx` — `useState<any>` → `useState<Session | null>`
- `frontend/src/pages/community/CommunityPage.tsx` — `useState<any[]>` → `useState<Persona[]>`
- `frontend/src/features/personas/PersonaForm.tsx` — `(t: any)` → `(t: PersonaTemplate)`
- `frontend/src/features/sessions/hooks.ts` — `useState<any>` → `useState<Session | null>`
- `frontend/src/widgets/scorecard/Scorecard.tsx` — `scorecard: any` → `scorecard: Scorecard`
- `frontend/src/widgets/preflight-drawer/PreFlightDrawer.tsx` — `persona: any` → `persona: Persona`
- `frontend/src/widgets/agent-preview-drawer/AgentPreviewDrawer.tsx` — `agent: any` → `agent: Persona`

### 3.3 — Add API Error Handling Pattern

Create: `frontend/src/shared/lib/api-error.ts`
```typescript
export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.detail || error.message;
  }
  return "Something went wrong";
}
```

Add try/catch with user-facing error messages to all page-level data fetches:
- `AgentsPage.tsx`
- `SessionsPage.tsx`
- `SessionDetailPage.tsx`
- `CommunityPage.tsx`
- `AgentDetailPage.tsx`

### 3.4 — Move Hardcoded Values to Constants

| Value | Current Location | Move To |
|-------|-----------------|---------|
| `VOICES` array | `PersonaForm.tsx` (Lines 4-13) | `entities/personas/constants.ts` |
| `limit: 100` | `SessionsPage.tsx` (Lines 25, 81) | `entities/sessions/constants.ts` |
| Polling interval `5000` | `SessionsPage.tsx`, `SessionDetailPage.tsx` | `shared/lib/constants.ts` |

### 3.5 — Remove Console Logs

| File | Line | Action |
|------|------|--------|
| `OnboardingBubble.tsx` | 175 | Remove `console.log('Screen share denied...')` |
| `ContextUploader.tsx` | 32 | Remove `console.log('No existing docs...')` |

---

## PHASE 4: Observability & DevOps ✅ COMPLETE

### 4.1 — Add Proper Health Check Endpoint

**File:** `backend/main.py`

```python
@app.get("/health")
async def health_check():
    checks = {}
    # DB check
    try:
        async with get_db_session() as db:
            await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"

    # Overall
    status = "healthy" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": status, "checks": checks}
```

### 4.2 — Structured JSON Logging

**File:** `backend/main.py`

Replace `basicConfig` with structured JSON logging:
```python
import json
import logging

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
        })
```

### 4.3 — Activate OpenTelemetry

**Already installed** in requirements.txt but unused. Wire it up:

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

provider = TracerProvider()
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
trace.set_tracer_provider(provider)
```

Instrument:
- FastAPI (auto-instrumentation)
- SQLAlchemy (auto-instrumentation)
- HTTP client calls to Gemini

### 4.4 — Backend Linting in CI

**Add to:** `.github/workflows/deploy-backend.yml`

```yaml
- name: Lint
  run: |
    pip install ruff
    ruff check backend/ --select E,F,W
```

Replace the current `py_compile` check which only validates syntax.

### 4.5 — Add Pre-commit Hooks

Create: `.pre-commit-config.yaml`
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.0
    hooks:
      - id: ruff
        args: [--fix]
  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v9.0.0
    hooks:
      - id: eslint
        files: frontend/src/.*\.(ts|tsx)$
```

---

## PHASE 5: Testing Foundation ✅ COMPLETE

### 5.1 — Backend Test Setup

**Install:**
Add to `backend/requirements.txt`:
```
pytest==8.3.0
pytest-asyncio==0.24.0
httpx==0.28.0
factory-boy==3.3.0
```

**Create:** `backend/tests/conftest.py`
- In-memory SQLite or test PostgreSQL database
- Async test client via `httpx.AsyncClient`
- Auth fixture (create test user, return JWT)

### 5.2 — Critical Path Tests (Minimum Viable)

Write tests for these flows first — they touch the most code and break the most often:

| Test | File | What It Covers |
|------|------|---------------|
| Auth flow | `tests/test_auth.py` | Google OAuth mock, JWT generation, `/me` endpoint |
| Persona CRUD | `tests/test_personas.py` | Create, list, update, delete, templates, community |
| Session lifecycle | `tests/test_sessions.py` | Create, update, score, list |
| Context upload | `tests/test_context.py` | Upload, search, briefing generation |
| RBAC enforcement | `tests/test_rbac.py` | Admin-only endpoints return 403 for regular users |

### 5.3 — Frontend Test Setup

**Install:**
```json
{
  "devDependencies": {
    "vitest": "^3.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0"
  }
}
```

**Create:** `frontend/vitest.config.ts`

**Priority tests:**
- API client interceptor (token attachment, 401 handling)
- Zustand stores (auth state, theme toggle)
- PersonaForm validation
- Session scoring display logic

---

## Execution Order & Dependencies

```
PHASE 1 ──── RBAC, CORS, rate limiting, token storage ───── ✅ DONE
   │
   ├── ✅ 1.1 RBAC (backend)
   ├── ✅ 1.2 CORS fix
   ├── ✅ 1.3 Rate limiting
   ├── ✅ 1.4 Token storage (backend + frontend)
   └── ✅ 1.5 Input validation
   │
   ▼
PHASE 2 ──── Backend cleanup ─────────────────────────────── ✅ DONE
   │
   ├── ✅ 2.1 Consolidate duplicates
   ├── ✅ 2.2 Fix error handling
   ├── ✅ 2.3 Fix async blocking
   ├── ✅ 2.4 Add pagination
   ├── ✅ 2.5 Fix DI consistency
   └── ✅ 2.6 Move logic out of routers
   │
   ▼
PHASE 3 ──── Frontend cleanup ───────────────────────────── ✅ DONE
   │
   ├── ✅ 3.1 Error boundary
   ├── ✅ 3.2 TypeScript interfaces
   ├── ✅ 3.3 API error handling
   ├── ✅ 3.4 Constants cleanup
   └── ✅ 3.5 Remove console logs
   │
   ▼
PHASE 4 ──── Observability ──────────────────────────────── ✅ DONE
   │
   ├── ✅ 4.1 Health endpoint
   ├── ✅ 4.2 Structured logging
   ├── ✅ 4.3 OpenTelemetry
   ├── ✅ 4.4 Backend CI linting
   └── ✅ 4.5 Pre-commit hooks
   │
   ▼
PHASE 5 ──── Testing foundation ─────────────────────────── ✅ DONE
   │
   ├── ✅ 5.1 Backend test setup
   ├── ✅ 5.2 Critical path tests
   └── ✅ 5.3 Frontend test setup
   │
   ▼
   ✅ READY TO BUILD PHASE 2 FEATURES
```

---

## What This Unlocks

After completing all 5 phases, the codebase will support:

| Phase 2 Feature | Why It's Now Possible |
|-----------------|----------------------|
| **Super Admin Panel** | RBAC exists, health endpoint exists, structured logging provides data |
| **Live RAG Function Calling** | Async blocking fixed, GenAI client centralized, error handling solid |
| **MCP Integration** | Rate limiting protects against abuse, RBAC scopes permissions, pagination handles tool lists |
| **Billing & Tiers** | RBAC enforces tier access, rate limiting enforces usage caps |
| **Chrome Extension** | CORS properly configured, auth tokens are secure, API is paginated |
| **Creator Analytics** | Pagination exists, TypeScript types are clean, session data is well-structured |

---

## Out of Scope (Do NOT Touch During Refactoring)

- No new features
- No database schema changes beyond RBAC `role` column
- No UI redesigns
- No Gemini model upgrades
- No LiveKit agent logic changes
- No new pages or endpoints (except `/health`)

The goal is to **strengthen what exists**, not add anything new.
