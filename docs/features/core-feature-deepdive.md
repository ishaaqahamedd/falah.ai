# LiveKit Agent — Feature Deep-Dive

## Overview

The LiveKit Agent is the core real-time AI engine of Falah.ai. It runs as a **separate process** from the FastAPI API server, connects to LiveKit Cloud, joins WebRTC rooms, orchestrates Gemini Live API sessions, captures transcripts, and triggers post-session AI scoring.

## How It Works

### Session Lifecycle

```
User clicks "Start Session" in UI
         │
         ▼
Frontend calls GET /api/v1/livekit/token
    → Backend creates LiveKit room with metadata (persona config, context, session history)
    → Returns JWT token to frontend
         │
         ▼
Frontend joins LiveKit room via WebRTC
         │
         ▼
Agent Worker detects new room → entrypoint() fires
    → Parses room metadata (persona, context, session history, user_id)
    → Builds dynamic system prompt
    → Connects to Gemini Live API
    → Starts bidirectional audio streaming
         │
         ▼
User talks ←→ AI responds (real-time audio)
User shares screen → Gemini analyzes frames
         │
         ▼
User disconnects / session ends
    → TranscriptRecorder saves [{role, text, timestamp}] to DB
    → Auto-triggers AI scoring (5 dimensions, 1-10 each)
    → Auto-triggers AI summary generation
    → Session record updated with transcript, scorecard, ai_summary
```

### Room Metadata Schema

The metadata is a JSON object passed when creating the LiveKit room:

```json
{
  "user_id": "uuid",
  "persona_id": "uuid or 'onboarding'",
  "persona_config": {
    "name": "Sarah",
    "role": "Tier 1 VC Partner",
    "personality": "...",
    "focus_areas": "...",
    "voice": "Kore",
    "scoring_criteria": [...],
    "behavior_rules": [...],
    "opening_message": "..."
  },
  "context": "Pre-call briefing text...",
  "session_history": [
    {"summary": "...", "date": "2026-03-25", "score": 7.2}
  ],
  "session_id": "uuid"
}
```

### Adaptive Prompting Rules

When `session_history` is present, the agent's system prompt includes:
1. Don't repeat the same opening questions from previous sessions
2. Probe weak areas identified in past sessions
3. Acknowledge improvement when you notice it
4. Escalate difficulty each session
5. Introduce new angles the user hasn't been tested on yet

## Edge Cases

| Edge Case | Current Handling |
|-----------|-----------------|
| User disconnects mid-session | Transcript saved with whatever was captured; status set to `crashed` |
| Very short session (< 30s) | Transcript still saved; scoring may produce generic results |
| No `user_id` in metadata | Skip DB save entirely (agent logs warning) |
| Empty transcript | Skip save |
| Scoring API fails | Session still saved without scorecard; can be manually re-triggered via `POST /sessions/{id}/score` |
| Onboarding mode | Different metadata shape; no session/scoring created |
| Persona deleted after session | `persona_snapshot` JSONB preserves config for analytics |

## Files

| File | Purpose |
|------|---------|
| `agent.py` | Main agent worker — entrypoint, Gemini session setup, audio/video pipeline |
| `router.py` | REST endpoints for token generation |
| `service.py` | Room creation, JWT token generation via LiveKit SDK |
| `db_helpers.py` | Direct async DB access for the agent worker (bypasses FastAPI DI) |
| `handlers/` | Event handlers for agent lifecycle events |
| `personas/` | Hardcoded persona prompt builders |
| `vision/` | Screen share frame processing |
