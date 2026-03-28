"""
Model Registry — single source of truth for all supported Gemini Live models.

To add a new model:
  1. Add an entry to MODEL_REGISTRY below.
  2. That's it. The superadmin API, validation, and agent all adapt automatically.
"""

from typing import Literal

# ── Supported thinking types ────────────────────────────────────────────────
# "level"  → thinking_level: str  (gemini-3.x style)
# "budget" → thinking_budget: int (gemini-2.x style)
ThinkingType = Literal["level", "budget"]

# ── Registry ─────────────────────────────────────────────────────────────────
MODEL_REGISTRY: dict[str, dict] = {
    "gemini-3.1-flash-live-preview": {
        "label": "Gemini 3.1 Flash Live",
        "tier": "recommended",          # shown in superadmin UI
        "thinking": {
            "type": "level",
            "options": ["minimal", "low", "medium", "high"],
            "default": "minimal",       # lowest latency
        },
        "affective_dialog": False,      # not supported in 3.1
        "proactivity": False,           # not supported in 3.1
    },
    "gemini-2.5-flash-native-audio-preview-12-2025": {
        "label": "Gemini 2.5 Flash Native Audio",
        "tier": "legacy",
        "thinking": {
            "type": "budget",
            "default": 128,             # 128 = minimal reasoning (~100-300ms latency)
        },
        "affective_dialog": True,
        "proactivity": True,
    },
}

# Default model used when DB has no record and env fallback is also missing
DEFAULT_MODEL_ID = "gemini-3.1-flash-live-preview"


def get_model_spec(model_id: str) -> dict | None:
    """Return the registry spec for a model, or None if unknown."""
    return MODEL_REGISTRY.get(model_id)


def is_valid_model(model_id: str) -> bool:
    """Return True if the model_id exists in the registry."""
    return model_id in MODEL_REGISTRY


def get_available_models() -> list[dict]:
    """Return the full registry as a list for API responses."""
    return [
        {
            "id": model_id,
            "label": spec["label"],
            "tier": spec["tier"],
            "capabilities": {
                "thinking": spec["thinking"],
                "affective_dialog": spec["affective_dialog"],
                "proactivity": spec["proactivity"],
            },
        }
        for model_id, spec in MODEL_REGISTRY.items()
    ]


def get_default_settings(model_id: str) -> dict:
    """Return the default settings dict for a given model."""
    spec = MODEL_REGISTRY.get(model_id, {})
    thinking = spec.get("thinking", {})

    if thinking.get("type") == "level":
        return {"thinking_level": thinking.get("default", "minimal")}
    if thinking.get("type") == "budget":
        return {"thinking_budget": thinking.get("default", 128)}
    return {}


def validate_settings(model_id: str, settings: dict) -> list[str]:
    """
    Validate settings against the model's capability spec.
    Returns a list of error strings (empty = valid).
    """
    spec = MODEL_REGISTRY.get(model_id)
    if not spec:
        return [f"Unknown model: {model_id}"]

    errors: list[str] = []
    thinking = spec.get("thinking", {})

    if thinking.get("type") == "level":
        level = settings.get("thinking_level")
        if level is not None and level not in thinking.get("options", []):
            errors.append(
                f"Invalid thinking_level '{level}'. "
                f"Must be one of: {thinking['options']}"
            )

    if thinking.get("type") == "budget":
        budget = settings.get("thinking_budget")
        if budget is not None and not isinstance(budget, int):
            errors.append("thinking_budget must be an integer.")

    return errors
