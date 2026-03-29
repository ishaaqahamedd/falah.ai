# Canvas Improvements Plan

**Status:** Planning
**Branch:** feat/canvas-improvements
**Last Updated:** 2026-03-30

---

## Overview

Four improvements to the live canvas panel following successful Phase 1 deployment:

1. Agent verbal confirmation while generating
2. Artifacts persisted and visible in session report
3. Premium canvas UI revamp
4. Smart in-place updates (no full regeneration)

---

## Feature 1 — Agent Verbal Confirmation During Rendering

### Problem
Agent calls `render_canvas` silently. User sees content appear with no warning.

### Solution (2-part)

**Part A — Prompt instruction** (`foundation_config.py`)
Add to `GLOBAL_PROMPT_ADDENDUM`:
> "Before calling `render_canvas`, always say a brief verbal cue, e.g. 'Creating your analysis on the canvas now...' or 'Generating a scorecard for you...'. Keep it to one sentence."

**Part B — Generating signal from backend** (`canvas/tool.py`)
At the top of `render_canvas()`, before processing content, broadcast a `canvas_generating` event:
```python
room.local_participant.publish_data(
    json.dumps({"type": "canvas_generating", "title": title}).encode(),
    reliable=True
)
```

**Frontend** (`LivePitchPage.tsx` + `CanvasPanel.tsx`)
- Handle `canvas_generating` → set `isGenerating: true` + `pendingTitle: string`
- Pass `isGenerating` / `pendingTitle` as props to `CanvasPanel`
- Show shimmer skeleton inside the panel while loading
- Clear on `canvas_artifact` received

### Files Changed
| File | Change |
|------|--------|
| `backend/app/features/livekit/foundation_config.py` | Add verbal cue instruction to prompt |
| `backend/app/features/livekit/canvas/tool.py` | Broadcast `canvas_generating` at top of tool |
| `frontend/src/pages/live-pitch/LivePitchPage.tsx` | Handle `canvas_generating` message type |
| `frontend/src/widgets/canvas-panel/CanvasPanel.tsx` | Add `isGenerating` prop + shimmer skeleton UI |

---

## Feature 2 — Artifacts in Session Report

### Problem
Canvas artifacts only exist during the live session. After the session ends they are lost.

### Solution

**Backend — Capture artifacts** (`canvas/tool.py`)
Store each artifact in `session.userdata["artifacts"]` when `render_canvas` is called:
```python
artifact_record = {"artifact_type": artifact_type, "title": title, "content": content, "ts": ts}
session_userdata = ctx.session.userdata  # passed via context
session_userdata.setdefault("artifacts", []).append(artifact_record)
```

**Backend — Persist to DB**
- New Alembic migration: add `artifacts` column (JSONB / Text) to `sessions` table
- At session end (existing `save_session` call), include `artifacts` from `userdata`
- Session detail API endpoint returns `artifacts` in the response body

**Frontend — Session Report Page**
- Session detail page reads `artifacts` array from API response
- Renders each artifact using the existing `ArtifactRenderer` component (no new code)
- Display order: transcript → artifacts section at bottom
- Artifacts section header: "Canvas Artifacts (N)" collapsible

### Files Changed
| File | Change |
|------|--------|
| `backend/alembic/versions/<new>.py` | Add `artifacts` JSONB column to sessions |
| `backend/app/features/sessions/models.py` | Add `artifacts` field |
| `backend/app/features/livekit/canvas/tool.py` | Store artifact in `userdata["artifacts"]` |
| `backend/app/features/livekit/agent.py` | Pass `artifacts` from userdata to session save |
| `backend/app/features/sessions/service.py` | Include `artifacts` in session response |
| `frontend/src/pages/session-detail/` | Render artifacts section with `ArtifactRenderer` |

---

## Feature 3 — Premium Canvas UI Revamp

### UX Analysis

**Job-to-be-Done:** Consume AI-generated analysis without breaking conversational flow. The canvas is always secondary to the voice session — it must never compete.

**Information Hierarchy:**
- **Primary:** Current artifact content
- **Secondary:** Artifact type badge, title, timestamp
- **Tertiary:** Tab list (only when multiple artifacts exist)

---

### Design System for Artifact Types

Each artifact type gets a color identity:

| Type | Color | Icon |
|------|-------|------|
| `markdown` | Violet (`#7c3aed`) | Document icon |
| `bullet_list` | Cyan (`#0891b2`) | List icon |
| `table` | Blue (`#2563eb`) | Grid icon |
| `scorecard` | Amber (`#d97706`) | Chart/star icon |

---

### Panel Position — Left Side (like Screenshare)

