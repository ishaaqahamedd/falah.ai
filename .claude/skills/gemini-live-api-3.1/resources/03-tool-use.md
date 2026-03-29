# Live API Tool Use

Source: https://ai.google.dev/gemini-api/docs/live-tools.md.txt
Fetched: 2026-03-29

---

Tool use allows Live API to go beyond just conversation by enabling it to perform actions in the real-world and pull in external context while maintaining a real time connection. You can define tools such as Function calling and Google Search with the Live API.

## Overview of supported tools

| Tool | `gemini-3.1-flash-live-preview` |
|---|---|
| **Search** | Yes |
| **Function calling** | Yes (synchronous only) |
| **Google Maps** | No |
| **Code execution** | No |
| **URL context** | No |

## Function calling

Live API supports function calling, just like regular content generation requests. Function calling lets the Live API interact with external data and programs, greatly increasing what your applications can accomplish.

You can define function declarations as part of the session configuration. After receiving tool calls, the client should respond with a list of `FunctionResponse` objects using the `session.send_tool_response` method.

> **Note:** Unlike the `generateContent` API, the Live API doesn't support automatic tool response handling. You must handle tool responses manually in your client code.

### Python

```python
import asyncio
import wave
from google import genai
from google.genai import types

client = genai.Client()
model = "gemini-3.1-flash-live-preview"

# Simple function definitions
turn_on_the_lights = {"name": "turn_on_the_lights"}
turn_off_the_lights = {"name": "turn_off_the_lights"}

tools = [{"function_declarations": [turn_on_the_lights, turn_off_the_lights]}]
config = {"response_modalities": ["AUDIO"], "tools": tools}

async def main():
    async with client.aio.live.connect(model=model, config=config) as session:
        prompt = "Turn on the lights please"
        await session.send_client_content(turns={"parts": [{"text": prompt}]})

        wf = wave.open("audio.wav", "wb")
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)

        async for response in session.receive():
            if response.data is not None:
                wf.writeframes(response.data)
            elif response.tool_call:
                print("The tool was called")
                function_responses = []
                for fc in response.tool_call.function_calls:
                    function_response = types.FunctionResponse(
                        id=fc.id,
                        name=fc.name,
                        response={ "result": "ok" }
                    )
                    function_responses.append(function_response)

                await session.send_tool_response(function_responses=function_responses)

        wf.close()

if __name__ == "__main__":
    asyncio.run(main())
```

### JavaScript

```js
import { GoogleGenAI, Modality } from '@google/genai';
import * as fs from "node:fs";
import pkg from 'wavefile';
const { WaveFile } = pkg;

const ai = new GoogleGenAI({});
const model = 'gemini-3.1-flash-live-preview';

const turn_on_the_lights = { name: "turn_on_the_lights" };
const turn_off_the_lights = { name: "turn_off_the_lights" };

const tools = [{ functionDeclarations: [turn_on_the_lights, turn_off_the_lights] }];
const config = {
  responseModalities: [Modality.AUDIO],
  tools: tools
};

async function live() {
  const responseQueue = [];

  async function waitMessage() { /* ... */ }
  async function handleTurn() { /* ... */ }

  const session = await ai.live.connect({
    model, config,
    callbacks: {
      onopen: () => console.debug('Opened'),
      onmessage: (message) => responseQueue.push(message),
      onerror: (e) => console.debug('Error:', e.message),
      onclose: (e) => console.debug('Close:', e.reason),
    },
  });

  session.sendClientContent({ turns: 'Turn on the lights please' });

  let turns = await handleTurn();
  for (const turn of turns) {
    if (turn.toolCall) {
      const functionResponses = turn.toolCall.functionCalls.map(fc => ({
        id: fc.id, name: fc.name, response: { result: "ok" }
      }));
      session.sendToolResponse({ functionResponses });
    }
  }

  // Check for new messages after tool response
  turns = await handleTurn();
  // Process audio...

  session.close();
}

live().catch(console.error);
```

## Async Function Calling (NON_BLOCKING)

> **Note:** Async function calling is NOT supported on `gemini-3.1-flash-live-preview`. This section documents the API surface for reference only.

Function calling executes sequentially by default. For non-blocking behavior, add `behavior` to function definitions:

```python
# NON_BLOCKING function definitions
turn_on_the_lights = {"name": "turn_on_the_lights", "behavior": "NON_BLOCKING"}
turn_off_the_lights = {"name": "turn_off_the_lights"}  # Still blocking
```

For non-blocking functions, control response behavior with `scheduling`:
- `scheduling="INTERRUPT"` — Interrupt current generation with result
- `scheduling="WHEN_IDLE"` — Wait until generation completes
- `scheduling="SILENT"` — Use knowledge later without interrupting

## Google Search Grounding

Enable Grounding with Google Search as part of the session configuration:

### Python

```python
tools = [{'google_search': {}}]
config = {"response_modalities": ["AUDIO"], "tools": tools}
```

### JavaScript

```js
const tools = [{ googleSearch: {} }];
const config = {
  responseModalities: [Modality.AUDIO],
  tools: tools
};
```

## Combining Multiple Tools

```python
tools = [
    {"google_search": {}},
    {"function_declarations": [turn_on_the_lights, turn_off_the_lights]},
]
config = {"response_modalities": ["AUDIO"], "tools": tools}
```
