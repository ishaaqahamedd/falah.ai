# Plan: Agent Canvas — Artifacts Panel for Live Sessions

## What It Is

A side panel in the live session that renders structured visual output from the agent — analysis, tables, scorecards, action plans, summaries. The user explicitly activates it with a **Canvas toggle button** in the bottom bar. When Canvas mode is ON, the agent shifts from pure conversation into "show and tell": it speaks a brief summary and simultaneously renders rich content in the panel.

Like Claude's Artifacts, but inside a live voice session — and user-controlled, not agent-guessed.

---

## Why User-Controlled (Not Agent-Decided)

| Approach | Problem |
|----------|---------|
| Agent auto-decides | Unpredictable — fires randomly, requires heavy prompt engineering, Gemini misfires |
| User toggles Canvas mode | Deterministic — agent gets a clear directive, user is in control, no surprises |

**Industry reference:** ChatGPT Canvas = explicit mode switch. Claude Artifacts = auto but misfires. For a **voice session**, the toggle is correct — voice already takes attention, don't let the agent randomly open panels.

---

## Why Now (Before Connectors)

Canvas is the **rendering layer** that connectors depend on:

```
Gmail connector  → shows draft         ┐
Docs connector   → shows document      ├─ all need canvas to display output
Sheets connector → shows table/chart   │
Figma/Canva      → shows preview card  ┘
```

Canvas first = every connector gets a display surface for free.

---

## Phase 0 — Feasibility Test (Build This First)

Before building the full feature, run a minimal proof-of-concept to de-risk the two unknowns:

### Test 1 — `RunContext.userdata` + room access inside a tool
```python
@function_tool
async def echo_canvas(context: RunContext, message: str) -> str:
    """Test tool — echoes back via data channel."""
    room = context.userdata.get("room")
    if room:
        await room.local_participant.publish_data(
            json.dumps({"type": "canvas_test", "message": message}).encode(),
            reliable=True
        )
    return f"Canvas test: {message}"
```
Start a session, say "test canvas echo hello" → check frontend receives `canvas_test` message.

**Pass:** userdata pattern works → proceed.
**Fail:** Switch to module-level room registry (fallback documented below).

### Test 2 — Custom function tool + GoogleSearch in same session
Attach both `echo_canvas` and `google.tools.GoogleSearch()` to the same `AgentSession`. Start session, trigger a search and a canvas call. Check both work without errors.

**Pass:** No conflict → canvas + grounding can coexist.
**Fail:** Make them mutually exclusive — canvas tool only when `grounding_enabled=False`.

### Fallback for Test 1 failure — Module-level room registry
```python
# backend/app/features/livekit/canvas_tool.py
_room_registry: dict[str, Any] = {}  # room_name → room object

def register_room(room_name: str, room) -> None:
    _room_registry[room_name] = room

def unregister_room(room_name: str) -> None:
    _room_registry.pop(room_name, None)
```
Set in `entrypoint()` before session starts, clear in shutdown callback.

---

## File Structure

### Backend

Follows the existing **3-Layer Architecture** pattern. Canvas is a sub-module of `livekit/` since it's session-scoped and has no DB model of its own.

```
backend/app/features/livekit/
├── agent.py                          # MODIFY — attach tool, userdata, data_received handler
├── foundation_config.py              # MODIFY — canvas flag + GLOBAL_PROMPT_ADDENDUM
├── handlers/
│   ├── session_handler.py            # MODIFY — unregister room on shutdown
│   └── onboarding_handler.py
├── canvas/                           # NEW sub-module
│   ├── __init__.py                   # exports: render_canvas, CanvasConfig
│   ├── tool.py                       # render_canvas() function tool
│   ├── config.py                     # CanvasConfig — behavior rules, allowed types, limits
│   └── schemas.py                    # CanvasArtifact, ArtifactType — shared type contracts
├── personas/
├── vision/
└── ...
```

**Why a sub-module, not a top-level feature?**
Canvas has no users table, no HTTP router, no DB model — it's purely session-scoped real-time behavior. It belongs inside `livekit/` alongside `handlers/` and `vision/`, not as a peer feature module. When connectors arrive, each connector adds its own artifact type to `canvas/config.py` — no structural change needed.

### Frontend

Follows the existing **Hybrid FSD** pattern. Canvas is a widget (compound component) used inside the live-pitch page.

