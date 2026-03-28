# Live API Capabilities Guide

Source: https://ai.google.dev/gemini-api/docs/live-guide.md.txt
Fetched: 2026-03-29

---

This is a comprehensive guide that covers capabilities and configurations available with the Live API.

## Establishing a connection

### Python

```python
import asyncio
from google import genai

client = genai.Client()
model = "gemini-3.1-flash-live-preview"
config = {"response_modalities": ["AUDIO"]}

async def main():
    async with client.aio.live.connect(model=model, config=config) as session:
        print("Session started")

if __name__ == "__main__":
    asyncio.run(main())
```

### JavaScript

```js
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({});
const model = 'gemini-3.1-flash-live-preview';
const config = { responseModalities: [Modality.AUDIO] };

async function main() {
  const session = await ai.live.connect({
    model: model,
    callbacks: {
      onopen: () => console.debug('Opened'),
      onmessage: (message) => console.debug(message),
      onerror: (e) => console.debug('Error:', e.message),
      onclose: (e) => console.debug('Close:', e.reason),
    },
    config: config,
  });
  // Send content...
  session.close();
}

main();
```

## Audio formats

Audio data is always raw, little-endian, 16-bit PCM. Output uses 24kHz sample rate. Input is natively 16kHz (will resample if needed). Set MIME type like `audio/pcm;rate=16000`.

## Sending text

### Python

```python
message = "Hello, how are you?"
await session.send_client_content(turns=message, turn_complete=True)
```

### JavaScript

```js
const message = 'Hello, how are you?';
session.sendClientContent({ turns: message, turnComplete: true });
```

## Incremental content updates

Use incremental updates to send text input, establish session context, or restore session context:

### Python

```python
turns = [
    {"role": "user", "parts": [{"text": "What is the capital of France?"}]},
    {"role": "model", "parts": [{"text": "Paris"}]},
]

await session.send_client_content(turns=turns, turn_complete=False)

turns = [{"role": "user", "parts": [{"text": "What is the capital of Germany?"}]}]
await session.send_client_content(turns=turns, turn_complete=True)
```

## Audio transcriptions

### Output transcription

```python
config = {
    "response_modalities": ["AUDIO"],
    "output_audio_transcription": {}
}

async with client.aio.live.connect(model=model, config=config) as session:
    async for response in session.receive():
        if response.server_content.output_transcription:
            print("Transcript:", response.server_content.output_transcription.text)
```

### Input transcription

```python
config = {
    "response_modalities": ["AUDIO"],
    "input_audio_transcription": {},
}

async with client.aio.live.connect(model=model, config=config) as session:
    # Send audio...
    async for msg in session.receive():
        if msg.server_content.input_transcription:
            print('Transcript:', msg.server_content.input_transcription.text)
```

## Change voice and language

Set voice name in `speechConfig`:

### Python

```python
config = {
    "response_modalities": ["AUDIO"],
    "speech_config": {
        "voice_config": {"prebuilt_voice_config": {"voice_name": "Kore"}}
    },
}
```

### JavaScript

```js
const config = {
  responseModalities: [Modality.AUDIO],
  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
};
```

Native audio output models automatically choose the appropriate language. They support 70 languages.

## Thinking

The `gemini-3.1-flash-live-preview` model supports thinking capabilities. Use `thinkingLevel` to control:

- `minimal` — Lowest latency (default)
- `low`
- `medium`
- `high` — Most thorough reasoning

### Python

```python
model = "gemini-3.1-flash-live-preview"

config = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    thinking_config=types.ThinkingConfig(
        thinking_level="medium",
    )
)
```

### JavaScript

```js
const model = 'gemini-3.1-flash-live-preview';
const config = {
  responseModalities: [Modality.AUDIO],
  thinkingConfig: {
    thinkingLevel: 'medium',
  },
};
```

### Thought summaries

Enable thought summaries with `includeThoughts`:

```python
config = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    thinking_config=types.ThinkingConfig(
        thinking_level="medium",
        include_thoughts=True
    )
)
```

## Voice Activity Detection (VAD)

VAD allows the model to recognize when a person is speaking. When VAD detects an interruption, ongoing generation is canceled and discarded.

### Handling interruptions

#### Python