Canvas opens on the **left** side of the session view, mirroring how the screenshare panel works. This keeps the main agent orb/transcript centered and avoids fighting the natural left-to-right reading flow.

- `absolute top-[57px] left-0 bottom-[88px]` (was `right-0`)
- Slides in from the left: `transform: translateX(-100%)` → `translateX(0)` when visible
- Border moves to right side: `border-r border-white/[0.06]`
- Gradient overlay direction flips: `linear-gradient(to left, ...)`

---

### Resizable Panel

User can drag to resize the canvas width. Default width: `380px`. Min: `280px`. Max: `560px` (or 45vw).

**Implementation:**
- A `4px` wide drag handle sits on the **right edge** of the panel
- `cursor-col-resize` on hover, subtle `bg-white/[0.08]` highlight
- On `mousedown` → attach `mousemove` + `mouseup` listeners to `window`
- `mousemove` delta updates a `panelWidth` state (clamped to min/max)
- Width persisted to `localStorage` key `"canvas_panel_width"` on `mouseup`
- Restored from `localStorage` on mount

```
[drag handle — 4px strip, right edge of panel]
│ width: panelWidth (state, default 380px)        │
│ min: 280px   max: 560px                         │
├─────────── canvas content ─────────────────────┤
```

**Visual feedback:**
- Drag handle brightens to `bg-white/20` on hover and while dragging
- While dragging: `cursor-col-resize` on `<body>` (via `document.body.style.cursor`)
- Smooth resize: no transitions on width during drag (performance), re-enable on release

**State added to `LivePitchPage.tsx`:**
```typescript
const [panelWidth, setPanelWidth] = useState(() => {
  return parseInt(localStorage.getItem('canvas_panel_width') || '380', 10);
});
```

---

### Panel Shell — `CanvasPanel.tsx`

**Current:** Flat dark panel, plain text tabs, basic header, fixed width, opens right.

**New:**
- Position: **left side**, slides from left
- Background: `bg-[#0c0c14]/95 backdrop-blur-2xl` (deeper, richer dark)
- Right border: `border-r border-white/[0.06]` + subtle gradient overlay
- **Top accent bar:** 1px line in the artifact type's color — signals which type is active at a glance
- Header background: `bg-gradient-to-r from-white/[0.03] to-transparent`
- Width: controlled by `panelWidth` prop (resizable via drag handle)

**Header:**
```
[CANVAS]  ●  [MARKDOWN ▾]              [2 of 3 ›]
```
- "CANVAS" — uppercase, 9px, letter-spacing wide, `text-white/30`
- Animated dot (●) pulses amber when `isGenerating`, green flash on artifact received
- Active type badge pill: colored background at 15% opacity, type color text, type icon
- Artifact counter — subtle, right-aligned

**Tabs (when multiple artifacts):**
- Each tab: type-colored accent dot + truncated title
- Active tab: `bg-white/[0.06]` pill background, full type-color text, no underline
- Inactive: `text-white/30`, dot dimmed
- Scroll hidden, smooth scroll to active

---

### Loading State — Shimmer Skeleton

When `isGenerating: true`, replace content area with:
```
━━━━━━━━━━━━━━━━━━━━  (title shimmer, 60% width)
━━━━━━━━━━━━━━━━━━━━━━━━━  (body line 1, full width)
━━━━━━━━━━━━━━━━  (body line 2, 70%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━  (body line 3, 90%)
```
- Animated `shimmer` CSS: sliding gradient from `transparent → white/8 → transparent`
- Pending title shown above skeleton: `"Generating: {pendingTitle}"`
- Duration: play until `canvas_artifact` arrives

---

### Update-in-Place Animation

When an artifact is replaced (same title, `mode: "replace"`):
- Panel border flashes with type color at 60% opacity for 800ms (`box-shadow: inset -2px 0 12px {typeColor}99`)
- Content fades out (150ms) → fades in with new content (200ms)
- "Updated" micro-badge appears in header for 2s then fades

---

### Empty State

**Current:** Plain icon + 1 line of text.

**New:**
```
        [Subtle dot-grid pattern background]

        [Canvas icon — 40px, violet/40%]
        [Animated ring pulse around icon — 2s loop]

   Canvas is ready.
   Ask for an analysis, comparison,
   scorecard, or summary —
   it will appear here.

   [dim amber] Enable Canvas mode to start ▲
```
- Background: CSS dot grid: `radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)` at 16px spacing
- Icon pulse: `scale(1) → scale(1.15) opacity-0` loop, 2s ease-out

---

### Scorecard Renderer — `ScorecardRenderer.tsx`

**Current:** Thin `h-1.5` bars, plain colored.