```
frontend/src/
├── widgets/
│   ├── canvas-panel/                 # NEW widget
│   │   ├── index.ts                  # public export
│   │   ├── CanvasPanel.tsx           # panel shell — tabs, open/close, header
│   │   ├── ArtifactRenderer.tsx      # routes artifact_type → correct renderer
│   │   ├── renderers/
│   │   │   ├── MarkdownRenderer.tsx  # markdown artifact
│   │   │   ├── BulletListRenderer.tsx
│   │   │   ├── TableRenderer.tsx
│   │   │   └── ScorecardRenderer.tsx
│   │   └── types.ts                  # CanvasArtifact interface, ArtifactType
│   └── transcript-viewer/            # existing
├── pages/
│   └── live-pitch/
│       └── LivePitchPage.tsx         # MODIFY — canvas state, button, toggle message
└── entities/
    └── canvas/                       # NEW entity
        └── constants.ts              # ARTIFACT_TYPES, MAX_ARTIFACTS, default config
```

**Why a widget, not a page-level component?**
`CanvasPanel` is a compound component with internal state (tabs, scroll, active artifact). It will be reused in the session detail page later (to replay artifacts from a past session). Widgets are the right layer for reusable compound components per the existing architecture.

---

## Canvas Config (`canvas/config.py`)

This is where you control canvas behavior without touching the tool or the agent:

```python
"""
Canvas Configuration — controls what the agent can render and how.
Edit this file to change canvas behavior without touching agent.py or the tool.
"""

from dataclasses import dataclass, field


@dataclass
class CanvasConfig:
    # Which artifact types are enabled (disable to restrict agent output)
    allowed_types: list[str] = field(default_factory=lambda: [
        "markdown",
        "bullet_list",
        "table",
        "scorecard",
    ])

    # Max artifacts per session (prevents panel overflow)
    max_artifacts: int = 10

    # Max content length per artifact (chars) — prevents runaway generation
    max_content_length: int = 8000

    # Spoken summary max length (words) — agent should stay brief
    max_spoken_summary_words: int = 40

    # Behavior rules injected into the agent's system prompt when canvas mode is ON
    # Edit these to change how the agent uses canvas
    behavior_rules: list[str] = field(default_factory=lambda: [
        "CANVAS IS ACTIVE — the user has enabled the canvas panel.",
        "Use render_canvas() for any structured output: analysis, comparisons, plans, scorecards.",
        "Always call render_canvas() AND speak a SHORT summary (1-2 sentences max).",
        "NEVER read the full canvas content aloud — just highlight 1-2 key points.",
        "Use 'scorecard' type for ratings and evaluations.",
        "Use 'table' type for comparisons between 2+ options.",
        "Use 'bullet_list' type for action items, key takeaways, or steps.",
        "Use 'markdown' type for summaries, plans, and freeform analysis.",
    ])

    # Rules injected when canvas mode is OFF
    canvas_off_rules: list[str] = field(default_factory=lambda: [
        "CANVAS IS OFF — respond conversationally. Do NOT call render_canvas().",
    ])


# Global instance — imported by agent.py and canvas/tool.py
CANVAS_CONFIG = CanvasConfig()
```

---

## Data Flow (Full)

```
[Frontend]                          [Backend agent worker]
   │                                        │
   │  User taps Canvas button               │
   │──{ type:"canvas_mode", enabled:true }──▶│
   │                                        │  session.userdata["canvas_mode"] = True
   │                                        │  Dynamic prompt updated with behavior_rules
   │                                        │
   │  User speaks: "analyze my pitch"       │
   │──────────── (audio) ──────────────────▶│
   │                                        │  Gemini → calls render_canvas()
   │                                        │  Tool validates type + content length
   │                                        │  Tool broadcasts canvas_artifact
   │◀──{ type:"canvas_artifact", ... }──────│
   │                                        │  Agent speaks spoken_summary
   │◀──{ type:"transcript_turn", ... }──────│
   │                                        │
   │  Canvas panel slides open              │
   │  Artifact renders (scorecard/table/…)  │
```

---

## Backend Implementation Detail

### `canvas/schemas.py`
```python
from typing import Literal
from pydantic import BaseModel

ArtifactType = Literal["markdown", "bullet_list", "table", "scorecard"]

class CanvasArtifact(BaseModel):
    artifact_type: ArtifactType
    title: str
    content: str        # JSON string — schema varies by type
    spoken_summary: str
    ts: float
```

