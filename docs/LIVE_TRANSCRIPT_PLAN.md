# Live Transcript — Implementation Plan

> Stack: Gemini Live API (already running) → LiveKit data channel → React frontend
> Two files changed: `agent.py` (backend) + `LivePitchPage.tsx` (frontend)
> Zero new dependencies.

---

## How it flows

```
Gemini speaks / user speaks
        ↓
conversation_item_added fires in TranscriptRecorder
        ↓
agent.publish_data(JSON) → LiveKit data channel
        ↓
useDataChannel() on frontend receives message
        ↓
transcript state appends turn
        ↓
Transcript panel re-renders (if open)
```

---

## UI — Bottom Nav (updated)

Add a 4th button: **Transcript** — toggles the panel open/closed.
Sits between Share and End, separated by the same dividers.

```
┌──────────────────────────────────────────────────────────┐
│  [ Mic ]  |  [ Share ]  |  [ Transcript ]  |  [ End ]   │
└──────────────────────────────────────────────────────────┘
         ↑ same pill, same w-16 h-16 rounded-xl style
```

**Transcript button states:**

| State | Style |
|-------|-------|
| Panel hidden | neutral ghost — `text-text-primary hover:bg-surface-tertiary` |
| Panel visible | active blue — `bg-blue-500/20 text-blue-400 border border-blue-500/40` |
| New unread turn (panel hidden) | blue dot badge on the button |

---

## UI — Transcript Panel

Slides up from above the bottom bar when toggled.
Sits between the main stage and the control bar.

```
┌─────────────────────────────────────────────────────────┐
│  ● LIVE  02:17                          Interview Coach  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    ◎  orb                               │
│               YOU  |  AI AGENT                          │
│                                                         │
├─────────────────────────────────────────────────────────┤  ← slides down
│  TRANSCRIPT                              ↓ collapse     │
│  ─────────────────────────────────────────────────────  │
│  AI     "Tell me about a time you led..."               │
│  You    "Sure — at my last role at Acme..."             │
│  AI     "How did the team respond?"                     │
│                                          (scrollable)   │
├─────────────────────────────────────────────────────────┤
│   [ Mic ]  |  [ Share ]  |  [ Transcript ]  |  [ End ] │
└─────────────────────────────────────────────────────────┘
```

**Panel specs:**
- Height: `max-h-48` — shows ~3-4 turns, scrollable
- Auto-scrolls to latest turn
- `AI` label: `text-blue-400 text-xs font-semibold w-8 flex-shrink-0`
- `You` label: `text-emerald-400 text-xs font-semibold w-8 flex-shrink-0`
- Turn text: `text-sm text-text-primary`
- Background: `bg-surface-secondary/80 backdrop-blur-xl border-t border-border-primary/30`
- Slide animation: `transition-all duration-300 ease-in-out` on `max-h`

---

## Backend Change — `agent.py`

**File:** `backend/app/features/livekit/agent.py`

**Where:** Inside `TranscriptRecorder` — in the `conversation_item_added` handler, after appending to the local list.

**What to add:**
```python
# After: self._turns.append(turn)
# Add: publish the turn as a LiveKit data message

import json

turn_payload = json.dumps({
    "type": "transcript_turn",
    "role": turn.role,          # "agent" or "user"
    "text": turn.text_content,  # the spoken text
    "ts": turn.timestamp,       # seconds since session start
}).encode("utf-8")

await self._room.local_participant.publish_data(
    turn_payload,
    reliable=True,  # guaranteed delivery, no drops
)
```

**What `self._room` is:** Pass the `JobContext` room into `TranscriptRecorder.__init__` and store it as `self._room = ctx.room`.

**Impact:** Zero breaking changes. Existing end-of-session save logic is untouched. This just adds a side-effect broadcast per turn.

---

## Frontend Change — `LivePitchPage.tsx`

**File:** `frontend/src/pages/live-pitch/LivePitchPage.tsx`

### Step 1 — Add imports

```ts
import { useDataChannel } from '@livekit/components-react';
```

(`useDataChannel` is already in `@livekit/components-react` — no install needed)

### Step 2 — Add state

```ts
interface TranscriptTurn {
  role: 'agent' | 'user';
  text: string;
  ts: number;
}

const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
const [showTranscript, setShowTranscript] = useState(false);
const [unreadCount, setUnreadCount] = useState(0);
const transcriptEndRef = useRef<HTMLDivElement>(null);
```

### Step 3 — Receive data channel messages

