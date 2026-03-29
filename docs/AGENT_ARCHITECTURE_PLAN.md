# Agent Architecture — System Personas & Foundation Config

## Overview

Two foundational improvements to the agent system:

1. **Starter agents in DB** — move hardcoded personas to the database so they can be updated without code deploys and appear in the same API responses as user-created agents.
2. **Agent Foundation Config** — a single source of truth for cross-agent behaviors (screen share, feature flags, global prompt additions).
3. **Type-aware defaults** — agents should inherit behavior rules appropriate to their type, not pitch-investor rules by default.

---

## File Structure

```
backend/
├── app/
│   ├── core/
│   │   └── config.py                          (existing — infrastructure settings)
│   │
│   ├── features/
│   │   ├── personas/
│   │   │   ├── models.py                      (MODIFY — add is_system column)
│   │   │   ├── schemas.py                     (MODIFY — add is_system to PersonaResponse)
│   │   │   ├── service.py                     (MODIFY — include system in list, guard delete/update)
│   │   │   ├── router.py                      (MODIFY — 403 on system persona edit/delete)
│   │   │   ├── repository.py                  (existing — no change needed)
│   │   │   └── templates.py                   (existing — in-memory form templates, kept as-is)
│   │   │
│   │   ├── livekit/
│   │   │   ├── foundation_config.py           (NEW — feature flags, global prompt, vision config)
│   │   │   ├── agent.py                       (MODIFY — type-aware defaults, import foundation_config)
│   │   │   ├── service.py                     (existing — room metadata builder)
│   │   │   ├── repository.py                  (existing — session save/update)
│   │   │   └── personas/                      (CLEANUP — becomes dead code after seeding)
│   │   │       ├── investor/
│   │   │       │   └── config.py              (DELETE after migration seeds Sarah VC)
│   │   │       └── sales_client/
│   │   │           └── config.py              (DELETE after migration seeds David CTO)
│   │   │
│   │   └── superadmin/
│   │       ├── models.py                      (existing — AIModelConfig table)
│   │       └── router.py                      (existing — model selection UI)
│   │
│   └── alembic/
│       └── versions/
│           └── xxxx_add_is_system_to_personas.py   (NEW — schema + seed data migration)
│
frontend/
├── src/
│   ├── entities/
│   │   └── personas/
│   │       └── constants.ts                   (MODIFY — delete PERSONA_OPTIONS)
│   │
│   ├── features/
│   │   └── personas/
│   │       └── PersonaForm.tsx                (existing — no change needed)
│   │
│   ├── pages/
│   │   └── agents/
│   │       ├── AgentsPage.tsx                 (MODIFY — filter is_system for Starter section)
│   │       └── AgentDetailPage.tsx            (MODIFY — read-only guard when is_system)
│   │
│   └── shared/
│       └── types/
│           └── index.ts                       (MODIFY — add is_system: boolean to Persona)
│
docs/
└── AGENT_ARCHITECTURE_PLAN.md                 (this file)
```

---

## Current Architecture Problems

```
┌───────────────────────────────────────────────────────────┐
│ HARDCODED EVERYWHERE (current state)                       │
│                                                            │
│ frontend/src/entities/personas/constants.ts               │
│   └─ PERSONA_OPTIONS: 2 starter personas                  │
│                                                            │
│ backend/app/features/personas/templates.py                │
│   └─ PERSONA_TEMPLATES: 7 templates (not in DB)           │
│                                                            │
│ backend/app/features/livekit/personas/investor/config.py  │
│   └─ SARAH_VC: hardcoded system prompt                    │
│                                                            │
│ backend/app/features/livekit/personas/sales_client/config.py│
│   └─ DAVID_CTO: hardcoded system prompt                   │
│                                                            │
│ backend/app/features/livekit/agent.py                     │
│   └─ DEFAULT_BEHAVIOR_RULES: 1 flat list (pitch-specific) │
│      applied to ALL agent types                           │
└───────────────────────────────────────────────────────────┘
```

**Problems this causes:**
- Update a starter agent → requires code deploy
- Create an Interview Coach with no custom rules → inherits "comment on slides" rule
- Add a new platform capability (citations, connectors) → must edit every persona's rules
- No way to enable/disable features across all agents without modifying agent.py

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ PLATFORM LAYER  (foundation_config.py — version-controlled) │
│   FEATURE_FLAGS: screen_share_prompting, citations, etc.    │
│   GLOBAL_PROMPT_ADDENDUM: capabilities all agents know      │
│   VISION_CONFIG: frame rate settings                        │
└─────────────────────────────┬───────────────────────────────┘
                              │ merged with ↓