### `canvas/tool.py`
```python
import json, time, logging
from livekit.agents import function_tool, RunContext
from .config import CANVAS_CONFIG

logger = logging.getLogger("canvas-tool")

@function_tool
async def render_canvas(
    context: RunContext,
    artifact_type: str,
    title: str,
    content: str,
    spoken_summary: str,
) -> str:
    """Render a visual artifact in the user's canvas panel.
    Only use when canvas mode is active. Speak spoken_summary aloud — never read
    the full canvas content.
    """
    # Guard: canvas mode must be ON
    if not context.userdata.get("canvas_mode", False):
        return spoken_summary

    # Guard: type must be allowed
    if artifact_type not in CANVAS_CONFIG.allowed_types:
        logger.warning(f"[Canvas] Blocked disallowed type: {artifact_type}")
        return spoken_summary

    # Guard: content length
    if len(content) > CANVAS_CONFIG.max_content_length:
        content = content[:CANVAS_CONFIG.max_content_length]
        logger.warning("[Canvas] Content truncated to max_content_length")

    room = context.userdata.get("room")
    if room:
        payload = json.dumps({
            "type": "canvas_artifact",
            "artifact_type": artifact_type,
            "title": title,
            "content": content,
            "ts": time.time(),
        }).encode("utf-8")
        await room.local_participant.publish_data(payload, reliable=True)
        logger.info(f"[Canvas] Artifact broadcast: {artifact_type} — {title}")
    else:
        logger.warning("[Canvas] No room in userdata — artifact not broadcast")

    return spoken_summary
```

### `agent.py` changes
```python
from app.features.livekit.canvas.tool import render_canvas
from app.features.livekit.canvas.config import CANVAS_CONFIG

# Build tools list
session_tools = [render_canvas]
if grounding_enabled:
    session_tools.append(google.tools.GoogleSearch())

# Pass room + canvas_mode in userdata
session = AgentSession(
    llm=build_realtime_model(...),
    tools=session_tools,
    userdata={"room": ctx.room, "canvas_mode": False},
)

# Handle canvas_mode toggle from frontend
@ctx.room.on("data_received")
def on_data(payload: bytes, *_):
    try:
        msg = json.loads(payload.decode("utf-8"))
        if msg.get("type") == "canvas_mode":
            enabled = bool(msg.get("enabled", False))
            session.userdata["canvas_mode"] = enabled
            logger.info(f"[Agent] Canvas mode: {enabled}")
    except Exception:
        pass
```

### `foundation_config.py` addition
```python
FEATURE_FLAGS = {
    ...
    "canvas_panel": True,
}
```

Canvas behavior rules are managed in `canvas/config.py`, NOT here — they are session-state-aware (differ when mode is ON vs OFF).

---

## Frontend Implementation Detail

### `widgets/canvas-panel/types.ts`
```typescript
export type ArtifactType = 'markdown' | 'bullet_list' | 'table' | 'scorecard';

export interface CanvasArtifact {
  id: string;
  artifact_type: ArtifactType;
  title: string;
  content: string;   // JSON string — parse based on artifact_type
  ts: number;
}
```

### `widgets/canvas-panel/CanvasPanel.tsx` (shell)
```tsx
// Props: artifacts, activeIndex, onTabChange, onClose
// - Horizontal tab bar at top (artifact titles)
// - ArtifactRenderer for active tab
// - Slides in from right (same animation pattern as transcript)
// - Max MAX_ARTIFACTS tabs; oldest drops off silently
```

### `widgets/canvas-panel/ArtifactRenderer.tsx`
```tsx
// Routes artifact_type → renderer
// Wraps each renderer in try/catch — shows "Could not render" on parse error
switch (artifact.artifact_type) {
  case 'markdown':    return <MarkdownRenderer content={artifact.content} />;
  case 'bullet_list': return <BulletListRenderer content={artifact.content} />;
  case 'table':       return <TableRenderer content={artifact.content} />;
  case 'scorecard':   return <ScorecardRenderer content={artifact.content} />;
}
```

### Renderers — no external libraries
| Renderer | Input format | Output |
|----------|-------------|--------|
| `MarkdownRenderer` | Raw markdown string | Regex-based: `**bold**`, `# headers`, `- bullets` → styled HTML |
| `BulletListRenderer` | `string[]` JSON array | `<ol>/<ul>` with index numbers, styled items |
| `TableRenderer` | `{ headers: string[], rows: string[][] }` | `<table>` with sticky header row, alternating row bg |
| `ScorecardRenderer` | `{ label, score, feedback }[]` | Label + score/10 + color bar (CSS width %) + feedback text |

### `LivePitchPage.tsx` additions
```typescript
// State
const [canvasMode, setCanvasMode] = useState(false);
const [showCanvas, setShowCanvas] = useState(false);
const [artifacts, setArtifacts] = useState<CanvasArtifact[]>([]);
const [activeArtifact, setActiveArtifact] = useState(0);

// Toggle
const toggleCanvas = () => {
  const next = !canvasMode;
  setCanvasMode(next);
  if (next) setShowCanvas(true);
  localParticipant.publishData(
    new TextEncoder().encode(JSON.stringify({ type: "canvas_mode", enabled: next })),
    { reliable: true }
  );
};

// Data channel handler (add to existing switch)
} else if (data.type === 'canvas_artifact') {
  const artifact: CanvasArtifact = { id: crypto.randomUUID(), ...data };
  setArtifacts(prev => [...prev, artifact]);
  setActiveArtifact(artifacts.length);
  setShowCanvas(true);
}
```

