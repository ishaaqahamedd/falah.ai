# Superadmin AI Model Config — Implementation

> **Status: COMPLETED** — 2026-03-29
>
> All Gemini Live model configuration is managed from the superadmin panel.
> Adding a new model in the future = update one registry file. Everything else adapts automatically.

---

## Architecture

```
MODEL_REGISTRY  (single source of truth — model_registry.py)
       ↓
SUPERADMIN API  (reads registry → validates → stores in DB)
       ↓
LIVEKIT AGENT   (reads DB → uses registry → builds correct RealtimeModel)
```

---

## What Was Built

### Phase 1 — Model Registry ✅

**File:** `backend/app/features/superadmin/model_registry.py` *(new)*

Single dict defining every supported model, its capabilities, and defaults.
Both the agent and superadmin API import from here — zero duplication.

```python
MODEL_REGISTRY = {
    "gemini-3.1-flash-live-preview": {
        "label": "Gemini 3.1 Flash Live",
        "tier": "recommended",
        "thinking": {
            "type": "level",
            "options": ["minimal", "low", "medium", "high"],
            "default": "minimal",
        },
        "affective_dialog": False,   # not supported in 3.1
        "proactivity": False,        # not supported in 3.1
    },
    "gemini-2.5-flash-native-audio-preview-12-2025": {
        "label": "Gemini 2.5 Flash Native Audio",
        "tier": "legacy",
        "thinking": {
            "type": "budget",
            "default": 128,
        },
        "affective_dialog": True,
        "proactivity": True,
    },
}

DEFAULT_MODEL_ID = "gemini-3.1-flash-live-preview"
```

Helper functions exported: `is_valid_model()`, `get_available_models()`, `get_default_settings()`, `validate_settings()`.

---

### Phase 2 — Database Migration ✅

**File:** `backend/alembic/versions/b2c3d4e5f6a7_add_model_settings_and_update_default.py` *(new)*

- Added `settings` JSONB column to `ai_model_config` table
- Migrated the active model row from `gemini-2.5-...` → `gemini-3.1-flash-live-preview`
- Seeded default settings: `{"thinking_level": "minimal"}`
- Safe `ON CONFLICT DO NOTHING` for fresh installs

**SQLAlchemy model** (`backend/app/features/superadmin/models.py`) updated to include:
```python
settings = Column(JSONB, nullable=True)
```

**To apply:**
```bash
alembic upgrade head
```

---

### Phase 3 — Config & Schemas ✅

**`backend/app/core/config.py`**

| Old | New |
|-----|-----|
| `THINKING_BUDGET: int = 128` | `THINKING_LEVEL: str = "minimal"` |
| `GEMINI_LIVE_MODEL = "gemini-2.5-..."` | `GEMINI_LIVE_MODEL = "gemini-3.1-flash-live-preview"` |

Both are now **fallback-only** — the DB value always wins at runtime.

**`backend/app/features/superadmin/schemas.py`**

Removed `AVAILABLE_LIVE_MODELS` (replaced by registry). New schemas:

```python
class ModelSettings(BaseModel):
    thinking_level: Optional[str] = None   # gemini-3.x
    thinking_budget: Optional[int] = None  # gemini-2.x

class ModelConfigResponse(BaseModel):
    config_key: str
    model_id: str
    settings: Optional[ModelSettings] = None
    updated_at: Optional[datetime] = None

class ModelConfigUpdate(BaseModel):
    model_id: str
    settings: Optional[ModelSettings] = None

class ModelCapability(BaseModel):
    id: str
    label: str
    tier: str
    capabilities: dict  # full spec from registry

class AIModelsResponse(BaseModel):
    current: ModelConfigResponse
    available: list[ModelCapability]
```

---

### Phase 4 — Superadmin Service & Router ✅

**`backend/app/features/superadmin/service.py`**

- `get_live_model()` — fetches model + settings from DB, seeds default if missing
- `update_live_model(model_id, settings, updated_by)` — validates against registry, merges with defaults, persists
- `get_available_models()` — returns full registry list for the API

**`backend/app/features/superadmin/router.py`**

`GET /api/v1/superadmin/ai/models` — response shape:
```json
{
  "current": {
    "model_id": "gemini-3.1-flash-live-preview",
    "settings": { "thinking_level": "minimal" },
    "updated_at": "..."
  },
  "available": [
    {
      "id": "gemini-3.1-flash-live-preview",
      "label": "Gemini 3.1 Flash Live",
      "tier": "recommended",
      "capabilities": {
        "thinking": { "type": "level", "options": ["minimal","low","medium","high"], "default": "minimal" },
        "affective_dialog": false,
        "proactivity": false
      }
    }
  ]
}
```

