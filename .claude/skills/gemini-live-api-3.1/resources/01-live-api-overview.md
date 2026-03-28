# Live API Overview

Source: https://ai.google.dev/gemini-api/docs/live.md.txt
Fetched: 2026-03-29

---

The Live API enables low-latency, real-time voice and video interactions with Gemini. It processes continuous streams of audio, video, or text to deliver immediate, human-like spoken responses, creating a natural conversational experience for your users.

Live API offers a comprehensive set of features such as Voice Activity Detection, tool use and function calling, session management (for managing long running conversations) and ephemeral tokens (for secure client-sided authentication).

## Choose an implementation approach

- **Server-to-server**: Your backend connects to the Live API using WebSockets. Typically, your client sends stream data (audio, video, text) to your server, which then forwards it to the Live API.
- **Client-to-server**: Your frontend code connects directly to the Live API using WebSockets to stream data, bypassing your backend.

> **Note:** Client-to-server generally offers better performance for streaming audio and video, since it bypasses the need to send the stream to your backend first. For production environments, use ephemeral tokens instead of standard API keys.

## Get started — Microphone stream (Python)

```python
import asyncio
from google import genai
import pyaudio

client = genai.Client()

# --- pyaudio config ---
FORMAT = pyaudio.paInt16
CHANNELS = 1
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHUNK_SIZE = 1024

pya = pyaudio.PyAudio()

# --- Live API config ---
MODEL = "gemini-3.1-flash-live-preview"
CONFIG = {
    "response_modalities": ["AUDIO"],
    "system_instruction": "You are a helpful and friendly AI assistant.",
}

audio_queue_output = asyncio.Queue()
audio_queue_mic = asyncio.Queue(maxsize=5)
audio_stream = None

async def listen_audio():
    global audio_stream
    mic_info = pya.get_default_input_device_info()
    audio_stream = await asyncio.to_thread(
        pya.open,
        format=FORMAT,
        channels=CHANNELS,
        rate=SEND_SAMPLE_RATE,
        input=True,
        input_device_index=mic_info["index"],
        frames_per_buffer=CHUNK_SIZE,
    )
    kwargs = {"exception_on_overflow": False} if __debug__ else {}
    while True:
        data = await asyncio.to_thread(audio_stream.read, CHUNK_SIZE, **kwargs)
        await audio_queue_mic.put({"data": data, "mime_type": "audio/pcm"})

async def send_realtime(session):
    while True:
        msg = await audio_queue_mic.get()
        await session.send_realtime_input(audio=msg)

async def receive_audio(session):
    while True:
        turn = session.receive()
        async for response in turn:
            if (response.server_content and response.server_content.model_turn):
                for part in response.server_content.model_turn.parts:
                    if part.inline_data and isinstance(part.inline_data.data, bytes):
                        audio_queue_output.put_nowait(part.inline_data.data)
        # Empty the queue on interruption to stop playback
        while not audio_queue_output.empty():
            audio_queue_output.get_nowait()

async def play_audio():
    stream = await asyncio.to_thread(
        pya.open,
        format=FORMAT,
        channels=CHANNELS,
        rate=RECEIVE_SAMPLE_RATE,
        output=True,
    )
    while True:
        bytestream = await audio_queue_output.get()
        await asyncio.to_thread(stream.write, bytestream)

async def run():
    try:
        async with client.aio.live.connect(
            model=MODEL, config=CONFIG
        ) as live_session:
            print("Connected to Gemini. Start speaking!")
            async with asyncio.TaskGroup() as tg:
                tg.create_task(send_realtime(live_session))
                tg.create_task(listen_audio())
                tg.create_task(receive_audio(live_session))
                tg.create_task(play_audio())
    except asyncio.CancelledError:
        pass
    finally:
        if audio_stream:
            audio_stream.close()
        pya.terminate()
        print("\nConnection closed.")

if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("Interrupted by user.")
```

## Get started — Microphone stream (JavaScript)

```js
import { GoogleGenAI, Modality } from '@google/genai';
import mic from 'mic';
import Speaker from 'speaker';

const ai = new GoogleGenAI({});

const model = 'gemini-3.1-flash-live-preview';
const config = {
  responseModalities: [Modality.AUDIO],
  systemInstruction: "You are a helpful and friendly AI assistant.",
};

async function live() {
  const responseQueue = [];
  const audioQueue = [];
  let speaker;

  async function waitMessage() {
    while (responseQueue.length === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    return responseQueue.shift();
  }

  function createSpeaker() {
    if (speaker) {
      process.stdin.unpipe(speaker);
      speaker.end();
    }
    speaker = new Speaker({
      channels: 1,
      bitDepth: 16,
      sampleRate: 24000,
    });
    speaker.on('error', (err) => console.error('Speaker error:', err));
    process.stdin.pipe(speaker);
  }

  async function messageLoop() {
    while (true) {
      const message = await waitMessage();
      if (message.serverContent && message.serverContent.interrupted) {
        audioQueue.length = 0;
        continue;
      }
      if (message.serverContent && message.serverContent.modelTurn && message.serverContent.modelTurn.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.inlineData && part.inlineData.data) {
            audioQueue.push(Buffer.from(part.inlineData.data, 'base64'));
          }
        }
      }
    }
  }

  async function playbackLoop() {
    while (true) {
      if (audioQueue.length === 0) {
        if (speaker) {
          process.stdin.unpipe(speaker);
          speaker.end();
          speaker = null;
        }
        await new Promise((resolve) => setImmediate(resolve));
      } else {
        if (!speaker) createSpeaker();
        const chunk = audioQueue.shift();
        await new Promise((resolve) => {
          speaker.write(chunk, () => resolve());
        });
      }
    }
  }

  messageLoop();
  playbackLoop();

  const session = await ai.live.connect({
    model: model,
    config: config,
    callbacks: {
      onopen: () => console.log('Connected to Gemini Live API'),
      onmessage: (message) => responseQueue.push(message),
      onerror: (e) => console.error('Error:', e.message),
      onclose: (e) => console.log('Closed:', e.reason),
    },
  });

  const micInstance = mic({ rate: '16000', bitwidth: '16', channels: '1' });
  const micInputStream = micInstance.getAudioStream();

  micInputStream.on('data', (data) => {
    session.sendRealtimeInput({
      audio: { data: data.toString('base64'), mimeType: "audio/pcm;rate=16000" }
    });
  });

  micInputStream.on('error', (err) => console.error('Microphone error:', err));
  micInstance.start();
  console.log('Microphone started. Speak now...');
}

live().catch(console.error);
```

## Example applications

- [Live audio starter app](https://aistudio.google.com/apps/bundled/live_audio?showPreview=true&showCode=true&showAssistant=false)
- See Partner integrations for additional examples

## What's next

- [Capabilities guide](./02-capabilities-guide.md)
- [Tool use](./03-tool-use.md)
- [Session management](./04-session-management.md)
- [Ephemeral tokens](./05-ephemeral-tokens.md)
- [WebSockets API reference](./06-websocket-api-reference.md)