---

## Artifact Content Schemas

```
markdown:
  Plain markdown string
  "# Analysis\n\n**Strength:** Your metrics are solid.\n\n- ARR growth: 40% YoY\n- CAC payback: 8 months"

bullet_list:
  JSON array of strings
  ["Clarify your go-to-market strategy", "Add a competitive moat slide", "Quantify TAM with sources"]

table:
  JSON object
  {
    "headers": ["Criteria", "Option A", "Option B"],
    "rows": [
      ["Cost", "$500/mo", "$200/mo"],
      ["Setup time", "2 weeks", "1 day"],
      ["Support", "24/7", "Business hours"]
    ]
  }

scorecard:
  JSON array of score objects
  [
    {"label": "Clarity", "score": 8, "feedback": "Well structured, easy to follow"},
    {"label": "Metrics", "score": 6, "feedback": "ARR mentioned but no growth rate"},
    {"label": "Story",   "score": 9, "feedback": "Strong narrative arc"}
  ]
```

---

## Implementation Risks

| Risk | Level | Detail | Mitigation |
|------|-------|--------|------------|
| `RunContext.userdata` + room access | **Medium** | SDK pattern needs verification against v1.5.1 | Phase 0 Test 1 — fallback to module-level room registry documented |
| Gemini + custom tool + GoogleSearch conflict | **Medium** | May reject mixed tool types | Phase 0 Test 2 — fallback: mutually exclusive |
| Agent ignores canvas_mode flag | **Low** | Gemini may call render_canvas when OFF | Tool-level guard: early return if `canvas_mode=False` in userdata |
| Malformed JSON content from agent | **Low** | Agent generates content string — may be invalid JSON | Frontend ArtifactRenderer in try/catch, graceful error state |
| Mobile layout | **Low** | Side panel too narrow on small screens | Canvas opens as bottom sheet on mobile (increased maxHeight) |
| Artifact tab overflow | **Low** | 10+ artifacts overflow tab bar | Cap at `MAX_ARTIFACTS` from `entities/canvas/constants.ts` |

---

## Difficulty

**Medium.** ~1–2 days after Phase 0 tests pass.

- Phase 0 tests: 30 min
- Backend tool + config: 2–3 hours
- Frontend panel + 4 renderers: 4–5 hours
- Integration + polish: 2 hours

---

## Verification

1. Phase 0 test passes → `canvas_test` message arrives in frontend console
2. Start session → Canvas button in bottom bar (inactive, no amber)
3. Tap Canvas → button highlights amber → backend logs "Canvas mode: True"
4. Say _"rate my pitch on 3 dimensions"_ → scorecard renders with color bars
5. Say _"compare two go-to-market options"_ → second tab with table
6. Tap Canvas again → mode OFF → say same prompts → agent responds conversationally, no panel opens
7. End session → canvas clears (session-only, not persisted to DB)

---

## Status

- [x] Phase 0: Test 1 — userdata/room access ✅ `room_ok: true` confirmed
- [x] Phase 0: Test 2 — tool + GoogleSearch coexistence ✅ no conflicts
- [ ] `canvas/__init__.py`
- [ ] `canvas/config.py` — CanvasConfig with behavior rules
- [ ] `canvas/schemas.py` — CanvasArtifact, ArtifactType
- [ ] `canvas/tool.py` — render_canvas with guards
- [ ] `agent.py` — swap Phase 0 test → render_canvas, keep userdata + data_received
- [ ] `foundation_config.py` — canvas_panel flag
- [ ] `widgets/canvas-panel/index.ts`
- [ ] `widgets/canvas-panel/types.ts`
- [ ] `widgets/canvas-panel/CanvasPanel.tsx`
- [ ] `widgets/canvas-panel/ArtifactRenderer.tsx`
- [ ] `widgets/canvas-panel/renderers/MarkdownRenderer.tsx`
- [ ] `widgets/canvas-panel/renderers/BulletListRenderer.tsx`
- [ ] `widgets/canvas-panel/renderers/TableRenderer.tsx`
- [ ] `widgets/canvas-panel/renderers/ScorecardRenderer.tsx`
- [ ] `entities/canvas/constants.ts`
- [ ] `LivePitchPage.tsx` — canvas state, toggle button, panel, data channel handler
- [ ] Tested: all 4 artifact types
- [ ] Tested: canvas mode OFF blocks render
