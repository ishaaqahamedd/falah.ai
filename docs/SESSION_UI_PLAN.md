# Session UI Redesign Plan

## What We're Building

A modern, cinematic session interface with:
- **AI Agent as the hero** — big, centered, immersive
- **Bottom control bar** — mic, screenshare, end session
- **Smooth split layout** — when screenshare starts, AI panel slides to the right

---

## Layout States

### State 1 — Default (No Screenshare)

```
┌─────────────────────────────────────────────────────────────┐
│  🔴 Agent Live   00:00:00                                  │  ← top bar (minimal, transparent)
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│                   ┌───────────────┐                         │
│                   │               │                         │
│                   │   AI AVATAR   │                         │
│                   │  (animated)   │                         │
│                   │               │                         │
│                   └───────────────┘                         │
│                   AI is Speaking... / Listening...          │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│         [🎤 Mic]    [🖥 Share Screen]    [✕ End]           │  ← bottom bar
└─────────────────────────────────────────────────────────────┘
```

---

### State 2 — Screenshare Active (Split View)

```
┌─────────────────────────────────────────────────────────────┐
│  🔴 Agent Live   00:00:00                                  │
├──────────────────────────────────────┬──────────────────────┤
│                                      │                      │
│                                      │   ┌───────────┐      │
│        SCREEN SHARE CONTENT          │   │           │      │
│          (user's screen)             │   │ AI AVATAR │      │
│                                      │   │           │      │
│                                      │   └───────────┘      │
│                                      │  AI is Speaking...   │
│                                      │                      │
├──────────────────────────────────────┴──────────────────────┤
│         [🎤 Mic]    [🖥 Stop Share]    [✕ End]             │
└─────────────────────────────────────────────────────────────┘
```

---

## Bottom Control Bar — Button Specs

| Button | Icon | States | Action |
|--------|------|--------|--------|
| Mic | Mic / MicOff | Active (green glow) / Muted (red, crossed) | Toggle `localParticipant.setMicrophoneEnabled()` |
| Screen Share | Monitor / MonitorOff | Idle / Active (blue glow) | Toggle `localParticipant.setScreenShareEnabled()` |
| End Session | X / PhoneOff | Always red | `onEnd()` |

---

## Animations & Transitions

### Layout Split (Screenshare toggle)
- Use CSS `transition: all 400ms cubic-bezier(0.4, 0, 0.2, 1)`
- AI panel: slides in from right with `transform: translateX(100%) → 0`
- Screen area: expands from `width: 0` to `flex-1`
- AI avatar: scales down smoothly when moving to sidebar

### AI Avatar States
- **Idle/Listening**: subtle slow pulse, muted color
- **Speaking**: fast pulse, blue glow ring, scale up slightly
- **Muted user**: show small mic-off badge on avatar

### Bottom Bar
- Frosted glass: `backdrop-blur-xl bg-surface/60 border-t border-white/10`
- Mic muted → button turns red with slight shake animation on mute
- Buttons have `scale-95` press feel on click

---

## Component Breakdown

```
LivePitchPage
├── SetupOverlay (existing, no change)
└── LivePitchContent
    ├── TopBar (inline, minimal)
    ├── MainStage
    │   ├── ScreenShareArea       ← hidden when no share, visible + left when sharing
    │   └── AiAgentPanel          ← centered when no share, right sidebar when sharing
    │       ├── AiAvatar (animated orb)
    │       └── StatusLabel
    └── BottomControlBar          ← NEW
        ├── MicButton             ← NEW
        ├── ScreenShareButton     ← updated
        └── EndSessionButton      ← moved from top
```

---

## Key State Changes in `LivePitchContent`

Add two new pieces of state:
```ts
const [isMicMuted, setIsMicMuted] = useState(false);
const isScreenSharing = !!localScreenShare;
```

Mic toggle:
```ts
const toggleMic = () => {
  const next = !isMicMuted;
  localParticipant.setMicrophoneEnabled(!next);
  setIsMicMuted(next);
};
```

Layout class logic:
```ts
// MainStage wrapper
className={`flex-grow flex overflow-hidden transition-all duration-400 ${
  isScreenSharing ? 'flex-row' : 'items-center justify-center'
}`}

// AI panel
className={`transition-all duration-400 ease-in-out flex flex-col items-center justify-center ${
  isScreenSharing
    ? 'w-80 border-l border-border-primary bg-surface-secondary'
    : 'w-full'
}`}
```

---

## Visual Design Tokens (no changes to existing theme)

| Element | Class |
|--------|-------|
| Bottom bar bg | `bg-surface/70 backdrop-blur-xl border-t border-border-primary` |
| Mic active | `bg-surface-secondary text-text-primary hover:bg-surface-tertiary` |
| Mic muted | `bg-red-600/20 text-red-400 border border-red-600/50` |
| Share active | `bg-blue-600/20 text-blue-400 border border-blue-600/50` |
| End button | `bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white border border-red-600/50` |
| AI orb (speaking) | `shadow-[0_0_60px_rgba(59,130,246,0.6)] scale-110` |
| AI orb (idle) | `shadow-none scale-100` |

---

## Implementation Order

1. **Add `BottomControlBar`** component with mic, screenshare, end buttons
2. **Wire mic toggle** using `localParticipant.setMicrophoneEnabled()`
3. **Move screenshare + end controls** from their current locations into the bar
4. **Rework `MainStage` layout** — centered AI default, split on screenshare
5. **Add transition classes** for smooth split animation
6. **Remove old top-right End button** and left-panel screenshare placeholder buttons

---

## Files to Touch

| File | Change |
|------|--------|
| [LivePitchPage.tsx](frontend/src/pages/live-pitch/LivePitchPage.tsx) | Rework `LivePitchContent` layout + add mic state |
| [ScreenSharePanel.tsx](frontend/src/widgets/screen-share-panel/ScreenSharePanel.tsx) | Inline into page or simplify to just the VideoTrack |
| [AiStatusPanel.tsx](frontend/src/widgets/ai-status-panel/AiStatusPanel.tsx) | Make responsive for sidebar vs centered mode |

> No backend changes needed. All UI-only.