```python
async for response in session.receive():
    if response.server_content.interrupted is True:
        # Stop playback, clear audio queue
```

#### JavaScript

```js
for (const turn of turns) {
  if (turn.serverContent && turn.serverContent.interrupted) {
    // Stop playback, clear audio queue
  }
}
```

### Automatic VAD (default)

By default, the model automatically performs VAD. When audio is paused for more than a second, send `audioStreamEnd` to flush cached audio.

### Automatic VAD configuration

```python
from google.genai import types

config = {
    "response_modalities": ["TEXT"],
    "realtime_input_config": {
        "automatic_activity_detection": {
            "disabled": False,
            "start_of_speech_sensitivity": types.StartSensitivity.START_SENSITIVITY_LOW,
            "end_of_speech_sensitivity": types.EndSensitivity.END_SENSITIVITY_LOW,
            "prefix_padding_ms": 20,
            "silence_duration_ms": 100,
        }
    }
}
```

```js
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity } from '@google/genai';

const config = {
  responseModalities: [Modality.TEXT],
  realtimeInputConfig: {
    automaticActivityDetection: {
      disabled: false,
      startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
      endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
      prefixPaddingMs: 20,
      silenceDurationMs: 100,
    }
  }
};
```

### Disable automatic VAD

Set `disabled: true` and manage `activityStart` / `activityEnd` manually:

```python
config = {
    "response_modalities": ["TEXT"],
    "realtime_input_config": {"automatic_activity_detection": {"disabled": True}},
}

async with client.aio.live.connect(model=model, config=config) as session:
    await session.send_realtime_input(activity_start=types.ActivityStart())
    await session.send_realtime_input(
        audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
    )
    await session.send_realtime_input(activity_end=types.ActivityEnd())
```

## Token count

```python
async for message in session.receive():
    if message.usage_metadata:
        usage = message.usage_metadata
        print(f"Used {usage.total_token_count} tokens in total.")
        for detail in usage.response_tokens_details:
            match detail:
                case types.ModalityTokenCount(modality=modality, token_count=count):
                    print(f"{modality}: {count}")
```

## Media resolution

```python
config = {
    "response_modalities": ["AUDIO"],
    "media_resolution": types.MediaResolution.MEDIA_RESOLUTION_LOW,
}
```

## Limitations

- **Response modalities**: Only `TEXT` or `AUDIO` per session, not both
- **Client authentication**: Use ephemeral tokens for client-to-server
- **Session duration**: 15 min audio-only, 2 min audio+video (without compression)
- **Context window**: 128k tokens (native audio) / 32k tokens (standard)

## Supported languages (70)

| Language | Code | Language | Code |
|---|---|---|---|
| Afrikaans | af | Kannada | kn |
| Albanian | sq | Kazakh | kk |
| Amharic | am | Khmer | km |
| Arabic | ar | Korean | ko |
| Armenian | hy | Lao | lo |
| Assamese | as | Latvian | lv |
| Azerbaijani | az | Lithuanian | lt |
| Basque | eu | Macedonian | mk |
| Belarusian | be | Malay | ms |
| Bengali | bn | Malayalam | ml |
| Bosnian | bs | Marathi | mr |
| Bulgarian | bg | Mongolian | mn |
| Catalan | ca | Nepali | ne |
| Chinese | zh | Norwegian | no |
| Croatian | hr | Odia | or |
| Czech | cs | Polish | pl |
| Danish | da | Portuguese | pt |
| Dutch | nl | Punjabi | pa |
| English | en | Romanian | ro |
| Estonian | et | Russian | ru |
| Filipino | fil | Serbian | sr |
| Finnish | fi | Slovak | sk |
| French | fr | Slovenian | sl |
| Galician | gl | Spanish | es |
| Georgian | ka | Swahili | sw |
| German | de | Swedish | sv |
| Greek | el | Tamil | ta |
| Gujarati | gu | Telugu | te |
| Hebrew | iw | Thai | th |
| Hindi | hi | Turkish | tr |
| Hungarian | hu | Ukrainian | uk |
| Icelandic | is | Urdu | ur |
| Indonesian | id | Uzbek | uz |
| Italian | it | Vietnamese | vi |
| Japanese | ja | Zulu | zu |

Native audio output models can switch between languages naturally during conversation.
