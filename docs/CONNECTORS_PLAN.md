# Connectors & Grounding — Implementation Plan

## Overview

Enable agents to connect to external services (Google Search, Google Workspace, Lyria) during live sessions. Users configure which connectors are active when creating or editing an agent/persona.

---

## Architecture

```
User (creates persona)
  └─ selects connectors: [google_search, google_docs, google_calendar]
       │
       ▼
Persona model stores: grounding_enabled, connectors: []
       │
       ▼
Session start → room metadata includes connector config + user OAuth tokens
       │
       ▼
Agent receives config → attaches tools to Gemini API call
       │
       ▼
User says "create a doc about X" → Gemini calls create_doc() function
       │
       ▼
Backend executes Google API call with user's OAuth token
       │
       ▼
Result (doc URL, event ID, etc.) returned to agent → agent tells user
```

---

## Phase 1 — Google Search Grounding ✅ DONE (2026-03-29)

**Effort:** Low | **Value:** High | **Start here.**

Gemini 2.5 has native built-in grounding via Google Search. No OAuth needed — just a flag in the API call.

### What was built

| File | Change |
|------|--------|
| `backend/app/features/personas/models.py` | `grounding_enabled` Boolean column |
| `backend/app/features/personas/schemas.py` | Field in `PersonaCreate`, `PersonaUpdate`, `PersonaResponse` |
| `backend/app/features/personas/service.py` | Pass `grounding_enabled` on create |
| `backend/app/features/livekit/service.py` | Inject flag into room metadata |
| `backend/app/features/livekit/agent.py` | Read flag → pass `types.Tool(google_search=types.GoogleSearch())` to `RealtimeModel` |
| `backend/alembic/versions/c1d2e3f4a5b6_add_grounding_enabled_to_personas.py` | DB migration |
| `frontend/src/shared/types/index.ts` | `grounding_enabled: boolean` on `Persona` interface |
| `frontend/src/features/personas/PersonaForm.tsx` | Toggle UI + field in submit payload |

### To activate
Run `alembic upgrade head` then restart the agent worker.

### Test
Ask agent: "What's the latest news on Series A funding in MENA?" — it should ground the answer with real search results instead of hallucinating.

---

## Phase 2 — Google Docs (Create & Read) ⬜ TODO

**Effort:** Medium | **Value:** High

Enables the agent to create a Google Doc when the user asks for it (e.g. "create a one-pager about our product"), then share the link in the conversation.

### What changes

**New table: `user_oauth_tokens`**
```sql
CREATE TABLE user_oauth_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    provider    TEXT NOT NULL,           -- 'google'
    scopes      TEXT[] NOT NULL,         -- ['docs', 'drive', 'calendar', ...]
    access_token  TEXT NOT NULL,
    refresh_token TEXT,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT now()
);
```

**New OAuth flow: `backend/app/features/connectors/`**
```
connectors/
  router.py        # GET /connectors/google/auth → redirect to Google OAuth
                   # GET /connectors/google/callback → exchange code, store token
  service.py       # refresh_token(), get_valid_token()
  repository.py    # store/retrieve tokens per user
  tools/
    google_docs.py   # create_doc(title, content) → returns doc URL
    google_sheets.py # create_sheet(title, rows) → returns sheet URL
    google_calendar.py # add_event(title, start, end) → returns event link
```

**Backend: `agent.py` — function calling tools**
```python
# When connectors include 'google_docs':
from app.features.connectors.tools.google_docs import create_google_doc

async def create_doc(title: str, content: str) -> str:
    """Creates a Google Doc and returns the shareable URL."""
    token = await get_valid_token(user_id, provider="google")
    return await create_google_doc(token, title, content)
```

The Gemini model will call `create_doc()` as a function when the user says anything like:
- "create a doc summarizing what we discussed"
- "write up a one-pager for my pitch"
- "save this conversation as a document"

**Frontend: Persona creation form**
- "Connected apps" section with OAuth connect buttons
- Show connected state (green tick) or "Connect Google" CTA
- Per-connector scope selection (Docs only vs. full Workspace)

**Room metadata addition**
```json
{
  "connectors": ["google_docs"],
  "user_id": "..."
}
```
Agent fetches the OAuth token server-side when a tool is invoked.

---

## Phase 3 — Google Sheets & Calendar ⬜ TODO

**Effort:** Low (incremental on Phase 2 — same OAuth tokens)**

Same OAuth token from Phase 2. Just add new tool functions:

**`google_sheets.py`**
```python
async def create_sheet(token, title: str, rows: list[list]) -> str:
    """Creates a Google Sheet and returns shareable URL."""
```

**`google_calendar.py`**
```python
async def add_calendar_event(token, title: str, start: str, end: str, description: str) -> str:
    """Creates a calendar event and returns event link."""
```

**Use cases:**
- "Schedule a follow-up with the investor for next Tuesday" → creates calendar event
- "Export my session scores to a spreadsheet" → creates a sheet with scorecard data

---

## Phase 4 — Gmail (Read & Send) ⬜ TODO

**Effort:** Medium-High | **Sensitive scope — requires Google verification for production**

Gmail OAuth scope is restricted. In dev/testing it works for any account. For production (public users), Google requires an app verification process.