┌─────────────────────────────▼───────────────────────────────┐
│ AGENT LAYER  (Persona table — user-editable)                │
│   system personas: is_system=True, seeded from migration    │
│   user personas:   is_system=False, created by users        │
│   type-aware defaults: investor → pitch rules               │
│                         interview_coach → STAR rules        │
│                         _default → generic conversational   │
└─────────────────────────────┬───────────────────────────────┘
                              │ merged with ↓
┌─────────────────────────────▼───────────────────────────────┐
│ SESSION LAYER  (room metadata — runtime)                    │
│   crm_context, briefing_context, session_history            │
│   grounding_enabled, connectors                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 1 — System Personas in DB ✅ DONE (2026-03-29)

**Effort:** Medium | **Value:** High

### What changes

**DB: `is_system` column on Persona model**
```python
# backend/app/features/personas/models.py
is_system = Column(Boolean, default=False, nullable=False, server_default="false")
```

**Migration: seed system personas**
```python
# alembic/versions/xxxx_add_is_system_to_personas.py
# Schema change: add is_system column
# Data change: INSERT sarah_vc + david_cto with is_system=True, user_id=NULL
```

System persona record (example):
```python
{
    "id": "00000000-0000-0000-0000-000000000001",  # stable UUID
    "user_id": None,   # system-owned
    "is_system": True,
    "type": "investor",
    "name": "Sarah Chen",
    "role": "Managing Partner at Tier 1 VC",
    "personality": "Strict, no-nonsense, hates buzzwords, extremely direct.",
    "focus_areas": "ARR growth rate (>3x), capital efficiency, strong product-market fit evidence.",
    "voice": "Puck",
    "behavior_rules": [...pitch-focused rules...],
    "scoring_criteria": [...],
    "opening_message": "Let's get straight to it. Tell me about your company.",
}
```

**Backend changes**

| File | Change |
|------|--------|
| `personas/models.py` | Add `is_system` column |
| `personas/schemas.py` | `is_system: bool = False` on `PersonaResponse` |
| `personas/service.py` | `list_personas()` includes WHERE `user_id = ? OR is_system = TRUE` |
| `personas/service.py` | `delete_persona()` raises 403 if `persona.is_system` |
| `personas/service.py` | `update_persona()` raises 403 if `persona.is_system` |

**Frontend changes**

| File | Change |
|------|--------|
| `entities/personas/constants.ts` | Delete `PERSONA_OPTIONS` |
| `shared/types/index.ts` | Add `is_system: boolean` to `Persona` |
| `pages/agents/AgentsPage.tsx` | Filter `p.is_system` → "Starter Agents" section |
| `pages/agents/AgentDetailPage.tsx` | Read-only view when `is_system` (no edit button) |

**Cleanup:** Once seeded, `livekit/personas/investor/config.py` and `livekit/personas/sales_client/config.py` become dead code and can be deleted. The agent worker `get_persona_prompt()` fallback stays as safety net.

---

## Part 2 — Type-Aware Behavior Defaults ✅ DONE (2026-03-29)

**Effort:** Low | **Value:** High

Replace the single `DEFAULT_BEHAVIOR_RULES` list in `agent.py` with a dict keyed by persona type.

