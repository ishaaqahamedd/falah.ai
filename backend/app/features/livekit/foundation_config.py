"""
Agent Foundation Config
=======================
Cross-agent behaviors and feature flags that apply to ALL agents regardless of persona.

Edit this file to:
- Add/remove platform-wide capabilities from all agents' system prompts
- Enable or disable features globally (e.g., turn off citations during an outage)
- Tune vision/screen-share frame rate settings

Priority chain:
  Session Layer (room metadata) > Agent Layer (persona config) > Platform Layer (this file)
"""

# ---------------------------------------------------------------------------
# Global Prompt Addendum
# Appended to EVERY agent's system prompt after persona-specific rules.
# Tells the agent what platform capabilities are always available.
# ---------------------------------------------------------------------------
GLOBAL_PROMPT_ADDENDUM = """\
PLATFORM CAPABILITIES (always active — use these naturally):

SCREEN SHARE: The user can share their screen at any time. When they do, you receive live \
video frames. React to what you see — comment on slides, diagrams, UI, or anything relevant. \
If the user describes something visual without sharing their screen, prompt them: \
"Could you share your screen so I can see what you mean?"

SESSION MEMORY: You may have context from previous sessions with this user. Use it to \
avoid repeating the same opening questions and to probe areas they struggled with before.\
"""

# ---------------------------------------------------------------------------
# Feature Flags
# Toggle platform capabilities on/off globally without touching agent logic.
# ---------------------------------------------------------------------------
FEATURE_FLAGS: dict[str, bool] = {
    "screen_share_prompting": True,       # Agent suggests screen share for visual topics
    "citations_panel": True,              # Broadcast grounding citations to frontend UI
    "dead_air_prompting": True,           # Agent prompts if user goes silent too long
    "session_history_adaptation": True,   # Adaptive rules injected when history exists
    "vision_commentary": True,            # Agent comments on screen share frames
}

# ---------------------------------------------------------------------------
# Vision / Screen Share Config
# Controls how often the agent receives video frames during a session.
# ---------------------------------------------------------------------------
VISION_CONFIG: dict[str, float] = {
    "speaking_fps": 0.5,   # Frames/sec sampled while user is speaking
    "silent_fps": 0.2,     # Frames/sec sampled while user is silent
}

# ---------------------------------------------------------------------------
# Context Limits
# Controls how much context is injected into the system prompt.
# ---------------------------------------------------------------------------
CONTEXT_CONFIG: dict[str, int] = {
    "max_briefing_chars": 2000,   # ~500 tokens — briefing from uploaded docs
    "max_crm_chars": 1000,        # ~250 tokens — manual CRM notes from user
    "max_session_history": 3,     # Number of past sessions to include
}
