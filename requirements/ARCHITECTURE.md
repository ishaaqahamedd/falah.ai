# Falah.ai — Product Architecture

## System Overview

Falah.ai runs as two independent processes backed by a shared PostgreSQL database, with LiveKit Cloud handling WebRTC media routing and Google Gemini powering the AI.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER (Browser)                             │
│   React 19 + Vite + Tailwind CSS + LiveKit Client SDK + Zustand    │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │ REST API (Axios)                 │ WebRTC (Audio + Video)
           ▼                                  ▼
┌─────────────────────┐            ┌─────────────────────┐
│   FastAPI Server     │            │   LiveKit Cloud      │
│   (Process 1)        │            │   (WebRTC SFU)       │
│                      │            │                      │
│  /api/v1/auth        │            │  Media routing       │
│  /api/v1/personas    │            │  Room management     │
│  /api/v1/sessions    │            │  Track subscriptions │
│  /api/v1/livekit     │            └──────────┬──────────┘
│  /api/v1/context     │                       │
│  /api/v1/onboarding  │                       │ LiveKit Agent Protocol
│                      │                       ▼
│  /ws/pitch/{id}      │            ┌─────────────────────┐
│  (legacy WebSocket)  │            │  LiveKit Agent       │
└──────────┬───────────┘            │  Worker (Process 2)  │
           │                        │                      │
           │                        │  PersonaAgent        │
           │                        │  TranscriptRecorder  │
           │                        │  Prompt Builder      │
           │                        │  Shutdown Handler    │
           │                        └──────────┬──────────┘
           │                                   │
           ▼                                   ▼
┌─────────────────────┐            ┌─────────────────────┐
│   PostgreSQL         │            │  Google Gemini       │
│   + pgvector         │            │                      │
│                      │            │  2.5 Flash (Live)    │
│  Users               │            │  - Native audio      │
│  Personas            │            │  - Native vision     │
│  PitchSessions       │            │  - Realtime stream   │
│  ContextDocuments    │            │                      │
│  (embeddings 3072d)  │            │  Flash (Scoring)     │
│                      │            │  Embedding 2 (3072d) │
└──────────────────────┘            └──────────────────────┘
```

## Two-Process Model

### Process 1: FastAPI Server
Handles all HTTP/REST traffic — auth, CRUD, token generation, context upload.

- **Does NOT** participate in live sessions
- Builds room metadata (persona config + briefing + session history) at token generation time
- Creates LiveKit rooms via Room Service API
- Runs on port 8000

### Process 2: LiveKit Agent Worker
Handles all real-time AI conversation logic.

- **Does NOT** serve HTTP
- Wakes up when a user joins a LiveKit room
- Reads persona config from `ctx.room.metadata` (pre-baked by Process 1)
- Streams audio/video to Gemini, relays responses to user
- On shutdown: persists transcript + triggers scoring
- Spawns its own isolated DB engine (avoids event loop conflicts with Process 1)

**Why two processes?** LiveKit's agent SDK runs its own event loop. Sharing a single async engine between FastAPI's loop and the agent's loop causes "Future attached to different loop" errors. The clean solution: fully isolated processes with a shared database.

## Data Flow: Live Session

```
1. TOKEN REQUEST
   Frontend → GET /api/v1/livekit/token?persona_id=X&context=Y&session_id=Z

   Server:
   ├── Fetch Persona from DB (config, scoring criteria, behavior rules)
   ├── Fetch cached briefing (from uploaded context documents)
   ├── Fetch last 3 completed sessions (for adaptive prompting)
   ├── Pack everything into room metadata JSON
   ├── Create LiveKit room with metadata
   ├── Generate JWT token for user
   └── Return {token, room}

2. WEBRTC CONNECT
   Frontend → LiveKit Cloud (WebRTC handshake)
   ├── User publishes audio track (microphone)
   ├── User optionally publishes video track (screen share)
   └── Agent worker wakes up via LiveKit's entrypoint callback

3. AGENT INITIALIZATION
   Agent Worker:
   ├── Parse room metadata → persona config, briefing, session history
   ├── Build system prompt via _build_dynamic_prompt()
   │   ├── Identity: "You are {name}, {role}"
   │   ├── Personality + Focus Areas
   │   ├── Intelligence Dossier (briefing + CRM notes)
   │   ├── Session History (adaptive: probe weak areas, escalate)
   │   └── Behavior Rules (5 defaults + custom)
   ├── Create PersonaAgent with Gemini Realtime Model
   ├── Attach TranscriptRecorder (captures turns, max 100)
   ├── Attach VoiceActivityVideoSampler (0.5 FPS speaking, 0.2 FPS silent)
   ├── Start 60-second heartbeat logger
   └── Agent speaks opening message

