# Gemini Live API — Integration Gap Analysis
**Date:** 2026-03-29
**Reference:** [livekit-examples/gemini-hacker-starter](https://github.com/livekit-examples/gemini-hacker-starter)
**Our agent:** `backend/app/features/livekit/agent.py`

---

## Overview

Comparing our production agent against the official Google x LiveKit hackathon starter to identify why `gemini-3.1-flash-live-preview` keeps throwing `1007 Invalid argument` and what structural patterns we're missing.

---

## Gap 1 — Wrong Model Name (🔴 Critical)

### What the example uses
```python
REALTIME_MODEL = "gemini-3.1-flash-audio-eap"   # EAP = Early Access Preview
```

### What we use
```python
"gemini-3.1-flash-live-preview"
```

### Why it matters
- The README confirms these are **genuinely different model identifiers**, not aliases
- The example sets **no `api_version`** anywhere and runs on the default `v1beta` — and it works
- `gemini-3.1-flash-audio-eap` is available at `v1beta`; `gemini-3.1-flash-live-preview` is not
- Our forced `api_version="v1alpha"` in the registry is a workaround for the wrong model name, not a real fix
- Every 1007 error is most likely "model not found at this API version" caused by this mismatch

### Fix
Switch the default model and remove the forced `api_version`:
```python
# In model_registry.py:
"gemini-3.1-flash-audio-eap": {
    "label": "Gemini 3.1 Flash Audio (EAP)",
    "tier": "recommended",
    # NO api_version — EAP works at default v1beta
    "thinking": { "type": "level", "options": ["minimal","low","medium","high"], "default": "minimal" },
    "affective_dialog": False,
    "proactivity": False,
    "context_window_compression": True,
}
DEFAULT_MODEL_ID = "gemini-3.1-flash-audio-eap"
```

---

## Gap 2 — Wrong Initialization Order (🔴 Critical)

### What the example does
```python
# 1. Start session FIRST (attaches Gemini to the room)
await session.start(room=ctx.room, agent=HackathonAgent(room=ctx.room))

# 2. Connect to room AFTER session is ready
await ctx.connect()
```

### What we do
```python
# 1. Connect first (line 299) — starts consuming audio/video
await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)

# ... 100 lines of metadata fetching, DB queries, prompt building ...

# 2. Start session much later (line 396)
await session.start(agent, room=ctx.room, room_options=...)
```

### Why it matters
- The agent connects and starts receiving audio/video BEFORE the Gemini session is attached
- Early audio frames from the participant are lost or processed without a handler
- The Realtime WebSocket may open while the framework is in a partially-initialized state
- Results in connection instability and potential 1007 on the Gemini side

### Fix
Move `ctx.connect()` to after `session.start()`:
```python
await session.start(agent, room=ctx.room, ...)
await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
```

---

## Gap 3 — `generate_reply` Not Awaited (🟠 High)

### What the example does
```python
# Called on the session object, properly awaited
try:
    await session.generate_reply(
        instructions="Greet the user..."
    )
except Exception as exc:
    logger.warning("Initial greeting failed: %s", exc)
```

### What we do
```python
async def on_enter(self):
    logger.info("[Agent] Triggering opening greeting.")
    self.session.generate_reply(user_input=self._opening_instruction)  # ← NOT awaited
```

### Why it matters
- `generate_reply` is an `async` coroutine
- Not awaiting it means the coroutine is created and immediately garbage-collected
- The opening greeting **never fires** — silently dropped every single session
- No error is raised, so it's invisible in logs

### Fix
```python
async def on_enter(self):
    logger.info("[Agent] Triggering opening greeting.")
    await self.session.generate_reply(user_input=self._opening_instruction)
```

---

## Gap 4 — LLM in Agent vs AgentSession (🟡 Medium)

### What the example does
```python
# LLM lives in AgentSession — the canonical new pattern
session = AgentSession(
    llm=google.realtime.RealtimeModel(
        model=REALTIME_MODEL,
        voice="Aoede",
    ),
)
agent = HackathonAgent(room=ctx.room)  # no llm= here
await session.start(room=ctx.room, agent=agent)
```

### What we do
```python
# LLM passed into Agent.__init__ — old pattern
agent = PersonaAgent(
    system_prompt=..., voice_id=..., model_id=..., model_settings=...
)  # PersonaAgent calls super().__init__(instructions=..., llm=build_realtime_model(...))

session = AgentSession(
    video_sampler=VoiceActivityVideoSampler(...)
)  # no llm= here
```

### Why it matters
- Passing LLM via `Agent.__init__` is the legacy pattern
- The framework wires the Realtime session differently depending on where the LLM is declared
- May cause subtle issues with how the AgentSession manages the Realtime WebSocket lifecycle
- Harder to swap models at runtime

### Fix
Move `build_realtime_model(...)` out of `PersonaAgent.__init__` and into `AgentSession`:
```python
session = AgentSession(
    llm=build_realtime_model(active_model, voice_id, model_settings),
    video_sampler=VoiceActivityVideoSampler(...),
)
agent = PersonaAgent(system_prompt=system_prompt, opening_instruction=opening_instruction)
await session.start(room=ctx.room, agent=agent, ...)
```

---

## Gap 5 — Old Worker API vs New AgentServer API (🟡 Medium)

### What the example does
```python
server = AgentServer()

@server.rtc_session(agent_name="gemini-hackathon-agent")
async def entrypoint(ctx: agents.JobContext):
    ...

if __name__ == "__main__":
    agents.cli.run_app(server)
```

### What we do
```python
async def entrypoint(ctx: JobContext):
    # Manual room name prefix filtering
    if not ctx.room.name.startswith(expected_prefix):
        return
    ...

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

### Why it matters
- `AgentServer` + `@server.rtc_session` is the new SDK pattern (livekit-agents 1.x)
- Server-side dispatch handles room filtering automatically via `agent_name`
- Our manual prefix check (`startswith`) can silently drop valid jobs if naming changes
- `WorkerOptions` is deprecated in favour of `AgentServer`
- Import style differs: example uses `from livekit.agents import AgentServer`

### Fix
Migrate to `AgentServer` pattern in a future refactor. Not blocking for the 1007 fix.

---

## Gap 6 — `thinking_config` Silently Disabled (🟡 Medium)

### Current state in our code
```python
# agent.py line 59:
if thinking_spec.get("type") == "level":
    level = model_settings.get("thinking_level", ...)
    thinking_cfg = None  # types.ThinkingConfig(thinking_level=level)  ← COMMENTED OUT
```

### Why it matters
- The DB setting `thinking_level=minimal` is read but never applied
- Thinking is always OFF regardless of superadmin configuration
- The example also uses no thinking config — so this may be intentional for stability

### Fix
Uncomment when the 1007 issue is resolved and the model is confirmed working:
```python
thinking_cfg = types.ThinkingConfig(thinking_level=level)
```

---

## Gap 7 — screen_capture.py is Orphaned Dead Code (🟢 Low)

### State
`backend/app/features/livekit/vision/screen_capture.py` defines `stream_screen_to_gemini()` but it is **never called** from `entrypoint`.

### Why it exists
It was written to manually push screen frames via `_send_client_event` (now updated to `send_realtime_input(video=...)`). But screen video is already handled natively by `VoiceActivityVideoSampler` + `room_io.RoomOptions(video_input=True)`.

### Fix
Either delete the file or integrate it intentionally. Currently harmless but confusing.

---

## Non-Gap — VoiceActivityVideoSampler (✅ We're Ahead)

### What the example does
The base example uses no video sampler — frames are sampled by default behaviour.
The README shows `VoiceActivityVideoSampler` only as an **optional customization**:
```python
# README: "For continuous commentary, use a constant frame rate:"
session = AgentSession(
    llm=...,
    video_sampler=voice.VoiceActivityVideoSampler(speaking_fps=1.0, silent_fps=1.0),
)
```

### What we do
We already have this set up with configurable FPS from `settings`:
```python
session = AgentSession(
    video_sampler=VoiceActivityVideoSampler(
        speaking_fps=settings.VIDEO_SPEAKING_FPS,
        silent_fps=settings.VIDEO_SILENT_FPS,
    )
)
```

**This is not a gap — our implementation is more complete than the example here.**

---

## Summary Table

| # | Gap | Severity | Affects 1007? |
|---|---|---|---|
| 1 | Wrong model name (`live-preview` vs `audio-eap`) | 🔴 Critical | YES — likely primary cause |
| 2 | `ctx.connect()` before `session.start()` | 🔴 Critical | YES — breaks stream attachment |
| 3 | `generate_reply` not awaited in `on_enter` | 🟠 High | NO — but greeting never fires |
| 4 | LLM in Agent vs AgentSession | 🟡 Medium | POSSIBLY — framework wiring |
| 5 | Old `WorkerOptions` vs new `AgentServer` | 🟡 Medium | NO — both work |
| 6 | `thinking_config` commented out | 🟡 Medium | NO — silently disabled |
| 7 | `screen_capture.py` orphaned | 🟢 Low | NO — dead code |

---

## Recommended Fix Order

1. **Test model name** — switch to `gemini-3.1-flash-audio-eap` and remove forced `api_version`
2. **Fix init order** — move `ctx.connect()` after `session.start()`
3. **Fix `generate_reply`** — add `await` to `on_enter()`
4. **Migrate LLM to AgentSession** — structural cleanup
5. **Re-enable thinking** — after model is confirmed stable
6. **Migrate to AgentServer** — future refactor sprint
