# Falah.ai — Superadmin Dashboard Implementation Plan

> **Access**: Only the owner (superadmin) can access this dashboard via Google OAuth.
> No UI-based role promotion. Role is auto-assigned by matching `SUPERADMIN_EMAIL` env variable.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Access Control & Security](#2-access-control--security)
3. [Backend Architecture](#3-backend-architecture)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Panel Specifications](#5-panel-specifications)
   - 5.1 [Overview Dashboard](#51-overview-dashboard)
   - 5.2 [Users Panel](#52-users-panel)
   - 5.3 [Agents Panel](#53-agents-panel)
   - 5.4 [Community Panel](#54-community-panel)
   - 5.5 [Sessions Panel](#55-sessions-panel)
   - 5.6 [Gemini AI Panel](#56-gemini-ai-panel)
   - 5.7 [Reports Panel](#57-reports-panel)
   - 5.8 [System Health Panel](#58-system-health-panel)
6. [Gemini Model Switcher](#6-gemini-model-switcher)
7. [Report Generation System](#7-report-generation-system)
8. [Database Changes](#8-database-changes)
9. [API Endpoint Reference](#9-api-endpoint-reference)
10. [UI Design System](#10-ui-design-system)
11. [Implementation Phases](#11-implementation-phases)
12. [File Structure](#12-file-structure)

---

## 1. Overview

The Superadmin Dashboard is a private, owner-only control center for Falah.ai. It provides full visibility and control over:

- All users and their activity
- All agents (personas) — public, private, and community
- All pitch sessions across the platform
- Gemini AI model configuration and usage tracking
- Community moderation
- Report generation (PDF/CSV)
- System health and performance

**Tech Stack (inherits from project):**
- Backend: FastAPI + SQLAlchemy async + PostgreSQL
- Frontend: React 19 + TypeScript + Tailwind CSS v4
- Charts: Recharts (lightweight, React-native)
- Tables: TanStack Table v8
- Export: jsPDF + Papa Parse (CSV)

---

## 2. Access Control & Security

### Role Addition

Add `superadmin` to the valid roles in the User model:

```python
# backend/app/features/auth/models.py
role: Mapped[str] = mapped_column(
    String(20),
    default="user",
    nullable=False
    # values: "user" | "creator" | "admin" | "superadmin"
)
```

### Auto-Assignment on Login

```python
# backend/app/features/auth/service.py
# On Google OAuth login, check email against env variable
SUPERADMIN_EMAIL = settings.SUPERADMIN_EMAIL  # from .env

if user.email == SUPERADMIN_EMAIL and user.role != "superadmin":
    user.role = "superadmin"
    await db.commit()
```

### Route Protection

```python
# backend/app/core/security.py
# Existing require_role() already supports this:
Depends(require_role("superadmin"))
```

### Frontend Route Guard

```tsx
// frontend/src/app/router/SuperadminGuard.tsx
// Redirect to /login if user.role !== "superadmin"
// Show 403 forbidden page if authenticated but not superadmin
```

### Security Rules

- All `/api/v1/superadmin/*` endpoints require `superadmin` role
- Superadmin routes are NOT listed in the main navigation
- Rate limiting: 200 requests/minute (higher than regular users)
- All destructive actions (delete, ban) require a confirmation token (re-auth)
- Audit log: every superadmin action is logged to a separate table

---

## 3. Backend Architecture

### Module Structure

```
backend/app/features/superadmin/
├── __init__.py
├── router.py          # All route definitions
├── service.py         # Business logic
├── schemas.py         # Pydantic request/response models
├── queries.py         # Complex SQL queries (aggregations)
└── reports.py         # Report generation logic
```

### Router Registration

```python
# backend/app/main.py
from app.features.superadmin.router import router as superadmin_router
app.include_router(superadmin_router, prefix="/api/v1/superadmin", tags=["superadmin"])
```

---

## 4. Frontend Architecture

### Route Structure

```
/superadmin                     # Overview dashboard
/superadmin/users               # User management table
/superadmin/users/:id           # Individual user profile
/superadmin/agents              # All agents (personas) across platform
/superadmin/community           # Community moderation
/superadmin/sessions            # All sessions across platform
/superadmin/ai                  # Gemini model config & usage
/superadmin/reports             # Report generation
/superadmin/system              # System health
```

### Frontend Module Structure (FSD)

```
frontend/src/pages/superadmin/
├── SuperadminLayout.tsx         # Sidebar + header shell
├── OverviewPage.tsx
├── UsersPage.tsx
├── UserDetailPage.tsx
├── AgentsPage.tsx
├── CommunityPage.tsx
├── SessionsPage.tsx
├── AIPanel/
│   ├── AIPage.tsx
│   └── ModelSwitcher.tsx       # Gemini model switcher component
├── ReportsPage.tsx
└── SystemPage.tsx

frontend/src/features/superadmin/
├── api.ts                       # All superadmin API calls
├── types.ts                     # TypeScript types
└── store.ts                     # Zustand store for admin state
```

---

## 5. Panel Specifications

---

### 5.1 Overview Dashboard

**Purpose:** Quick snapshot of the entire platform at a glance.

#### Stat Cards (Top Row)

| Card | Metric | Sub-metric |
|------|--------|------------|
| Total Users | Count | +N this week |
| Active Sessions | Currently live | Peak today |
| Total Agents | All personas | Public / Private split |
| Community Agents | Public only | Trending this week |
| Token Usage | Total tokens today | vs. yesterday |
| Sessions Today | Count | Avg duration |

#### Charts (Middle Row)

| Chart | Type | Description |
|-------|------|-------------|
| User Growth | Line chart | Daily signups over last 30 days |
| Session Volume | Bar chart | Sessions per day last 14 days |
| Agent Creation | Line chart | New agents per day last 30 days |
| Score Distribution | Histogram | Score ranges across all sessions |

#### Recent Activity Feed (Bottom)

- Last 10 user signups
- Last 10 sessions completed
- Last 10 agents made public
- Any system errors in last hour

#### API Endpoint

```
GET /api/v1/superadmin/stats
Response: {
  users: { total, this_week, this_month },
  sessions: { total, active_now, today, avg_duration_seconds },
  agents: { total, public, private, community, this_week },
  tokens: { today, yesterday, this_month },
  charts: {
    user_growth: [{ date, count }],         // last 30 days
    session_volume: [{ date, count }],      // last 14 days
    agent_creation: [{ date, count }],      // last 30 days
    score_distribution: [{ range, count }]  // all time
  },
  recent: {
    signups: [...],
    sessions: [...],
    agents_published: [...]
  }
}
```

---

### 5.2 Users Panel

**Purpose:** Full user management — view, search, filter, and take actions.

#### User Table Columns

| Column | Type | Sortable | Filterable |
|--------|------|----------|------------|
| Avatar + Name | Display | No | No |
| Email | Text | Yes | Yes (search) |
| Role | Badge | No | Yes (dropdown) |
| Auth Provider | Badge | No | Yes |
| Joined | Date | Yes | Yes (date range) |
| Last Active | Date | Yes | No |
| Sessions Count | Number | Yes | No |
| Agents Count | Number | Yes | No |
| Status | Badge | No | Yes (active/banned) |
| Actions | Buttons | No | No |

#### Filters

- Search by name or email
- Filter by role: `user` / `creator` / `admin`
- Filter by status: active / banned
- Date range: joined between X and Y
- Sort by: joined date, last active, session count

#### Actions per User

- **View Profile** — opens user detail page
- **Change Role** — dropdown (user / creator / admin)
- **Ban / Unban** — toggles `is_active` field
- **Delete User** — requires confirmation modal + cascades to all data

#### User Detail Page (`/superadmin/users/:id`)

```
┌─────────────────────────────────────┐
│  Avatar   Name   Email   Role       │
│           Joined  Last Active       │
│           Auth Provider             │
├──────────────┬──────────────────────┤
│  Stats       │  Recent Sessions     │
│  - Sessions  │  (last 5 with score) │
│  - Agents    │                      │
│  - Documents │  Recent Agents       │
│  - Tokens    │  (last 5)            │
└──────────────┴──────────────────────┘
```

#### API Endpoints

```
GET    /api/v1/superadmin/users?page=1&limit=20&search=&role=&status=&sort=
GET    /api/v1/superadmin/users/:id
PATCH  /api/v1/superadmin/users/:id      { role?, is_active? }
DELETE /api/v1/superadmin/users/:id
```

---

### 5.3 Agents Panel

**Purpose:** Track ALL agents/personas created across the platform — public, private, everything.

> This is separate from Community. Community shows only public ones for moderation.
> Agents Panel shows the full picture with analytics.

#### Summary Cards (Top)

| Card | Value |
|------|-------|
| Total Agents Created (All Time) | Count |
| Public Agents | Count + % of total |
| Private Agents | Count + % of total |
| Community Published | Count (approved public) |
| Agents Created This Week | Count + sparkline |
| Most Used Agent | Name + use count |
| Average Use Count | Per agent |

#### Agent Table Columns

| Column | Notes |
|--------|-------|
| Agent Name | Linked to detail |
| Creator | User name + email |
| Type | Public / Private badge |
| In Community | Yes/No badge |
| Use Count | Total sessions using this agent |
| Created | Date |
| Last Used | Date |
| Actions | View, Remove from Community, Delete |

#### Filters

- Visibility: All / Public / Private
- Community: In community / Not in community
- Sort by: use count, created date, last used
- Search by name

#### Agent Detail Drawer (slide-in panel)

When clicking an agent row, a side drawer opens:
- Full persona config (role, personality, focus areas, scoring criteria)
- Sessions using this agent (count + list)
- Creator info
- Quick actions (remove from community, delete)

#### API Endpoints

```
GET    /api/v1/superadmin/agents?page=1&limit=20&visibility=&community=&sort=&search=
GET    /api/v1/superadmin/agents/:id
PATCH  /api/v1/superadmin/agents/:id    { is_public?, remove_from_community? }
DELETE /api/v1/superadmin/agents/:id
GET    /api/v1/superadmin/agents/stats  # Summary cards data
```

---

### 5.4 Community Panel

**Purpose:** Moderate the community marketplace of public personas.

#### Community Table Columns

| Column | Notes |
|--------|-------|
| Agent Name | |
| Creator | |
| Use Count | How many times used by others |
| Rating / Score | Avg scorecard if available |
| Published Date | When made public |
| Status | Active / Flagged / Removed |
| Actions | Feature, Remove, View |

#### Actions

- **Feature / Unfeature** — marks agent as "Featured" (shown at top of community)
- **Remove from Community** — sets `is_public = false`
- **View** — opens agent detail drawer

#### API Endpoints

```
GET    /api/v1/superadmin/community?page=1&limit=20&sort=use_count
PATCH  /api/v1/superadmin/community/:id   { featured?, remove? }
```

---

### 5.5 Sessions Panel

**Purpose:** Full visibility into all pitch sessions across the entire platform.

#### Session Table Columns

| Column | Notes |
|--------|-------|
| Session ID | Short UUID |
| User | Name + email |
| Agent Used | Persona name |
| Status | Active / Completed / Crashed badge |
| Duration | In minutes:seconds |
| Score | Overall score badge (color-coded) |
| Started | Date + time |
| Ended | Date + time |
| Actions | View transcript |

#### Filters

- Status: All / Active / Completed / Crashed
- Date range
- Score range: 0-50 / 51-70 / 71-85 / 86-100
- Search by user email

#### Session Detail Modal

Clicking a session opens a modal showing:
- Full transcript
- Scorecard breakdown
- AI summary
- Session metadata (duration, persona used, user info)

#### Live Sessions Widget

At the top of the sessions panel, a real-time card shows:
- Number of active sessions RIGHT NOW
- List of active rooms with user name + agent name + duration
- Auto-refreshes every 15 seconds

#### API Endpoints

```
GET /api/v1/superadmin/sessions?page=1&limit=20&status=&sort=&score_min=&score_max=
GET /api/v1/superadmin/sessions/:id
GET /api/v1/superadmin/sessions/live    # Currently active sessions
```

---

### 5.6 Gemini AI Panel

**Purpose:** Monitor AI usage AND configure which Gemini models are active. Switch models without redeploying.

> See full details in [Section 6: Gemini Model Switcher](#6-gemini-model-switcher)

#### Usage Stats

| Metric | Scope |
|--------|-------|
| Total tokens used | All time |
| Tokens today | With hourly breakdown chart |
| Tokens this month | With daily breakdown chart |
| Estimated cost | Based on Gemini pricing per model |
| Top token users | Top 10 users by token consumption |
| Avg tokens per session | Platform-wide |
| Embedding calls | Total document embeddings done |
| Onboarding completions | Count + drop-off step breakdown |

#### Model Configuration (Live Switcher)

```
┌───────────────────────────────────────────────────┐
│  ACTIVE MODELS                                    │
├───────────────────────────────────────────────────┤
│  Live Agent Model     [gemini-2.5-flash ▼]  Save  │
│  Embedding Model      [gemini-embedding-2 ▼] Save  │
│  Report Gen Model     [gemini-2.0-flash ▼]  Save  │
│  Onboarding Model     [gemini-2.5-flash ▼]  Save  │
├───────────────────────────────────────────────────┤
│  Available Models:                                │
│  ✓ gemini-2.5-flash (recommended)                │
│  ✓ gemini-2.5-pro                                │
│  ✓ gemini-3.0-flash (NEW)                        │
│  ✓ gemini-3.0-pro (NEW)                          │
│  ✓ gemini-2.0-flash                              │
│  ✓ gemini-embedding-2                            │
└───────────────────────────────────────────────────┘
```

#### API Endpoints

```
GET  /api/v1/superadmin/ai/usage          # Token usage stats
GET  /api/v1/superadmin/ai/usage/chart    # Hourly/daily breakdown
GET  /api/v1/superadmin/ai/models         # List available + currently active models
PUT  /api/v1/superadmin/ai/models         # Update active model config
GET  /api/v1/superadmin/ai/top-users      # Top 10 token consumers
```

---

### 5.7 Reports Panel

**Purpose:** Generate downloadable reports on demand. PDF and CSV formats.

> See full details in [Section 7: Report Generation System](#7-report-generation-system)

#### Available Reports

| Report Name | Format | Description |
|-------------|--------|-------------|
| User Growth Report | PDF + CSV | Signups over time, role breakdown, retention |
| Session Analytics Report | PDF + CSV | Volume, duration, score distribution, crashes |
| Agent Catalog Report | CSV | All agents with metadata and usage |
| Community Report | PDF | Top performing community agents |
| AI Usage Report | PDF + CSV | Token usage per user, per model, estimated cost |
| Full Platform Snapshot | PDF | All of the above combined, with charts |

#### Report Config UI

```
┌───────────────────────────────────────┐
│  Generate Report                      │
│                                       │
│  Report Type:   [User Growth ▼]       │
│  Date Range:    [Last 30 Days ▼]      │
│  Format:        [● PDF  ○ CSV]        │
│  Include Charts: [✓ Yes]              │
│                                       │
│  [Generate Report]                    │
└───────────────────────────────────────┘
│  Recent Reports                       │
│  ─────────────────────────────────   │
│  User Growth - March 2026  [↓ PDF]   │
│  Session Analytics - Q1    [↓ CSV]   │
└───────────────────────────────────────┘
```

#### API Endpoints

```
POST /api/v1/superadmin/reports/generate
Body: { type, date_from, date_to, format: "pdf"|"csv" }
Response: { report_id, status: "generating" }

GET  /api/v1/superadmin/reports/:id/status
GET  /api/v1/superadmin/reports/:id/download    # Returns file stream
GET  /api/v1/superadmin/reports/history         # Past generated reports
```

---

### 5.8 System Health Panel

**Purpose:** Monitor infrastructure and platform health.

#### Metrics

| Metric | Source |
|--------|--------|
| API response time (avg) | From request logs |
| Active LiveKit rooms | LiveKit API |
| Database connection pool | SQLAlchemy pool stats |
| Total DB records | Count per table |
| Recent errors (500s) | Error log |
| Session crash rate | sessions where status = 'crashed' / total |
| Uptime | Process start time |

#### Layout

```
┌──────────────┬──────────────┬──────────────┐
│ API Latency  │ DB Pool      │ LiveKit      │
│ 145ms avg    │ 8/20 used    │ 3 active     │
└──────────────┴──────────────┴──────────────┘
┌──────────────────────────────────────────────┐
│  DB Record Counts                            │
│  Users: 124  Sessions: 891  Agents: 203      │
│  Documents: 567  Embeddings: 567             │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│  Recent Errors (last 24h)                    │
│  [timestamp] [endpoint] [status] [message]   │
└──────────────────────────────────────────────┘
```

#### API Endpoints

```
GET /api/v1/superadmin/system/health     # All health metrics
GET /api/v1/superadmin/system/errors     # Recent error log
GET /api/v1/superadmin/system/db-stats   # DB record counts
```

---

## 6. Gemini Model Switcher

### Problem

Currently the Gemini model is hardcoded in the LiveKit agent worker and backend config. Changing it requires a code edit and redeploy.

### Solution

Store active model config in the database. The agent worker and backend read from DB (cached in memory with 60s TTL) instead of hardcoded env variables.

### Database Table: `ai_model_config`

```sql
CREATE TABLE ai_model_config (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key  VARCHAR(50) UNIQUE NOT NULL,   -- e.g. "live_agent_model"
    model_id    VARCHAR(100) NOT NULL,          -- e.g. "gemini-3.0-flash"
    updated_at  TIMESTAMP DEFAULT NOW(),
    updated_by  UUID REFERENCES users(id)
);

-- Seed data
INSERT INTO ai_model_config (config_key, model_id) VALUES
  ('live_agent_model',     'gemini-2.5-flash'),
  ('embedding_model',      'gemini-embedding-002'),
  ('report_gen_model',     'gemini-2.0-flash'),
  ('onboarding_model',     'gemini-2.5-flash');
```

### Available Models Registry

```python
# backend/app/features/superadmin/schemas.py
AVAILABLE_MODELS = {
    "live_agent": [
        { "id": "gemini-3.0-flash",   "label": "Gemini 3.0 Flash (NEW)", "tier": "fast" },
        { "id": "gemini-3.0-pro",     "label": "Gemini 3.0 Pro (NEW)",   "tier": "powerful" },
        { "id": "gemini-2.5-flash",   "label": "Gemini 2.5 Flash",       "tier": "fast" },
        { "id": "gemini-2.5-pro",     "label": "Gemini 2.5 Pro",         "tier": "powerful" },
        { "id": "gemini-2.0-flash",   "label": "Gemini 2.0 Flash",       "tier": "fast" },
    ],
    "embedding": [
        { "id": "gemini-embedding-002", "label": "Gemini Embedding 2", "tier": "standard" },
    ],
    "report": [
        { "id": "gemini-2.0-flash",   "label": "Gemini 2.0 Flash",   "tier": "fast" },
        { "id": "gemini-2.5-flash",   "label": "Gemini 2.5 Flash",   "tier": "fast" },
        { "id": "gemini-3.0-flash",   "label": "Gemini 3.0 Flash",   "tier": "fast" },
    ]
}
```

### Caching Strategy

```python
# backend/app/core/model_config.py
import asyncio
from datetime import datetime, timedelta

_cache = {}
_cache_time = {}
CACHE_TTL_SECONDS = 60

async def get_active_model(config_key: str, db: AsyncSession) -> str:
    now = datetime.now()
    if config_key in _cache:
        if (now - _cache_time[config_key]).seconds < CACHE_TTL_SECONDS:
            return _cache[config_key]

    result = await db.execute(
        select(AIModelConfig).where(AIModelConfig.config_key == config_key)
    )
    config = result.scalar_one_or_none()
    model_id = config.model_id if config else "gemini-2.5-flash"

    _cache[config_key] = model_id
    _cache_time[config_key] = now
    return model_id
```

### Switch Flow

1. Superadmin selects new model in UI dropdown
2. Frontend calls `PUT /api/v1/superadmin/ai/models`
3. Backend updates `ai_model_config` table
4. Cache is invalidated
5. Next request from agent worker picks up new model (within 60s)
6. UI shows success toast: "Model switched to gemini-3.0-flash"
7. Change is logged to audit log

---

## 7. Report Generation System

### Architecture

Reports are generated asynchronously using FastAPI's background tasks:

```
User clicks Generate →
  POST /reports/generate →
    Returns report_id immediately →
      Background task runs (fetches data + generates PDF/CSV) →
        Stores file in /tmp/reports/ →
          Status endpoint shows "ready" →
            User downloads via /reports/:id/download
```

### PDF Reports

Generated using **Gemini** as the content analyzer + Python's `reportlab` or `weasyprint` for PDF rendering.

**Flow:**
1. Fetch raw data from DB (aggregated queries)
2. Send summary data to Gemini with prompt: *"Analyze this platform data and write a professional report with insights and recommendations"*
3. Combine Gemini analysis with charts (base64 encoded chart images)
4. Render to PDF with Falah.ai branding

**PDF Report Structure:**
```
Cover Page
  - Report title
  - Date range
  - Generated on: [timestamp]
  - Falah.ai logo

Executive Summary (Gemini-generated)
  - Key metrics
  - Notable trends
  - Recommendations

Charts Section
  - User growth chart
  - Session volume chart
  - Score distribution
  - Token usage

Data Tables
  - Top users
  - Top agents
  - Model usage breakdown

Raw Data Appendix
```

### CSV Reports

Direct DB query → pandas DataFrame → CSV export. Fast, no AI needed.

### Backend Implementation

```python
# backend/app/features/superadmin/reports.py

async def generate_report(
    report_id: str,
    report_type: str,
    date_from: date,
    date_to: date,
    format: str,
    db: AsyncSession
):
    # 1. Fetch data
    data = await fetch_report_data(report_type, date_from, date_to, db)

    if format == "csv":
        file_path = await generate_csv(report_id, data)
    else:
        # Use Gemini to generate insights
        insights = await generate_insights_with_gemini(data)
        file_path = await generate_pdf(report_id, data, insights)

    # 2. Update report status in DB
    await update_report_status(report_id, "ready", file_path, db)
```

### Model for Report Generation

Uses the `report_gen_model` config key from `ai_model_config` table — fully switchable from the AI panel.

---

## 8. Database Changes

### New Tables

```sql
-- 1. AI Model Configuration
CREATE TABLE ai_model_config (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key  VARCHAR(50) UNIQUE NOT NULL,
    model_id    VARCHAR(100) NOT NULL,
    updated_at  TIMESTAMP DEFAULT NOW(),
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 2. Superadmin Audit Log
CREATE TABLE superadmin_audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action      VARCHAR(100) NOT NULL,   -- e.g. "user.ban", "model.switch", "agent.delete"
    target_type VARCHAR(50),             -- "user", "agent", "session", "model"
    target_id   UUID,
    details     JSONB,                   -- extra context
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMP DEFAULT NOW()
);

-- 3. Generated Reports
CREATE TABLE admin_reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        VARCHAR(50) NOT NULL,    -- "user_growth", "sessions", etc.
    format      VARCHAR(10) NOT NULL,    -- "pdf" | "csv"
    status      VARCHAR(20) DEFAULT 'generating',  -- generating | ready | failed
    date_from   DATE,
    date_to     DATE,
    file_path   TEXT,
    file_size   INTEGER,
    created_at  TIMESTAMP DEFAULT NOW(),
    created_by  UUID REFERENCES users(id)
);

-- 4. Token Usage Tracking (optional — if not already tracked per session)
-- Add to PitchSession model:
ALTER TABLE pitch_sessions ADD COLUMN token_count INTEGER DEFAULT 0;
ALTER TABLE pitch_sessions ADD COLUMN model_used VARCHAR(100);
```

### Migrations

```
alembic revision --autogenerate -m "add superadmin tables"
alembic upgrade head
```

---

## 9. API Endpoint Reference

### Complete List

```
BASE: /api/v1/superadmin/
All endpoints require: Authorization header with superadmin JWT

OVERVIEW
GET     /stats                          Platform overview stats + charts

USERS
GET     /users                          List all users (paginated, filterable)
GET     /users/:id                      User detail + activity
PATCH   /users/:id                      Update role or ban status
DELETE  /users/:id                      Delete user + all their data

AGENTS
GET     /agents                         All agents — public + private
GET     /agents/stats                   Summary cards (total, public, private, etc.)
GET     /agents/:id                     Agent detail
PATCH   /agents/:id                     Update visibility/community status
DELETE  /agents/:id                     Delete agent

COMMUNITY
GET     /community                      Community agents (paginated)
PATCH   /community/:id                  Feature or remove from community

SESSIONS
GET     /sessions                       All sessions (paginated, filterable)
GET     /sessions/live                  Currently active sessions
GET     /sessions/:id                   Session detail + transcript

AI MODELS
GET     /ai/usage                       Token usage stats
GET     /ai/usage/chart                 Usage over time (hourly/daily)
GET     /ai/models                      Available models + current config
PUT     /ai/models                      Update active model config
GET     /ai/top-users                   Top 10 token consumers

REPORTS
POST    /reports/generate               Queue report generation
GET     /reports/:id/status             Check generation status
GET     /reports/:id/download           Download generated file
GET     /reports/history                Past reports list

SYSTEM
GET     /system/health                  Health metrics
GET     /system/errors                  Recent errors
GET     /system/db-stats                DB record counts

AUDIT
GET     /audit                          Audit log (paginated)
```

---

## 10. UI Design System

### Theme

Dark theme. Clean, data-dense, professional. Inspired by Vercel/Linear dashboards.

```
Background:  #0a0a0a  (near black)
Surface:     #111111  (cards)
Border:      #1f1f1f  (subtle borders)
Primary:     #6366f1  (indigo — matches Falah brand)
Success:     #10b981  (green)
Warning:     #f59e0b  (amber)
Danger:      #ef4444  (red)
Text:        #e5e7eb  (light gray)
Muted:       #6b7280  (gray)
```

### Layout

```
┌─────────────────────────────────────────────────┐
│  FALAH SUPERADMIN          [Refresh] [You ▼]   │
├──────────────┬──────────────────────────────────┤
│              │                                  │
│  Overview    │                                  │
│  Users       │      Main Content Area           │
│  Agents      │      (changes per route)         │
│  Community   │                                  │
│  Sessions    │                                  │
│  AI Models   │                                  │
│  Reports     │                                  │
│  System      │                                  │
│              │                                  │
└──────────────┴──────────────────────────────────┘
```

### Components

- **StatCard** — metric + sub-metric + optional sparkline
- **DataTable** — TanStack Table with pagination, sort, filter, row actions
- **ChartCard** — Recharts wrapper with title + date range selector
- **ModelSwitcher** — dropdown with model options + save button
- **ReportBuilder** — form for configuring and generating reports
- **AgentDrawer** — slide-in panel for agent detail
- **ConfirmModal** — required for destructive actions
- **AuditLog** — scrollable list of admin actions

---

## 11. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Add `superadmin` role to User model
- [ ] Auto-assign superadmin on login by email match
- [ ] Create Alembic migration: `ai_model_config`, `superadmin_audit_log`, `admin_reports`
- [ ] Create superadmin FastAPI module (router, service, schemas)
- [ ] Protect all routes with `require_role("superadmin")`
- [ ] Frontend: SuperadminLayout, sidebar, route guard
- [ ] Frontend: Overview page with stat cards (hardcoded first, then API)

### Phase 2: Users & Agents (Week 2)
- [ ] Backend: `/users` endpoints (list, detail, update, delete)
- [ ] Backend: `/agents` endpoints (list with public/private, stats, update, delete)
- [ ] Frontend: Users panel — table + filters + actions
- [ ] Frontend: User detail page
- [ ] Frontend: Agents panel — table with public/private/community filters + summary cards

### Phase 3: Community & Sessions (Week 3)
- [ ] Backend: `/community` endpoints
- [ ] Backend: `/sessions` endpoints (all sessions + live)
- [ ] Frontend: Community moderation panel
- [ ] Frontend: Sessions panel — table + live widget + transcript modal

### Phase 4: Gemini AI Panel + Model Switcher (Week 4)
- [ ] Backend: `get_active_model()` helper with 60s cache
- [ ] Backend: Update agent worker to use DB model config instead of hardcoded
- [ ] Backend: `/ai/usage`, `/ai/models`, `/ai/top-users` endpoints
- [ ] Frontend: AI panel — usage stats + charts + model switcher
- [ ] Test model switching end-to-end (change in UI → reflected in next agent session)

### Phase 5: Reports (Week 5)
- [ ] Install `reportlab` or `weasyprint` for PDF generation
- [ ] Backend: Report generation background task
- [ ] Backend: Gemini integration for PDF insights generation
- [ ] Backend: `/reports` endpoints (generate, status, download, history)
- [ ] Frontend: Reports panel — config form + history list + download buttons

### Phase 6: System Health + Audit Log (Week 6)
- [ ] Backend: `/system/health`, `/system/errors`, `/system/db-stats`
- [ ] Backend: Audit logging middleware (auto-log all superadmin actions)
- [ ] Frontend: System health panel
- [ ] Frontend: Audit log view

---

## 12. File Structure

### Complete File List to Create

```
BACKEND
backend/app/features/superadmin/
├── __init__.py
├── router.py
├── service.py
├── schemas.py
├── queries.py
└── reports.py

backend/app/core/
└── model_config.py          (new — model config cache helper)

backend/alembic/versions/
└── xxxx_add_superadmin_tables.py

FRONTEND
frontend/src/pages/superadmin/
├── SuperadminLayout.tsx
├── OverviewPage.tsx
├── UsersPage.tsx
├── UserDetailPage.tsx
├── AgentsPage.tsx
├── CommunityPage.tsx
├── SessionsPage.tsx
├── AIPanel/
│   ├── AIPage.tsx
│   └── ModelSwitcher.tsx
├── ReportsPage.tsx
└── SystemPage.tsx

frontend/src/features/superadmin/
├── api.ts
├── types.ts
└── store.ts

frontend/src/app/router/
└── SuperadminGuard.tsx       (new protected route component)
```

---

## Summary

| Panel | Backend Endpoints | Frontend Pages | Priority |
|-------|------------------|----------------|----------|
| Overview | 1 endpoint | 1 page | P0 |
| Users | 4 endpoints | 2 pages | P0 |
| Agents | 5 endpoints | 1 page | P0 |
| Community | 2 endpoints | 1 page | P1 |
| Sessions | 3 endpoints | 1 page | P1 |
| AI + Model Switcher | 5 endpoints | 1 page | P1 |
| Reports | 4 endpoints | 1 page | P2 |
| System Health | 3 endpoints | 1 page | P2 |

**Total:** ~27 backend endpoints, 9 frontend pages, 3 new DB tables, 1 cached helper, 6 weeks of work.