4. LIVE CONVERSATION (bidirectional streaming)
   User audio ──→ LiveKit ──→ Agent ──→ Gemini Realtime
   Screen frames ──→ LiveKit ──→ Agent ──→ Gemini Realtime (JPEG, adaptive FPS)

   Gemini audio response ──→ Agent ──→ LiveKit ──→ User speakers

   Gemini config:
   ├── Context window: 128K max, compress at 90K → 45K
   ├── Thinking budget: 128 tokens (~100-300ms reasoning)
   ├── Affective dialog: adapts tone to user's voice
   └── Proactivity: speaks when appropriate

5. SESSION END (disconnect or timeout)
   Agent shutdown callback:
   ├── Cancel heartbeat
   ├── Extract transcript (list of {role, text, timestamp})
   ├── Calculate duration
   ├── Create fresh DB engine (isolated from agent loop)
   ├── Update session: ACTIVE → COMPLETED, store transcript + duration
   ├── Trigger scoring: Gemini Flash scores on N dimensions (1-10)
   ├── Generate summary: 2-3 sentence AI recap
   ├── Dispose DB engine
   └── Session complete

6. USER VIEWS RESULTS
   Frontend → GET /api/v1/sessions/{id}
   └── Returns: transcript, scorecard, summary, duration, persona snapshot
```

## Context Intelligence Pipeline

```
DOCUMENT UPLOAD
  User uploads text (emails, notes, transcripts) per agent
  ├── Gemini Embedding 2 generates 3072-dim vector
  ├── Stored in ContextDocument with pgvector
  └── Available for semantic search

BRIEFING GENERATION
  GET /api/v1/context/briefing?persona_id=X
  ├── Check Persona.cached_briefing (return if cached)
  ├── Fetch last 5 documents for this agent
  ├── Gemini Flash synthesizes into structured briefing:
  │   ├── Key Concerns & Objections (with quotes)
  │   ├── Recent Communication Summary
  │   ├── Decision Factors
  │   └── Specific Data Points to Reference
  ├── Cache on Persona.cached_briefing
  └── Injected into agent prompt as "Intelligence Dossier"

SEMANTIC SEARCH
  GET /api/v1/context/search?query=Q&persona_id=X
  ├── Embed query via Gemini Embedding 2
  ├── L2 distance search on pgvector
  └── Return top-k similar documents
```

## Scoring Engine

```
SESSION ENDS → score_session() called

Input: transcript + persona_snapshot
Model: Gemini Flash

Criteria Resolution:
  IF persona has custom scoring_criteria → use those
  ELSE → use 5 defaults:
    Clarity (clear delivery), Objection Handling, Engagement,
    Context Awareness, Closing Strength

Prompt asks Gemini to score each dimension 1-10 with feedback.

Output (JSONB stored on PitchSession.scorecard):
{
  "clarity": {"score": 8, "feedback": "Well-structured opening..."},
  "engagement": {"score": 6, "feedback": "Could ask more questions..."},
  ...
  "overall_score": 7.2,
  "overall_feedback": "Strong fundamentals, needs more probing..."
}

Error handling: On parse failure → neutral scorecard (all 5.0)
```

## Onboarding Agent

A specialized agent mode with unique behaviors:

```
INITIALIZATION
  GET /api/v1/livekit/onboarding-token
  ├── Persona: "Falah" (Aoede voice, warm personality)
  ├── Mode: "onboarding" in room metadata
  ├── Step-specific prompt suffix (platform knowledge + current step guide)
  └── Previous summary injected for returning users

SPECIAL BEHAVIORS (not in regular sessions)
  ├── Screen share detection → triggers contextual guidance
  ├── 15-second silence nudge → "Need any help?"
  ├── Auto-end sequence:
  │   ├── 3:45 → "We're running low on time..."
  │   ├── 4:00 → "Great job! You're all set..."
  │   └── 4:15 → Hard shutdown (ctx.shutdown)
  └── Summary saved to User.onboarding_summary (not PitchSession)

STATE MACHINE
  welcome → explore_ui → create_first_agent → first_session
  Each step: pending → in_progress → completed (or skipped)