**New:**
- **Overall score:** Large centered ring gauge (SVG circle, stroke-dashoffset animated on mount). Shows `8.4` in center with `/10` subscript. Ring color matches overall score threshold.
- **Individual bars:** `h-3` height, gradient fill (`from-{color}-600 to-{color}-400`), rounded-full
- **Staggered entrance:** Each bar animates in with 80ms delay per item (CSS animation or `style={{ animationDelay }}`)
- **Score label:** Left side full label, right side score in type color (`8/10`)
- **Feedback text:** Slightly indented, `text-white/40`, 11px

```
┌─────────────────────────────┐
│         ◉  8.4/10           │  ← SVG ring gauge, color = emerald
│         Overall             │
├─────────────────────────────┤
│ Clarity            8/10     │
│ ████████████████░░░  ← gradient bar
│ Good opening structure...   │
│                             │
│ Metrics            6/10     │
│ ████████████░░░░░░░░        │
│ Add specific numbers...     │
└─────────────────────────────┘
```

---

### Bullet List Renderer — `BulletListRenderer.tsx`

**Current:** Blue circle badge + plain text.

**New:**
- Item badge: Gradient numbered circle (`bg-gradient-to-br from-cyan-500 to-blue-600`), 20px, white number
- Left accent line: `border-l-2 border-cyan-500/20 pl-3` per item
- Item text: `text-white/75` base, `text-white/90` on hover
- Item separation: subtle divider line between items

---

### Table Renderer — `TableRenderer.tsx`

**Current:** Basic styled table.

**New:**
- **Sticky header** (`position: sticky; top: 0`) with `backdrop-blur` so it floats above scrolling rows
- Header cells: gradient background `from-white/[0.08] to-white/[0.04]`
- Row hover: `hover:bg-white/[0.04] transition-colors`
- First column: slightly brighter text (`text-white/80`) as row identifier
- Outer border: `ring-1 ring-white/[0.08]` on the table container

---

### Markdown Renderer — `MarkdownRenderer.tsx`

**Current:** Minimal line-by-line renderer.

**New additions:**
- `# H1`: `text-base font-bold text-white/90` + bottom border `border-b border-white/10 pb-1 mb-2`
- `## H2`: `text-sm font-semibold text-white/75` + left border accent `border-l-2 border-violet-500/60 pl-2`
- `### H3`: `text-[11px] uppercase tracking-widest text-white/40`
- Blockquote (`> `): `bg-white/[0.03] border-l-2 border-violet-400/40 px-3 py-1 italic text-white/50`
- Code inline: `bg-white/[0.08] px-1.5 py-0.5 rounded font-mono text-violet-300`
- Bullet `•`: Replaced with `bg-violet-500/30` 4px dot + slight left indent

---

### Canvas Button (in bottom bar)

**Current:** Amber background when active, plain badge dot.

**New — when active:**
- Animated gradient border ring: `conic-gradient` cycling through amber → violet → amber
- Inner background: `bg-amber-500/15`
- Badge dot replaced with: count pill `bg-violet-600 text-white text-[9px]`

**New — when generating:**
- Pulsing glow: `box-shadow: 0 0 12px rgba(245,158,11,0.5)` oscillating

---

### Files Changed
| File | Change |
|------|--------|
| `frontend/src/widgets/canvas-panel/CanvasPanel.tsx` | Full redesign: left-side position, resizable drag handle, panel shell, header, tabs, empty state, shimmer, update animation |
| `frontend/src/widgets/canvas-panel/ArtifactRenderer.tsx` | Add `isUpdating` flash prop |
| `frontend/src/widgets/canvas-panel/renderers/ScorecardRenderer.tsx` | SVG ring gauge, gradient bars, staggered animation |
| `frontend/src/widgets/canvas-panel/renderers/MarkdownRenderer.tsx` | Blockquote, H1 border, H2 accent, better code inline |
| `frontend/src/widgets/canvas-panel/renderers/BulletListRenderer.tsx` | Gradient badges, left accent line |
| `frontend/src/widgets/canvas-panel/renderers/TableRenderer.tsx` | Sticky header, row hover, ring border |
| `frontend/src/pages/live-pitch/LivePitchPage.tsx` | `panelWidth` state + localStorage restore, canvas button glow/ring animation, generating state, pass `panelWidth` + `onResize` to `CanvasPanel` |

---

## Feature 4 — Smart In-Place Updates

### Problem (confirmed from transcript)
User asked to add 2 bullet points. Agent regenerated the **entire** 800-word markdown document. Wasteful — extra tokens, extra latency, jarring canvas refresh.

### Solution

**Mode system — 3 modes:**

| Mode | Behavior | When agent uses it |
|------|----------|--------------------|
| `new` | Append as new artifact tab | Default — genuinely new topic |
| `replace` | Replace artifact with same title | Updating existing content (full rewrite) |
| `append` | Append delta content to existing artifact | Adding new section/items to existing artifact |