```python
# backend/app/features/livekit/agent.py
DEFAULT_BEHAVIOR_RULES: dict[str, list[str]] = {
    "investor": [
        "HIGHLY CONVERSATIONAL — React naturally. Use 'Ah I see', 'That makes sense', 'Wait, let me stop you there.'",
        "VISION AWARE — Comment on visible slides, charts, and numbers. Ask about specific claims you can see.",
        "Be SHORT — Maximum 2-3 sentences per response. Let the user speak.",
        "PROBE METRICS — Push back on vague claims. Ask for ARR, growth rate, CAC, LTV numbers.",
        "REALISTIC BUT ENCOURAGING — Appreciate strong metrics when you hear them.",
        "USE YOUR DOSSIER — Weave in past concerns or interests from your intelligence context.",
    ],
    "sales_client": [
        "HIGHLY CONVERSATIONAL — React naturally to what the user says.",
        "VISION AWARE — Comment on product demos, UI walkthroughs, and diagrams you can see on screen.",
        "Be SHORT — Maximum 2-3 sentences per response.",
        "PROBE TECHNICAL CONCERNS — Ask about integration complexity, data privacy, SLA guarantees, and compliance.",
        "RISK-AWARE — Raise realistic procurement objections (vendor risk, switching cost, POC requirements).",
    ],
    "interview_coach": [
        "HIGHLY CONVERSATIONAL — React naturally and warmly to the candidate's answers.",
        "Be SHORT — Ask one question at a time. Let the candidate speak.",
        "STRUCTURED — Guide toward STAR format (Situation, Task, Action, Result) when answers are vague.",
        "ENCOURAGING — Validate strong answers. Redirect weak answers constructively, not harshly.",
        "PROBE DEPTH — Ask follow-up questions: 'What specifically did you do?', 'What was the outcome?'",
    ],
    "onboarding_guide": [
        "WARM AND PATIENT — This is the user's first experience. Be welcoming, not rushed.",
        "Be SHORT — One step at a time. Confirm understanding before moving on.",
        "ENCOURAGING — Celebrate small wins and progress.",
        "ADAPTIVE — If the user is stuck, offer a different explanation or example.",
    ],
    "_default": [
        "HIGHLY CONVERSATIONAL — React naturally. Don't just fire off lists of questions.",
        "Be SHORT — Maximum 2-3 sentences per response.",
        "PROACTIVE DURING DEAD AIR — If the user goes silent, gently prompt them.",
        "ADAPTIVE — Match the user's energy and pace throughout the conversation.",
    ],
}
```

**Selection logic in `_build_dynamic_prompt()`:**
```python
custom_rules = config.get("behavior_rules")
if custom_rules:
    rules_text = "\n".join(f"{i+1}. {rule}" for i, rule in enumerate(custom_rules))
else:
    persona_type = config.get("type", "_default")
    fallback_rules = DEFAULT_BEHAVIOR_RULES.get(persona_type, DEFAULT_BEHAVIOR_RULES["_default"])
    rules_text = "\n".join(f"{i+1}. {rule}" for i, rule in enumerate(fallback_rules))
```

---

## Part 3 — Agent Foundation Config ✅ DONE (2026-03-29)

**Effort:** Low | **Value:** High (unlocks future features cleanly)

### New file: `backend/app/features/livekit/foundation_config.py`

This is the single file to edit for cross-agent behaviors. No DB, no migrations — just Python. Can be promoted to DB-backed (via superadmin) later if live editability is needed.

```python
"""
Agent Foundation Config
=======================
Cross-agent behaviors and feature flags that apply to ALL agents regardless of persona.

Edit this file to:
- Add/remove platform-wide capabilities from all agents' system prompts
- Enable or disable features globally (e.g., turn off citations during an outage)
- Tune vision/screen-share settings

Priority chain:
  Session Layer (metadata) > Agent Layer (persona config) > Platform Layer (this file)
"""

# ---------------------------------------------------------------------------
# Global Prompt Addendum
# Appended to EVERY agent's system prompt after persona-specific rules.
# Tells the agent what platform capabilities are always available.
# ---------------------------------------------------------------------------
GLOBAL_PROMPT_ADDENDUM = """
PLATFORM CAPABILITIES (always active — use these naturally):

SCREEN SHARE: The user can share their screen at any time. When they do, you receive live
video frames. React to what you see. If the user describes something visual without sharing,
prompt them: "Could you share your screen so I can see what you mean?"

SESSION MEMORY: You may have context from previous sessions with this user. Use it to
avoid repeating the same questions and to probe areas they struggled with before.
"""

# ---------------------------------------------------------------------------
# Feature Flags
# Toggle platform features on/off globally without touching agent logic.
# ---------------------------------------------------------------------------
FEATURE_FLAGS: dict[str, bool] = {
    "screen_share_prompting": True,      # Agent suggests screen share for visual topics
    "citations_panel": True,             # Broadcast grounding citations to frontend
    "dead_air_prompting": True,          # Agent prompts if user is silent too long
    "session_history_adaptation": True,  # Adaptive rules added when history exists
    "vision_commentary": True,           # Agent comments on screen share frames
}

# ---------------------------------------------------------------------------
# Vision / Screen Share Config
# ---------------------------------------------------------------------------
VISION_CONFIG: dict[str, float] = {
    "speaking_fps": 0.5,     # Frames/sec sampled while user is speaking
    "silent_fps": 0.2,       # Frames/sec sampled while user is silent
}

# ---------------------------------------------------------------------------
# Context Limits
# Controls how much context is injected into the system prompt.
# ---------------------------------------------------------------------------
CONTEXT_CONFIG: dict[str, int] = {
    "max_briefing_chars": 2000,  # ~500 tokens
    "max_crm_chars": 1000,       # ~250 tokens
    "max_session_history": 3,    # Number of past sessions to include
}
```