```

## Authentication Flow

```
LOCAL AUTH
  POST /register → bcrypt hash → User record
  POST /login → verify hash → JWT token (HS256, 7-day expiry)

GOOGLE OAUTH
  POST /google {credential: google_id_token}
  ├── Verify token via google.oauth2.id_token
  ├── Check email_verified
  ├── Resolve user:
  │   ├── Existing Google account (by google_id) → login
  │   ├── Existing local account (by email) → link google_id
  │   └── New user → create with auth_provider="google"
  └── Return JWT token

PROTECTED ROUTES
  Authorization: Bearer <token>
  ├── Decode JWT → extract user_id
  ├── Fetch User from DB
  └── Inject via Depends(get_current_user)
```

## Database Schema

```
┌──────────────────┐     ┌──────────────────────┐
│      User         │     │     Persona           │
├──────────────────┤     ├──────────────────────┤
│ id (UUID, PK)     │◄────│ user_id (FK)          │
│ email (unique)    │     │ id (UUID, PK)         │
│ password_hash     │     │ type, name, role      │
│ full_name         │     │ personality           │
│ auth_provider     │     │ focus_areas, voice    │
│ google_id         │     │ scoring_criteria (J)  │
│ onboarding_*      │     │ behavior_rules (J)    │
│ created/updated   │     │ opening_message       │
└──────────────────┘     │ is_public, use_count  │
         │                │ cached_briefing       │
         │                └──────────┬────────────┘
         │                           │
         ▼                           ▼
┌──────────────────────┐  ┌──────────────────────┐
│   PitchSession        │  │  ContextDocument      │
├──────────────────────┤  ├──────────────────────┤
│ id (UUID, PK)         │  │ id (UUID, PK)         │
│ user_id (FK)          │  │ user_id (FK)          │
│ persona_id (FK)       │  │ persona_id (FK)       │
│ persona_snapshot (J)  │  │ filename              │
│ transcript (J)        │  │ content_type          │
│ duration_seconds      │  │ content (text)        │
│ status (enum)         │  │ embedding (vec 3072)  │
│ scorecard (J)         │  │ metadata_ (J)         │
│ ai_summary            │  │ created_at            │
│ started_at, ended_at  │  └──────────────────────┘
└──────────────────────┘
                          (J) = JSONB column