```ts
useDataChannel('', (msg) => {
  try {
    const data = JSON.parse(new TextDecoder().decode(msg.payload));
    if (data.type === 'transcript_turn') {
      setTranscript(prev => [...prev, {
        role: data.role,
        text: data.text,
        ts: data.ts,
      }]);
      // Badge: only count unread when panel is closed
      setUnreadCount(prev => showTranscript ? 0 : prev + 1);
    }
  } catch { /* ignore malformed */ }
});
```

### Step 4 — Auto-scroll to latest turn

```ts
useEffect(() => {
  if (showTranscript) {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0); // clear badge when panel opens
  }
}, [transcript, showTranscript]);
```

### Step 5 — Transcript panel JSX (above bottom bar)

```tsx
{/* Transcript panel — slides up */}
<div className={`absolute left-0 right-0 z-10 transition-all duration-300 ease-in-out overflow-hidden
  bg-surface-secondary/80 backdrop-blur-xl border-t border-border-primary/30
  ${showTranscript ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}
  style={{ bottom: '96px' }}  // sits just above the control bar
>
  <div className="px-4 pt-3 pb-1 flex items-center justify-between">
    <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium">
      Transcript
    </span>
    <span className="text-[10px] text-text-muted">{transcript.length} turns</span>
  </div>
  <div className="overflow-y-auto max-h-36 px-4 pb-3 space-y-2">
    {transcript.length === 0 ? (
      <p className="text-xs text-text-muted italic">Waiting for conversation...</p>
    ) : (
      transcript.map((turn, i) => (
        <div key={i} className="flex gap-3 items-start">
          <span className={`text-xs font-semibold w-8 flex-shrink-0 pt-0.5 ${
            turn.role === 'agent' ? 'text-blue-400' : 'text-emerald-400'
          }`}>
            {turn.role === 'agent' ? 'AI' : 'You'}
          </span>
          <p className="text-sm text-text-primary leading-snug">{turn.text}</p>
        </div>
      ))
    )}
    <div ref={transcriptEndRef} />
  </div>
</div>
```

### Step 6 — Transcript button in bottom nav

Add between Share and End dividers:

```tsx
<div className="w-px h-8 bg-border-primary/30 mx-0.5" />

{/* Transcript toggle */}
<button
  onClick={() => {
    setShowTranscript(prev => !prev);
    setUnreadCount(0);
  }}
  className={`relative cursor-pointer flex flex-col items-center justify-center gap-1
    w-16 h-16 rounded-xl transition-all duration-200 active:scale-95 select-none ${
    showTranscript
      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
      : 'text-text-primary hover:bg-surface-tertiary'
  }`}
>
  <ScrollTextIcon className="w-5 h-5" />
  <span className="text-[10px] font-medium opacity-60 leading-none">Transcript</span>
  {/* Unread badge */}
  {unreadCount > 0 && !showTranscript && (
    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" />
  )}
</button>
```

### Step 7 — Add `ScrollTextIcon` inline SVG

```tsx
function ScrollTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2
           M9 5a2 2 0 002 2h2a2 2 0 002-2
           M9 5a2 2 0 012-2h2a2 2 0 012 2
           M9 12h6M9 16h4" />
    </svg>
  );
}
```

---

## Execution Order

```
1. Backend  — agent.py: pass room to TranscriptRecorder, publish_data on each turn
2. Frontend — add TranscriptTurn interface + state
3. Frontend — wire useDataChannel to append turns
4. Frontend — add transcript panel JSX with slide animation
5. Frontend — add Transcript button to bottom nav with unread badge
6. Frontend — add ScrollTextIcon SVG
```

---

## Files Changed

| File | Change |
|------|--------|
| [agent.py](backend/app/features/livekit/agent.py) | Pass `ctx.room` to `TranscriptRecorder`, add `publish_data` call per turn |
| [LivePitchPage.tsx](frontend/src/pages/live-pitch/LivePitchPage.tsx) | State, `useDataChannel`, panel JSX, button, icon |

> No new packages. No schema changes. No new API endpoints.

---

## Edge Cases

| Case | Handling |
|------|---------|
| Agent not yet connected | Empty state: "Waiting for conversation..." |
| Panel closed, new turn arrives | Blue dot badge on Transcript button |
| Very long turn (AI monologue) | Text wraps naturally, panel scrolls |
| Session ends | Transcript state persists until navigation |
| Data message decode error | Silent try/catch — no crash |

---

Approved → say **go** to implement.
