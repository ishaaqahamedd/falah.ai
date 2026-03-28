# Session UI — Fix Plan

> Icons stay as inline SVGs. Same stroke style (`strokeWidth={2}`, `fill="none"`, `stroke="currentColor"`).
> No icon library needed.

---

## What's broken in the screenshot

```
┌─────────────────────────────────────────────────────────┐
│  ● LIVE  06:01                                          │  ← top bar: agent identity missing
├─────────────────────────────────────────────────────────┤
│                                                         │
│                     ◎  orb (grey, flat)                 │  ← no speaking animation at all
│                   ● You're muted                        │
│                Interview Coach                          │  ← name should be in top bar, not here
│         Senior Behavioral Interview Coach               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│   [ Unmute ]   [ Share Screen ]       [ End ]           │  ← pill looks mismatched, pink tint
└─────────────────────────────────────────────────────────┘
```

---

## Fix 1 — Top Bar: Add Agent Identity

**Current:** Only `● LIVE  06:01` on the left. Right side empty.

**Fix:**
```
Left:   ● LIVE  06:01
Right:  Interview Coach  /  Senior Behavioral Interview Coach
```

- Agent name: `font-semibold text-sm text-text-primary`
- Agent role: `text-xs text-text-muted`
- Add `border-b border-border-primary/20` to the top bar so it reads as a header
- Remove name + role from below the orb entirely

**Code change:** Pass `persona` into `LivePitchContent`, render name/role in top bar right side.

---

## Fix 2 — Orb: Dual Presence Indicators (You + AI)

**Current:** Orb is flat grey. No visual feedback for either party. User can't tell if they're being heard.

**Fix — two presence rows below the orb:**

```
        ┌────────────┬─────────────┐
        │    YOU     │   AI AGENT  │
        │  ▁▃▅▃▁    │     ●       │
        │ Speaking   │  Listening  │
        └────────────┴─────────────┘
```

**You (left):**
- `localParticipant.isSpeaking` → green wave bars + "Speaking"
- Muted → red `MicOff` icon + "You're muted"
- Idle → gray dot + "Ready"

**AI Agent (right):**
- `audioTracks[0].participant.isSpeaking` → blue wave bars + "Speaking"
- Idle → gray dot + "Listening"

**Wave bars:** 5 bars, staggered `animationDelay`, `scaleY` keyframe — same `WaveBars` component, just colored differently (green for user, blue for AI).

**Orb animation:** When AI is speaking, the outer ring pulses with a blue glow. When user is speaking, the outer ring pulses with a green glow. Both at the same time if overlap.

```
  isAiTalking  → ring: shadow-[0_0_60px_rgba(59,130,246,0.4)]  blue
  isSpeaking   → ring: shadow-[0_0_60px_rgba(34,197,94,0.4)]   green
  both         → ring: shadow-[0_0_60px_rgba(99,102,241,0.4)]  purple blend
```

---

## Fix 3 — Bottom Control Bar: Visual Consistency

**Root issues in screenshot:**
- Unmute + End have a pink/red fill that's too light and washed out
- Share Screen has no fill — inconsistent with the others
- Pill container groups all 3 together — End should be separated
- Labels under icons feel like an afterthought

**New design:**

```
  [ Mic ]  [ Share ]          [ End ]
  ←── frosted pill ──→  gap   ← circle →
```

**Button specs (all `w-14 h-14` rounded-xl):**

| Button | Idle state | Active/On state |
|--------|-----------|-----------------|
| Mic (unmuted) | `bg-surface-secondary` `text-text-primary` | — |
| Mic (muted) | `bg-red-500/90` `text-white` | solid red fill |
| Share (idle) | `bg-surface-secondary` `text-text-primary` | — |
| Share (active) | `bg-blue-500/90` `text-white` | solid blue fill |
| End | `bg-red-600` `text-white` always | — always danger |

**Label:** Short label below icon in `text-[10px]` — keep it, but reduce opacity to `60%` so it's a hint not a shout.

**End separation:** `ml-5` gap between the pill and End button. No divider needed — the gap itself communicates "danger zone".

**Pill:** `bg-surface-secondary/70 backdrop-blur-xl border border-border-primary/40 rounded-2xl px-2 py-2`

---

## Fix 4 — Mic Init: Sync from LiveKit State

**Current bug:** `isMicMuted` initializes to `false` regardless of actual mic state.

**Fix:**
```ts
const [isMicMuted, setIsMicMuted] = useState(
  !localParticipant.isMicrophoneEnabled
);
```

This ensures if the user came in muted from PreFlight, the UI reflects it immediately.

---

## Fix 5 — Screenshare Sidebar Polish

**Current:** `w-72` sidebar, orb shrinks to `w-14` core — feels like a bug, not a layout.

**Fix:**
- Sidebar width: `w-72` → `w-80`
- Core orb min size: `w-20 h-20` (never smaller than this)
- Mid ring: `w-32 h-32` in sidebar mode
- Add sidebar header label: `AI AGENT` in `text-[10px] uppercase tracking-widest text-text-muted` at top of panel
- Add `pt-4` top padding to the sidebar so the orb doesn't crowd the top edge

**Sidebar layout:**
```
┌─────────────────┐
│   AI AGENT      │  ← identity label
│                 │
│     ◎ orb       │  ← w-20 min, still animated
│  ▁▃▅  Speaking  │  ← wave bars
│                 │
│  YOU            │
│  ● Ready        │  ← user presence too
└─────────────────┘
```

---

## Fix 6 — New Icons (same SVG style)

Keep all existing icons. Add two new ones needed for the dual presence panel and improved states:

**`UserIcon`** — for "YOU" label in presence panel
```svg
viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
path: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z"
```

**`BotIcon`** — for "AI AGENT" label in presence panel
```svg
viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
path: "M12 2a2 2 0 012 2v2h4a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4V4a2 2 0 012-2z
       M8 14h.01M16 14h.01M9 10h6"
```

---

## Execution Order

```
1. Fix 4  →  Mic init sync (1 line, no visual impact, prevents bugs)
2. Fix 1  →  Top bar agent identity
3. Fix 2  →  Dual presence indicators + orb glow states
4. Fix 3  →  Bottom bar redesign + new button states
5. Fix 5  →  Screenshare sidebar
6. Fix 6  →  Add UserIcon + BotIcon inline SVGs
```

---

## Files to change

| File | Fixes |
|------|-------|
| [LivePitchPage.tsx](frontend/src/pages/live-pitch/LivePitchPage.tsx) | All 6 fixes — single file |

> No new files. No new dependencies. All inline.

---

## What stays the same

- Setup overlay — fine as-is
- Screen share video (full bleed, no padding) — good from last round
- WaveBars component — reuse, just parameterize color
- ControlButton component — reuse, update sizing

---

Approve this plan → say **go** to implement.