```

## Project Structure

```
falah/
├── backend/
│   ├── main.py                          # FastAPI app + legacy WebSocket
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py                # Pydantic Settings (all env vars)
│   │   │   └── security.py              # JWT + bcrypt utilities
│   │   ├── db/
│   │   │   └── database.py              # Async SQLAlchemy engine + session
│   │   └── features/
│   │       ├── auth/
│   │       │   ├── models.py            # User model
│   │       │   ├── schemas.py           # Request/response schemas
│   │       │   ├── service.py           # Auth logic (register, login, Google)
│   │       │   └── router.py            # /api/v1/auth/* endpoints
│   │       ├── personas/
│   │       │   ├── models.py            # Persona model
│   │       │   ├── repository.py        # DB queries
│   │       │   ├── service.py           # CRUD + community listing
│   │       │   ├── templates.py         # 7 starter templates
│   │       │   └── router.py            # /api/v1/personas/* endpoints
│   │       ├── sessions/
│   │       │   ├── models.py            # PitchSession model
│   │       │   ├── repository.py        # DB queries
│   │       │   ├── service.py           # CRUD + scoring + summary generation
│   │       │   └── router.py            # /api/v1/sessions/* endpoints
│   │       ├── livekit/
│   │       │   ├── agent.py             # LiveKit agent worker entrypoint
│   │       │   │                        #   PersonaAgent, TranscriptRecorder,
│   │       │   │                        #   _build_dynamic_prompt(), shutdown logic
│   │       │   ├── service.py           # Room metadata builder, token generator
│   │       │   ├── router.py            # /api/v1/livekit/* endpoints
│   │       │   └── personas/            # Legacy hardcoded persona factory
│   │       │       ├── factory.py
│   │       │       ├── investor/        # Investor persona config + prompts
│   │       │       └── sales_client/    # Sales client config + prompts
│   │       ├── context/
│   │       │   ├── models.py            # ContextDocument model (pgvector)
│   │       │   ├── service.py           # Upload, briefing gen, semantic search
│   │       │   └── router.py            # /api/v1/context/* endpoints
│   │       └── onboarding/
│   │           ├── prompts.py           # Onboarding persona config + step prompts
│   │           ├── service.py           # Onboarding state machine
│   │           └── router.py            # /api/v1/onboarding/* endpoints
│   ├── alembic/                         # DB migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/                         # Shell, routing, layouts
│   │   │   ├── router.tsx               # Route definitions
│   │   │   ├── AppLayout.tsx            # Main layout (TopBar + Dock + Outlet)
│   │   │   └── LiveLayout.tsx           # Fullscreen session layout
│   │   ├── pages/
│   │   │   ├── auth/                    # LoginPage, SignupPage
│   │   │   ├── agents/                  # AgentsPage, AgentDetailPage
│   │   │   ├── community/              # CommunityPage
│   │   │   ├── sessions/               # SessionsPage, SessionDetailPage
│   │   │   ├── live-pitch/             # LivePitchPage (WebRTC session UI)
│   │   │   ├── connectors/             # ConnectorsPage
│   │   │   └── analytics/              # AnalyticsPage (placeholder)
│   │   ├── features/
│   │   │   ├── auth/                    # API calls, GoogleSignInButton
│   │   │   ├── personas/               # PersonaForm, API calls
│   │   │   ├── sessions/               # Session API calls
│   │   │   ├── livekit/                # LiveKit token API
│   │   │   ├── onboarding/             # WelcomeModal, OnboardingBubble, store
│   │   │   └── context/                # Context upload API
│   │   ├── entities/
│   │   │   ├── user/                    # User store (Zustand)
│   │   │   ├── personas/               # Preset persona constants
│   │   │   ├── sessions/               # Score dimensions constants
│   │   │   └── connectors/             # Connector definitions
│   │   ├── widgets/
│   │   │   ├── floating-dock/          # Bottom navigation
│   │   │   ├── top-bar/                # Header with branding
│   │   │   ├── scorecard/              # Score visualization
│   │   │   ├── transcript-viewer/      # Session transcript UI
│   │   │   ├── screen-share-panel/     # Screen share prompt
│   │   │   ├── preflight-drawer/       # Pre-session setup
│   │   │   └── agent-preview-drawer/   # Community agent preview
│   │   └── shared/
│   │       ├── ui/                      # Button, Card, Modal, Badge, etc.
│   │       ├── api/                     # Axios client
│   │       └── lib/                     # Formatters, utilities
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── Makefile
└── requirements/
    ├── PRD.txt                          # Product requirements
    └── ARCHITECTURE.md                  # This file
```

## Key Design Patterns

| Pattern | Where | Why |
|---------|-------|-----|
| **Room Metadata Pre-baking** | LiveKit service | Zero DB calls during live sessions — all context packed at token time |
| **Persona Snapshots** | PitchSession.persona_snapshot | Scoring is immutable even if agent config changes later |
| **Fresh DB Engine per Worker** | Agent shutdown handler | Avoids async event loop conflicts between processes |
| **Adaptive Video Sampling** | VoiceActivityVideoSampler | More frames during speech (0.5 FPS), fewer during silence (0.2 FPS) |
| **Transcript Pruning** | TranscriptRecorder (max 100) | Bounded memory in long sessions |
| **Briefing Cache** | Persona.cached_briefing | Avoid re-synthesizing docs every session |
| **Repository Pattern** | All features | Clean DB query separation from business logic |
| **Dependency Injection** | FastAPI Depends() | Testable, loosely coupled services |
| **Post-Call Scoring** | Session service | Non-blocking, uses cheaper Gemini Flash model |
| **Token Budget Guards** | CRM 1K chars, briefing 2K chars | Prevents context window overflow |

## Configuration Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `CONTEXT_TRIGGER_TOKENS` | 90000 | Start compressing at 70% of 128K window |
| `CONTEXT_TARGET_TOKENS` | 45000 | Compress down to 35% of window |
| `VIDEO_SPEAKING_FPS` | 0.5 | Screen capture rate during speech |
| `VIDEO_SILENT_FPS` | 0.2 | Screen capture rate during silence |
| `VIDEO_INTERVAL_DIRECT` | 2.0 | Min seconds between frames (legacy WS) |
| `THINKING_BUDGET` | 128 | Gemini reasoning tokens (128 = minimal latency) |
| `MAX_BRIEFING_CHARS` | 2000 | Briefing truncation (~500 tokens) |
| `MAX_CRM_CHARS` | 1000 | CRM notes truncation (~250 tokens) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 10080 | JWT lifetime (7 days) |