### How it integrates with `agent.py`

```python
from app.features.livekit.foundation_config import (
    GLOBAL_PROMPT_ADDENDUM,
    FEATURE_FLAGS,
    VISION_CONFIG,
)

# In _build_dynamic_prompt() — append to end of every prompt:
def _build_dynamic_prompt(...) -> str:
    # ... existing build logic ...
    return f"""{existing_prompt}

{GLOBAL_PROMPT_ADDENDUM}
"""

# In entrypoint() — use feature flags:
if FEATURE_FLAGS["citations_panel"] and grounding_enabled:
    # attach grounding intercept patch

# In AgentSession init — use vision config from foundation:
video_sampler=VoiceActivityVideoSampler(
    speaking_fps=VISION_CONFIG["speaking_fps"],
    silent_fps=VISION_CONFIG["silent_fps"],
)
```

---

## What Was Built (2026-03-29)

| File | Change |
|------|--------|
| `backend/app/features/livekit/foundation_config.py` | **NEW** — `GLOBAL_PROMPT_ADDENDUM`, `FEATURE_FLAGS`, `VISION_CONFIG`, `CONTEXT_CONFIG` |
| `backend/app/features/livekit/agent.py` | Type-aware `DEFAULT_BEHAVIOR_RULES` dict, appends `GLOBAL_PROMPT_ADDENDUM` to every prompt, uses `VISION_CONFIG` for video sampler, logs `FEATURE_FLAGS["citations_panel"]` |
| `backend/app/features/personas/models.py` | Added `is_system` column; `user_id` made nullable for system-owned rows |
| `backend/app/features/personas/schemas.py` | `is_system: bool = False` on `PersonaResponse` |
| `backend/app/features/personas/repository.py` | `list_by_user` and `get_by_id_and_user` now include `is_system=True` rows |
| `backend/app/features/personas/service.py` | `update_persona` and `delete_persona` raise 403 when `persona.is_system` |
| `backend/alembic/versions/d1e2f3a4b5c6_add_is_system_and_seed_system_personas.py` | **NEW** — schema migration + seeds Sarah Chen (VC) and David Park (CTO) |
| `frontend/src/shared/types/index.ts` | Added `is_system: boolean`, made `user_id` nullable |
| `frontend/src/entities/personas/constants.ts` | Deleted `PERSONA_OPTIONS` and `PresetPersona` interface |
| `frontend/src/pages/agents/AgentsPage.tsx` | Splits API response into `systemPersonas` / `customPersonas` by `is_system` flag |
| `frontend/src/pages/agents/AgentDetailPage.tsx` | Removed `PERSONA_OPTIONS` lookup; `isPreset` driven by `data.is_system` from API |

### To activate
```bash
cd backend && alembic upgrade head
```
Then restart the agent worker. Sarah and David will appear under "Starter Agents" from the DB.

---

## Implementation Order

```
Step 1:  foundation_config.py (30 min)
           → new file, no migrations needed
           → wire into agent.py (import + append addendum)

Step 2:  Type-aware defaults (20 min)
           → replace DEFAULT_BEHAVIOR_RULES dict in agent.py

Step 3:  is_system column + migration (1 hour)
           → add column, write seed migration for Sarah + David
           → update personas service (list + guard on delete/update)
           → update schemas

Step 4:  Frontend (1 hour)
           → delete PERSONA_OPTIONS constant
           → add is_system to Persona type
           → filter in AgentsPage for Starter section
           → read-only guard in AgentDetailPage
```

---

## Open Questions

1. **Stable UUIDs for system personas** — should system persona IDs be hardcoded stable UUIDs (so existing room sessions that reference `investor_1` still work), or auto-generated?
2. **Superadmin editability of foundation config** — at what point does the file-based config become a DB-backed superadmin panel? Probably after Phase 3 (Google Docs) when operators need live control.
3. **Template personas** — the 7 `PERSONA_TEMPLATES` in `templates.py` are used in the persona creation form. Should these also become system personas in DB, or stay as in-memory templates?