`PUT /api/v1/superadmin/ai/models` — request body:
```json
{ "model_id": "gemini-3.1-flash-live-preview", "settings": { "thinking_level": "low" } }
```

---

### Phase 5 — Agent: Dynamic RealtimeModel Builder ✅

**`backend/app/features/livekit/agent.py`**

**`get_active_live_config()`** — replaces old `get_active_live_model()`:
```python
async def get_active_live_config() -> tuple[str, dict]:
    # Returns (model_id, settings) from DB
    # Falls back to (settings.GEMINI_LIVE_MODEL, {"thinking_level": settings.THINKING_LEVEL})
```

**`build_realtime_model(model_id, voice_id, model_settings)`** — new function:
- Reads model spec from `MODEL_REGISTRY`
- Builds `ThinkingConfig` using `thinking_level` (3.x) or `thinking_budget` (2.x)
- Only passes `enable_affective_dialog` / `proactivity` when the model actually supports them
- No hardcoded flags — fully driven by the registry

**`PersonaAgent.__init__`** — now takes `model_settings: dict` and calls `build_realtime_model()`.

**`entrypoint()`** — updated to unpack both values:
```python
active_model, model_settings = await get_active_live_config()
agent = PersonaAgent(..., model_id=active_model, model_settings=model_settings)
```

---

### Phase 6 — Frontend: Dynamic Superadmin UI ✅

**`frontend/src/features/superadmin/types.ts`** — new types: `ModelSettings`, `ModelThinkingCapability`, `ModelCapabilities`, updated `LiveModel` and `AvailableModel`.

**`frontend/src/features/superadmin/api.ts`** — `updateAIModel()` now accepts `ModelSettings`.

**`frontend/src/pages/superadmin/ai/AIPage.tsx`** — fully dynamic:

| Model capability | Control rendered |
|-----------------|-----------------|
| `thinking.type === "level"` | 2×2 button grid: Minimal / Low / Medium / High with descriptions |
| `thinking.type === "budget"` | Number input with hint text |
| `affective_dialog` | Feature flag badge (✓ green / ✗ muted) |
| `proactivity` | Feature flag badge (✓ green / ✗ muted) |

- Selecting a model auto-resets settings to that model's defaults
- Active model card shows current thinking level/budget
- "Apply" saves both `model_id` and `settings` in one request

---

## Complete File Changelist

| File | Action | Notes |
|------|--------|-------|
| `backend/app/features/superadmin/model_registry.py` | **CREATED** | Single source of truth |
| `backend/alembic/versions/b2c3d4e5f6a7_add_model_settings_and_update_default.py` | **CREATED** | Adds settings column, seeds 3.1 |
| `backend/app/features/superadmin/models.py` | Edited | Added `settings` JSONB column |
| `backend/app/core/config.py` | Edited | `THINKING_LEVEL`, default model → 3.1 |
| `backend/app/features/superadmin/schemas.py` | Edited | New schemas, removed `AVAILABLE_LIVE_MODELS` |
| `backend/app/features/superadmin/service.py` | Edited | Registry validation, settings persistence |
| `backend/app/features/superadmin/router.py` | Edited | Returns capabilities, accepts settings on PUT |
| `backend/app/features/livekit/agent.py` | Edited | `build_realtime_model()`, no hardcoded flags |
| `frontend/src/features/superadmin/types.ts` | Edited | New capability types |
| `frontend/src/features/superadmin/api.ts` | Edited | `updateAIModel` accepts settings |
| `frontend/src/pages/superadmin/ai/AIPage.tsx` | Edited | Dynamic thinking controls + feature badges |

---

## Future Model Rollout

When Google releases a new model (e.g. `gemini-4.0-flash-live`):

1. Add one entry to `backend/app/features/superadmin/model_registry.py`
2. Run `alembic upgrade head` if a new migration is needed
3. Done — API, UI, and agent adapt automatically

```python
"gemini-4.0-flash-live": {
    "label": "Gemini 4.0 Flash Live",
    "tier": "recommended",
    "thinking": {
        "type": "level",
        "options": ["minimal", "low", "medium", "high"],
        "default": "minimal",
    },
    "affective_dialog": False,
    "proactivity": False,
},
```
