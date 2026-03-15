# Phase 4: Adaptive Intelligence + Post-Call Analytics — Task Checklist

## 4A: PitchSession Model + Transcript Capture (Foundation)

### Backend: Database & API
- [x] Create `backend/app/features/sessions/` package (`__init__.py`)
- [x] `models.py` — `PitchSession` model (id, user_id, persona_id, persona_snapshot JSONB, transcript JSONB, duration_seconds, started_at, ended_at, scorecard JSONB, ai_summary text, status enum)
- [x] `schemas.py` — Pydantic schemas: `SessionCreate`, `SessionUpdate`, `SessionResponse`, `ScorecardSchema`
- [x] Alembic migration for `pitch_sessions` table
- [x] `router.py` — Session REST endpoints:
  - [x] `POST /api/v1/sessions/` — create session record (called when room starts)
  - [x] `PATCH /api/v1/sessions/{id}` — update with transcript, end time, status
  - [x] `GET /api/v1/sessions/?persona_id=<uuid>` — list sessions for a persona
  - [x] `GET /api/v1/sessions/{id}` — full session detail with scorecard + transcript
  - [x] `POST /api/v1/sessions/{id}/score` — manually trigger scoring
- [x] Register sessions router in `backend/main.py`

### Agent: Transcript Capture
- [x] Add `TranscriptRecorder` class using `conversation_item_added` AgentSession event
- [x] Collect `{role, text, timestamp}` for each user and agent turn
- [x] On session end → save transcript + metadata to DB (direct DB access via `_save_session_to_db()`)
- [x] Handle edge cases: skip save if no user_id or empty transcript
- [x] Auto-trigger scoring + summary after transcript save
- [x] Pass `user_id` via room metadata so agent can save to correct user

---

## 4B: Post-Call AI Scoring

### Scoring Service
- [x] `backend/app/features/sessions/services.py` — `score_pitch()` function
  - [x] Takes transcript JSONB + persona config
  - [x] Calls Gemini 2.5 Flash with scoring prompt
  - [x] Evaluates 5 dimensions (1-10 each):
    1. **Clarity** — Was the pitch clear and well-structured?
    2. **Objection Handling** — Did they address pushback effectively?
    3. **Engagement** — Did they keep the conversation flowing naturally?
    4. **Context Awareness** — Did they reference relevant background/docs?
    5. **Closing Strength** — Did they drive toward a clear next step?
  - [x] Returns: per-dimension scores, per-dimension feedback, overall score, overall feedback
  - [x] Parse Gemini response as structured JSON (with markdown fence stripping)

### Session Summary Generator
- [x] `generate_session_summary()` function in same services file
  - [x] Takes transcript + persona config
  - [x] Returns 2-3 sentence summary: what was discussed, strengths, weaknesses
  - [x] This summary is stored as `ai_summary` — used by 4C for cross-session memory

### Auto-trigger on Session End
- [x] After transcript is saved → automatically call `score_pitch()` + `generate_session_summary()`
- [x] Save scorecard + ai_summary to the PitchSession record
- [x] Handle scoring failures gracefully (session still saved even if scoring fails)

---

## 4C: Cross-Session Adaptive Prompting (Core Feature)

### Token Router — Inject Session History
- [x] In `backend/app/features/livekit/router.py` `get_livekit_token()`:
  - [x] Query last 3 completed `PitchSession` records for this persona (ordered by `ended_at DESC`)
  - [x] Collect their `ai_summary` + `ended_at` date + overall score
  - [x] Add `session_history` array to room metadata payload
  - [x] Inject `user_id` into room metadata for agent DB writes

### Agent — Build Adaptive Prompt
- [x] In `backend/app/features/livekit/agent.py` `_build_dynamic_prompt()`:
  - [x] Accept new `session_history` parameter (list of {summary, date, score})
  - [x] Add `SESSION HISTORY` section to system prompt
  - [x] Add `ADAPTIVE BEHAVIOR RULES`:
    - Don't repeat the same opening questions from previous sessions
    - Probe weak areas identified in past sessions
    - Acknowledge improvement when you notice it
    - Escalate difficulty each session
    - Introduce new angles the user hasn't been tested on yet

### Agent Entrypoint — Read Session History from Metadata
- [x] In `entrypoint()`: extract `session_history` from room metadata
- [x] Pass to `_build_dynamic_prompt()`

---

## 4D: Enhanced Context Retrieval (Richer Briefing)

### Upgrade Summarization
- [x] In `backend/app/features/context/services.py` `summarize_context()`:
  - [x] Increase from 150 words → ~300-400 words
  - [x] Structure output into sections:
    - **Key Concerns & Objections** (from emails/transcripts)
    - **Recent Communication Summary** (last thread/interaction)
    - **Decision Factors** (what will close or kill the deal)
    - **Specific Data Points to Reference** (exact numbers or statements)
  - [x] Update the prompt template to produce this structured format

---

## 4E: Frontend — Analytics Screen + Session History

### Session API Client
- [x] Create `frontend/src/features/sessions/api.js`:
  - [x] `getSessions(personaId?, limit?)` — list sessions, optionally filtered by persona
  - [x] `getSession(sessionId)` — get full session detail with scorecard + transcript
  - [x] `triggerScoring(sessionId)` — manually trigger scoring from UI

### Analytics Screen (replaced placeholder in App.jsx)
- [x] Overall score gauge (large 6xl number, color-coded green/amber/red)
- [x] Scorecard: 5 dimension bars (horizontal progress bars, color-coded)
- [x] Per-dimension AI feedback text
- [x] AI summary paragraph at top
- [x] Transcript viewer:
  - [x] Turn-by-turn chat-style display with role labels (You / AI)
  - [x] Timestamps on each turn
  - [x] Collapsible (expandable with chevron)
  - [x] Scrollable container (max-h-500px)
- [x] "Dashboard" button to return
- [x] "Generate Scorecard" button if scoring hasn't run yet
- [x] "Retry" + "Dashboard" fallback if no session data

### Dashboard — Past Sessions Section
- [x] Add "Past Sessions" section below persona cards in `DashboardScreen`
- [x] Fetch recent sessions on mount via `getSessions(null, 10)`
- [x] Session card: persona name, date, duration, overall score badge, one-line summary
- [x] Click session card → navigate to analytics view for that session
- [x] "Scoring pending..." indicator for unscored sessions

### Session Flow Wiring
- [x] On session end: navigate to analytics screen (fetches latest session)
- [x] When clicking past session: pass sessionId to analytics screen
- [x] Analytics screen: fetch full session data by ID, display scorecard
- [x] Briefing panel now has max-height scroll for longer structured briefings
- [x] "Adaptive questioning enabled" indicator in PreFlight session info

---

## 4F: E2E Verification

- [ ] Create a custom persona + upload 2-3 context docs + generate briefing
- [ ] Run Session 1 → verify transcript captured in DB
- [ ] Verify scoring runs automatically → scorecard + ai_summary saved
- [ ] Verify analytics screen shows scorecard bars, feedback, transcript
- [ ] Verify dashboard shows Session 1 in "Past Sessions"
- [ ] Run Session 2 with same persona → verify AI references Session 1 topics
- [ ] Verify AI probes weak areas from Session 1 (adaptive behavior)
- [ ] Verify enhanced briefing has structured sections (Key Concerns, etc.)
- [ ] Test hardcoded personas (investor_1, client_1) — sessions save without persona_id UUID
- [ ] Test edge cases: crash mid-session, very short session, no context docs uploaded
