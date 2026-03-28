# Ephemeral Tokens

Source: https://ai.google.dev/gemini-api/docs/ephemeral-tokens.md.txt
Fetched: 2026-03-29

---

Ephemeral tokens are short-lived authentication tokens for accessing the Gemini API through WebSockets. They are designed to enhance security when connecting directly from a user's device to the API (client-to-server implementation).

## How ephemeral tokens work

1. Your client (e.g. web app) authenticates with your backend.
2. Your backend requests an ephemeral token from Gemini API's provisioning service.
3. Gemini API issues a short-lived token.
4. Your backend sends the token to the client for WebSocket connections to Live API.
5. The client then uses the token as if it were an API key.

## Create an ephemeral token

By default, you'll have 1 minute to start new Live API sessions (`newSessionExpireTime`), and 30 minutes to send messages over that connection (`expireTime`).

### Python

```python
import datetime

now = datetime.datetime.now(tz=datetime.timezone.utc)

client = genai.Client(
    http_options={'api_version': 'v1alpha',}
)

token = client.auth_tokens.create(
    config = {
    'uses': 1,
    'expire_time': now + datetime.timedelta(minutes=30),
    'new_session_expire_time': now + datetime.timedelta(minutes=1),
    'http_options': {'api_version': 'v1alpha'},
  }
)
# Pass token.name back to your client
```

### JavaScript

```js
import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({});
const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

const token = await client.authTokens.create({
  config: {
    uses: 1,
    expireTime: expireTime,
    newSessionExpireTime: new Date(Date.now() + (1 * 60 * 1000)),
    httpOptions: {apiVersion: 'v1alpha'},
  },
});
// Pass token.name back to your client
```

## Lock token to configuration

Lock an ephemeral token to specific configurations for improved security:

### Python

```python
token = client.auth_tokens.create(
    config = {
    'uses': 1,
    'live_connect_constraints': {
        'model': 'gemini-3.1-flash-live-preview',
        'config': {
            'session_resumption':{},
            'temperature':0.7,
            'response_modalities':['AUDIO']
        }
    },
    'http_options': {'api_version': 'v1alpha'},
    }
)
```

### JavaScript

```js
const token = await client.authTokens.create({
    config: {
        uses: 1,
        expireTime: expireTime,
        liveConnectConstraints: {
            model: 'gemini-3.1-flash-live-preview',
            config: {
                sessionResumption: {},
                temperature: 0.7,
                responseModalities: ['AUDIO']
            }
        },
        httpOptions: { apiVersion: 'v1alpha' }
    }
});
```

## Use the token (client-side JavaScript)

```js
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: token.name  // Use ephemeral token as API key
});
const model = 'gemini-3.1-flash-live-preview';
const config = { responseModalities: [Modality.AUDIO] };

async function main() {
  const session = await ai.live.connect({
    model: model,
    config: config,
    callbacks: { ... },
  });
  // Send content...
  session.close();
}

main();
```

> **Note:** If not using the SDK, ephemeral tokens must either be passed in an `access_token` query parameter, or in an HTTP `Authorization` header prefixed by `Token`.

## Best practices

- Set a short expiration duration using `expire_time`
- Verify secure authentication for your own backend
- Avoid using ephemeral tokens for backend-to-Gemini connections

## Limitations

Ephemeral tokens are only compatible with Live API at this time.
