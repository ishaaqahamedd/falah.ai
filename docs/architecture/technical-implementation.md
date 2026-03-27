# Technical Implementation

## Coding Standards

### Backend (Python / FastAPI)
- **Pattern:** 3-Layer Architecture per feature: `router.py` → `service.py` → `repository.py`
- **Models:** SQLAlchemy declarative models in `models.py`, Pydantic schemas in `schemas.py`
- **Naming:** snake_case for files, functions, variables. PascalCase for classes.
- **Async:** All DB operations use `async/await`. No blocking I/O permitted.
- **Dependency Injection:** FastAPI `Depends()` for DB sessions, auth, and service construction.
- **Configuration:** Pydantic `BaseSettings` in `app/core/config.py`, loaded from `.env`.

### Frontend (React / TypeScript)
- **Architecture:** Feature-Sliced Design (FSD): `pages/`, `features/`, `widgets/`, `shared/`, `entities/`
- **State Management:** Zustand stores per feature
- **Routing:** React Router v7 with `createBrowserRouter`
- **Styling:** Tailwind CSS v4
- **API Client:** Fetch-based with Bearer token auth from Zustand auth store

## Database Schemas

### `users` Table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `email` | VARCHAR(320) | Unique, indexed |
| `password_hash` | VARCHAR(255) | Nullable (Google OAuth users have none) |
| `full_name` | VARCHAR(255) | Required |
| `is_active` | BOOLEAN | Default: true |
| `auth_provider` | VARCHAR(20) | `"local"` or `"google"` |
| `google_id` | VARCHAR(255) | Unique, indexed, nullable |
| `onboarding_status` | VARCHAR(20) | `"pending"` / `"in_progress"` / `"completed"` |
| `onboarding_step` | VARCHAR(50) | Current step name, nullable |
| `onboarding_completed_at` | TIMESTAMPTZ | Nullable |
| `onboarding_summary` | TEXT | AI summary of onboarding conversation |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Auto |

### `personas` Table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `user_id` | UUID (FK → users) | CASCADE delete |
| `type` | VARCHAR(100) | e.g. `"investor"`, `"client"`, `"interviewer"` |
| `name` | VARCHAR(255) | Persona display name |
| `role` | VARCHAR(255) | e.g. `"Tier 1 VC Partner"` |
| `personality` | TEXT | Personality description |
| `focus_areas` | TEXT | What the persona cares about |
| `voice` | VARCHAR(50) | Gemini voice: `"Puck"`, `"Kore"`, etc. |
| `scoring_criteria` | JSONB | `[{key, label, desc}, ...]` |
| `behavior_rules` | JSONB | `["rule1", "rule2", ...]` |
| `opening_message` | TEXT | Custom opening instruction |
| `is_public` | BOOLEAN | Community visibility, indexed |
| `use_count` | INTEGER | Community usage tracking |
| `cached_briefing` | TEXT | Pre-call briefing cache |
| `briefing_generated_at` | TIMESTAMPTZ | When briefing was last generated |
| `created_at` / `updated_at` | TIMESTAMPTZ | Auto |

### `pitch_sessions` Table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `user_id` | UUID (FK → users) | CASCADE delete |
| `persona_id` | UUID (FK → personas) | SET NULL on delete |
| `persona_snapshot` | JSONB | Frozen config at session time |
| `transcript` | JSONB | `[{role, text, timestamp}, ...]` |
| `duration_seconds` | INTEGER | Session length |
| `status` | ENUM | `active` / `completed` / `crashed` |
| `scorecard` | JSONB | Per-dimension scores + feedback |
| `ai_summary` | TEXT | 2-3 sentence summary |
| `started_at` | TIMESTAMPTZ | Auto |
| `ended_at` | TIMESTAMPTZ | Nullable |

### `context_documents` Table
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `user_id` | UUID (FK → users) | CASCADE delete |
| `persona_id` | UUID (FK → personas) | CASCADE delete, nullable |
| `filename` | VARCHAR(255) | Original upload filename |
| `content_type` | VARCHAR(50) | `"email"`, `"transcript"`, `"notes"`, `"document"` |
| `content` | TEXT | Extracted text content |
| `embedding` | VECTOR(3072) | Gemini Embedding 2 (pgvector) |
| `metadata` | JSONB | Flexible key-value metadata |
| `created_at` | TIMESTAMPTZ | Auto |

## API Design Patterns

### Base URL
All REST endpoints are prefixed with `/api/v1/`.

### Authentication
Bearer token via `Authorization: Bearer <JWT>` header. Token decoded via `get_current_user` dependency.

### Feature Routers

| Prefix | Module | Key Endpoints |
|--------|--------|---------------|
| `/api/v1/auth` | auth | `POST /google`, `GET /me` |
| `/api/v1/personas` | personas | `GET /`, `POST /`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `GET /templates`, `GET /community` |
| `/api/v1/sessions` | sessions | `POST /`, `PATCH /{id}`, `GET /`, `GET /{id}`, `POST /{id}/score` |
| `/api/v1/livekit` | livekit | `GET /token`, `GET /onboarding-token` |
| `/api/v1/context` | context | `POST /upload`, `GET /documents`, `GET /briefing`, `GET /search` |
| `/api/v1/onboarding` | onboarding | `PATCH /progress` |

### WebSocket
| Path | Purpose |
|------|---------|
| `/ws/pitch/{persona_id}` | Legacy direct WebSocket path (Gemini Live API, bypasses LiveKit) |

### Error Handling
Standard FastAPI `HTTPException` with status codes. 401 for auth failures, 404 for missing resources, 500 for server errors.
