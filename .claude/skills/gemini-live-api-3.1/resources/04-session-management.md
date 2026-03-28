# Session Management

Source: https://ai.google.dev/gemini-api/docs/live-session.md.txt
Fetched: 2026-03-29

---

In the Live API, a session refers to a persistent connection where input and output are streamed continuously over the same connection. This unique session design enables low latency and supports unique features, but can also introduce challenges, like session time limits, and early termination.

## Session lifetime

- Without compression, audio-only sessions are limited to **15 minutes**, and audio-video sessions are limited to **2 minutes**.
- Use context window compression to extend sessions to unlimited time.
- Connection lifetime is limited to around **10 minutes**. Use session resumption to stay active over multiple connections.
- A GoAway message is sent before the connection ends.

## Context window compression

Enable longer sessions by setting `contextWindowCompression` in session config.

### Python

```python
from google.genai import types

config = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    context_window_compression=(
        types.ContextWindowCompressionConfig(
            sliding_window=types.SlidingWindow(),
        )
    ),
)
```

### JavaScript

```js
const config = {
  responseModalities: [Modality.AUDIO],
  contextWindowCompression: { slidingWindow: {} }
};
```

## Session resumption

Configure `sessionResumption` in setup config. The server sends `SessionResumptionUpdate` messages with handles to resume sessions.

Resumption tokens are valid for **2 hours** after the last session termination.

### Python

```python
import asyncio
from google import genai
from google.genai import types

client = genai.Client()
model = "gemini-3.1-flash-live-preview"

async def main():
    async with client.aio.live.connect(
        model=model,
        config=types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            session_resumption=types.SessionResumptionConfig(
                handle=previous_session_handle  # None for new session
            ),
        ),
    ) as session:
        while True:
            await session.send_client_content(
                turns=types.Content(
                    role="user", parts=[types.Part(text="Hello world!")]
                )
            )
            async for message in session.receive():
                if message.session_resumption_update:
                    update = message.session_resumption_update
                    if update.resumable and update.new_handle:
                        return update.new_handle

                if message.server_content and message.server_content.turn_complete:
                    break

if __name__ == "__main__":
    asyncio.run(main())
```

### JavaScript

```js
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({});
const model = 'gemini-3.1-flash-live-preview';

const session = await ai.live.connect({
  model: model,
  callbacks: { /* ... */ },
  config: {
    responseModalities: [Modality.AUDIO],
    sessionResumption: { handle: previousSessionHandle }
  }
});

// Check for resumption updates in messages
for (const turn of turns) {
  if (turn.sessionResumptionUpdate) {
    if (turn.sessionResumptionUpdate.resumable && turn.sessionResumptionUpdate.newHandle) {
      let newHandle = turn.sessionResumptionUpdate.newHandle;
      // Store and use for next connection
    }
  }
}
```

## GoAway message

The server sends a GoAway message signaling the current connection will soon be terminated. It includes `timeLeft` indicating remaining time.

### Python

```python
async for response in session.receive():
    if response.go_away is not None:
        print(response.go_away.time_left)
```

### JavaScript

```js
for (const turn of turns) {
  if (turn.goAway) {
    console.debug('Time left:', turn.goAway.timeLeft);
  }
}
```

## Generation complete

The server sends `generationComplete` when the model finishes generating.

### Python

```python
async for response in session.receive():
    if response.server_content.generation_complete is True:
        # The generation is complete
```

### JavaScript

```js
for (const turn of turns) {
  if (turn.serverContent && turn.serverContent.generationComplete) {
    // The generation is complete
  }
}
```