**`gmail.py`**
```python
async def send_email(token, to: str, subject: str, body: str) -> str:
    """Sends an email via Gmail API. Returns message ID."""

async def read_recent_emails(token, query: str, limit: int = 5) -> list[dict]:
    """Reads emails matching query. Returns list of {from, subject, snippet}."""
```

**Use cases:**
- "Send a follow-up email to the investor we practiced with" → drafts + sends
- "Read my last email from Sarah so I can practice responding to her objections" → agent uses real email as context

---

## Phase 5 — Lyria (Music / Audio Generation) ⬜ TODO

**Effort:** High | **Vertex AI only — limited preview access**

Lyria is Google DeepMind's music generation model. Only available via Vertex AI, not the standard Gemini API. Requires separate Vertex AI project + allowlist access.

**Use case in Falah:**
- Background music/ambiance for sessions
- "Generate a professional background track for my investor pitch video"

**What's needed:**
- Vertex AI project with Lyria access (apply via Google)
- Separate `vertexai` Python client alongside existing `google-genai`
- New endpoint: `POST /generate/music` → streams audio back

**This is lowest priority** — evaluate after Phase 1-4 are live.

---

## Persona Schema (final state)

```python
class Persona(Base):
    # ... existing fields ...

    # Connectors
    grounding_enabled: bool             # Phase 1 — Google Search
    connectors: list[str]               # Phase 2+ — ['google_docs', 'google_sheets', 'google_calendar', 'gmail']
```

---

## Frontend UX — Connector Setup (Persona creation)

```
┌─────────────────────────────────────────────────────┐
│  AGENT CAPABILITIES                                  │
│                                                      │
│  [✓] Google Search Grounding                        │
│      Agent can search the web in real-time           │
│                                                      │
│  CONNECTED APPS                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ 🔴 Google Workspace    [Connect Google →]    │   │
│  │    Docs · Sheets · Calendar · Gmail          │   │
│  └──────────────────────────────────────────────┘   │
│  (after connecting)                                  │
│  ┌──────────────────────────────────────────────┐   │
│  │ 🟢 Google Workspace    [Disconnect]          │   │
│  │ [✓] Docs  [✓] Sheets  [✓] Calendar  [ ] Gmail│   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Order

```
Week 1:  Phase 1 — Google Search Grounding ✅ DONE
           → grounding_enabled on persona model + DB migration
           → pass google_search tool to Gemini API
           → UI toggle in persona form

Week 2:  Phase 2 — OAuth + Google Docs
           → user_oauth_tokens table + OAuth endpoints
           → create_doc() function calling tool
           → "Create doc" trigger in live session
           → UI: Connect Google button in persona form

Week 3:  Phase 3 — Sheets + Calendar (incremental)
           → reuse OAuth tokens from Phase 2
           → add new tool functions

Week 4+: Phase 4 — Gmail (if Google app verification in progress)
         Phase 5 — Lyria (if Vertex AI access granted)
```

---

## Phase 1.5 — Search Citations in Live UI ⬜ TODO

Show real-time citations in the live session UI when Google Search Grounding is active.

### Confirmed feasibility (2026-03-29)

- `LiveServerContent.grounding_metadata` exists in the Gemini Live API wire protocol
- `grounding_metadata.grounding_chunks[].web` contains `{title, uri}` per source
- The livekit-plugins-google plugin **receives but silently drops** this field — zero references in `realtime_api.py`
- No plugin modification needed — intercept via instance-level monkey-patch

### How to intercept

Patch `RealtimeSession._handle_server_content` on the instance **before** `session.start()`:

```python
# agent.py — before session.start(), when grounding_enabled
original_factory = session._llm.session

def patched_factory():
    rt_session = original_factory()
    original_handle = rt_session._handle_server_content

    def handle_with_grounding(server_content):
        original_handle(server_content)          # normal flow untouched
        if server_content.grounding_metadata:
            chunks = server_content.grounding_metadata.grounding_chunks or []
            citations = [
                {"title": c.web.title, "url": c.web.uri}
                for c in chunks if c.web and c.web.uri
            ]
            if citations:
                asyncio.create_task(broadcast_citations(ctx.room, citations))

    rt_session._handle_server_content = handle_with_grounding
    return rt_session

session._llm.session = patched_factory
```

Broadcast via existing data channel (same pattern as live transcripts):
```python
async def broadcast_citations(room, citations):
    await room.local_participant.publish_data(
        json.dumps({"type": "citations", "sources": citations}).encode(),
        topic="citations"
    )
```

### What to build

| Step | File | Change |
|------|------|--------|
| Patch hook | `livekit/agent.py` | Inject grounding hook before `session.start()` |
| Broadcast | `livekit/agent.py` | `broadcast_citations()` via data channel |
| Frontend listener | `LivePitchPage.tsx` | Listen for `type: "citations"` on data channel |
| Citations panel UI | `LivePitchPage.tsx` | Collapsible panel, one entry per agent turn |

---

## Open Questions

1. **Token storage security** — OAuth tokens should be encrypted at rest. Use Fernet symmetric encryption (already in Python stdlib via `cryptography` package)?
2. **Scope management** — User connects Google once and grants all scopes, or scope-per-connector?
3. **Rate limits** — Google Docs/Sheets API has per-user quotas. Need error handling when quota exceeded.
4. **Search grounding cost** — Google Search grounding adds ~$35/1000 queries on top of Gemini cost. Confirm this is acceptable.