**Title as the natural key** — agent reuses the same title → frontend matches on title.
No IDs needed to flow through the system.

---

### Backend Changes

**`schemas.py`** — Add mode field:
```python
mode: Literal["new", "replace", "append"] = "new"
```

**`tool.py`** — Mode-aware broadcasting:
```python
# For "append" mode: content is delta only, not full document
# Broadcast includes mode so frontend knows how to apply it
payload = {
    "type": "canvas_artifact",
    "mode": mode,           # "new" | "replace" | "append"
    "artifact_type": artifact_type,
    "title": title,
    "content": content,     # full content for new/replace, delta for append
    "ts": ts,
}
```

**`foundation_config.py`** — Add to prompt:
```
Canvas update rules:
- Use mode="replace" with the SAME title when updating existing content (full rewrite).
- Use mode="append" with the SAME title when adding new sections/items — pass ONLY the new content, not the full document.
- Use mode="new" (default) only for genuinely different topics.
- NEVER regenerate the entire document just to add one section. Use append instead.
```

---

### Frontend Changes

**`LivePitchPage.tsx`** — Handler logic:
```typescript
} else if (data.type === 'canvas_artifact') {
  const { mode = 'new', ...rest } = data;
  const artifact: CanvasArtifact = { id: crypto.randomUUID(), ...rest };

  setArtifacts(prev => {
    if (mode === 'new') {
      const next = [...prev, artifact];
      setActiveArtifact(next.length - 1);
      return next;
    }
    // replace or append — match by title
    const idx = prev.findIndex(a => a.title === artifact.title);
    if (idx === -1) {
      // title not found — treat as new
      const next = [...prev, artifact];
      setActiveArtifact(next.length - 1);
      return next;
    }
    const updated = [...prev];
    if (mode === 'replace') {
      updated[idx] = { ...artifact, id: prev[idx].id }; // keep same id
      setActiveArtifact(idx);
    } else if (mode === 'append') {
      const existing = prev[idx];
      updated[idx] = {
        ...existing,
        content: existing.content + '\n\n' + artifact.content,
        ts: artifact.ts,
      };
      setActiveArtifact(idx);
    }
    setIsUpdating(true); // triggers flash animation
    setTimeout(() => setIsUpdating(false), 900);
    return updated;
  });
  setShowCanvas(true);
  setNewArtifact(true);
}
```

**`CanvasPanel.tsx`** — Accepts `isUpdating` prop → triggers flash border animation.

**`types.ts`** — Add mode to CanvasArtifact:
```typescript
export type ArtifactMode = 'new' | 'replace' | 'append';
export interface CanvasArtifact {
  id: string;
  artifact_type: ArtifactType;
  mode?: ArtifactMode;
  title: string;
  content: string;
  ts: number;
}
```

### Files Changed
| File | Change |
|------|--------|
| `backend/app/features/livekit/canvas/schemas.py` | Add `mode` field |
| `backend/app/features/livekit/canvas/tool.py` | Include `mode` in broadcast payload |
| `backend/app/features/livekit/foundation_config.py` | Add canvas update rules to prompt |
| `frontend/src/widgets/canvas-panel/types.ts` | Add `ArtifactMode`, `mode` to interface |
| `frontend/src/pages/live-pitch/LivePitchPage.tsx` | Mode-aware artifact reducer + `isUpdating` state |
| `frontend/src/widgets/canvas-panel/CanvasPanel.tsx` | `isUpdating` prop → flash animation |

---

## Build Order & Priority

| # | Feature | Effort | Priority |
|---|---------|--------|----------|
| 1 | Smart updates (Feature 4) | Medium | High — fixes real UX pain |
| 2 | Agent verbal confirmation (Feature 1) | Low | High — immediate session feel |
| 3 | Canvas UI revamp (Feature 3) | Medium-High | High — premium look |
| 4 | Artifacts in session report (Feature 2) | Medium + migration | Medium — needs testing after above |

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Agent ignores `mode` instruction, always uses `new` | Add explicit examples in prompt; test with real session |
| Title matching brittle (agent changes title slightly) | Normalize titles before matching (lowercase, trim) |
| Shimmer skeleton shows too long (backend slow) | Add 15s timeout — fall back to error state |
| SVG ring gauge not smooth on Safari | Use `stroke-dashoffset` + `transition: stroke-dashoffset 1s ease` (well-supported) |
| Append mode creates garbled markdown | Agent must be instructed to use append only for structured content (new sections with `##` headers) |
| Session artifacts column migration fails on Railway | Test locally with `alembic upgrade head` before pushing |
