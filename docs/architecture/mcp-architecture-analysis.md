# Falah.ai — MCP Architecture Analysis

> **Date:** 2026-03-28
> **Status:** ANALYSIS — Review before implementation
> **Depends on:** Refactoring Plan Phase 1 (RBAC) must be completed first

---

## 1. What is MCP and Why Falah Needs It

**Model Context Protocol (MCP)** is an open standard (originated by Anthropic, now industry-adopted) that lets AI models interact with external software through a unified interface. Think of it as **USB-C for AI tools** — one protocol, any app.

**Without MCP:** Falah agents can only talk. They reason, score, and advise — but can't *do* anything in the real world.

**With MCP:** Falah agents become autonomous workers. They can book meetings, create Jira tickets, send Slack messages, place orders, query databases — all triggered by voice mid-conversation.

---

## 2. Gemini 3.1 Flash Live — What It Gives Us for Free

Based on the [March 26, 2026 release](https://blog.google/innovation-and-ai/technology/developers-tools/build-with-gemini-3-1-flash-live/):

### Function Calling in Voice Sessions

Gemini 3.1 Flash Live scores **90.8% on ComplexFuncBench Audio** — meaning it can reason through multi-step tool calls mid-voice-conversation with high reliability.

**How it works in the Live API:**
```python
# 1. You declare tools when connecting
config = LiveConnectConfig(
    tools=[{
        "function_declarations": [{
            "name": "create_jira_ticket",
            "description": "Creates a Jira ticket",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high"]}
                }
            }
        }]
    }],
    thinking_level="MINIMAL"  # NEW: replaces thinkingBudget
)

# 2. During conversation, model emits tool_call instead of audio
async for response in session.receive():
    if response.tool_call:
        for fc in response.tool_call.function_calls:
            result = await execute_tool(fc.name, fc.args)  # YOUR CODE
            await session.send(types.FunctionResponse(
                name=fc.name,
                id=fc.id,
                response={"result": result}
            ))
    # 3. Model resumes speaking after receiving tool response
```

### Critical Constraints

| Constraint | Impact on Falah |
|---|---|
| **Function calling is synchronous** | Model PAUSES while waiting for tool response. No filler audio ("let me check...") during execution. Users hear silence. |
| **`affective_dialog` parameter removed** | The explicit API flag is gone in 3.1. **However**, since 3.1 Flash Live is audio-to-audio (processes raw audio → generates raw audio), it naturally picks up acoustic cues like pitch, pace, hesitation, and energy. Google confirms it's "more effective at recognizing acoustic nuances like pitch and pace." The emotional intelligence is **implicit in the audio-to-audio pipeline**, not lost — just no longer a separate toggle. **Mitigation:** Add explicit instructions to the system prompt (see below). |
| **Proactive audio NOT supported** | Remove `proactivity=True` from agent config when upgrading to 3.1 |
| **`thinkingLevel` replaces `thinkingBudget`** | Change `thinking_budget=128` → `thinking_level="MINIMAL"` in agent.py |

### Compensating for Affective Dialog via System Prompt

Since the `affective_dialog` parameter no longer exists but the model still processes raw audio, we push emotional adaptation through the system instruction:

```
SYSTEM INSTRUCTION ADDITION:
"You receive and produce raw audio. Pay close attention to the user's vocal tone,
pace, and emotional state throughout the conversation.
- If the user sounds nervous, hesitant, or their voice is trembling, slow your
  cadence, lower your pitch, and be more supportive and encouraging.
- If the user sounds confident and energetic, match their energy and increase
  your challenge level.
- If the user sighs, stammers, or pauses for long periods, acknowledge it
  naturally (e.g., 'Take your time') before continuing.
This emotional attunement should be constant and subtle — never call out their
emotions explicitly unless they do first."
```

This achieves the same outcome as the old `affective_dialog=True` flag — the audio-to-audio model naturally has the capability, it just needs the instruction to prioritize it.

---

## 3. Architecture Decision: Where Does the MCP Client Live?

### Option A: Inside the LiveKit Agent Process (Recommended)

```
┌─────────────────────────────────────────────┐
│            LiveKit Agent Worker              │
│                                             │
│  ┌──────────────┐    ┌──────────────────┐   │
│  │ Gemini 3.1   │───▶│  Tool Router     │   │
│  │ Flash Live   │    │                  │   │
│  │ (WebSocket)  │◀───│  fn_call ──▶ MCP │   │
│  └──────────────┘    │  fn_call ──▶ MCP │   │
│                      │  fn_call ──▶ DB  │   │
│                      └──────────────────┘   │
│                              │              │
│                    ┌─────────┼─────────┐    │
│                    ▼         ▼         ▼    │
│              MCP Client  MCP Client  Local  │
│              (Slack)     (Jira)      (RAG)  │
│                    │         │              │
└────────────────────┼─────────┼──────────────┘
                     ▼         ▼
              Slack MCP     Jira MCP
              Server        Server
```

**Pros:**
- Lowest latency — tool execution happens in the same process as the voice session
- Simple — no inter-service communication
- Function responses go back to Gemini immediately

**Cons:**
- Agent process gets heavier with each MCP connection
- A slow/broken MCP server blocks the voice session
- Harder to scale MCP connections independently

### Option B: Separate MCP Gateway Microservice

```
┌──────────────┐         ┌──────────────────┐
│ LiveKit Agent │──HTTP──▶│  MCP Gateway     │
│ (Gemini 3.1) │◀────────│  Service         │
└──────────────┘         │                  │
                         │  ┌─── Slack MCP  │
                         │  ├─── Jira MCP   │
                         │  ├─── GitHub MCP │
                         │  └─── Calendar   │
                         └──────────────────┘
```

**Pros:**
- Clean separation of concerns
- MCP gateway scales independently
- Broken MCP server doesn't crash the voice session (timeout + fallback)

**Cons:**
- Added network hop = +50-200ms latency per tool call
- More infrastructure to deploy and monitor
- Needs its own auth/service mesh

### Recommendation: **Start with Option A, migrate to Option B when you have 10+ MCP integrations**

For the first 3-5 MCP tools, the latency benefit of in-process execution outweighs the architectural purity of a separate service. Add a timeout wrapper so a slow MCP server doesn't hang the voice session.

---

## 4. The Tool Registry — How Gemini Knows What Tools Exist

Each Falah agent (persona) can have different MCP connections. The system needs a **per-agent tool registry** that:

1. Stores which MCP servers are connected to which agent
2. Generates Gemini function declarations dynamically at session start
3. Routes function calls to the correct MCP server at runtime

### Database Schema

```sql
-- New table: agent_mcp_connections
CREATE TABLE agent_mcp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- MCP server config
    server_name VARCHAR(100) NOT NULL,        -- "slack", "jira", "github"
    server_url TEXT NOT NULL,                  -- "https://mcp.slack.com/v1"
    transport_type VARCHAR(20) DEFAULT 'sse', -- "sse" | "stdio" | "streamable_http"

    -- Auth
    auth_type VARCHAR(20) NOT NULL,            -- "oauth2" | "api_key" | "none"
    encrypted_credentials BYTEA,               -- Encrypted OAuth token or API key

    -- Tool filtering (optional — user can enable/disable specific tools)
    enabled_tools JSONB DEFAULT '[]',          -- [] means all tools enabled

    -- Metadata
    is_active BOOLEAN DEFAULT true,
    last_connected_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Index for fast lookup during session start
CREATE INDEX idx_mcp_connections_persona ON agent_mcp_connections(persona_id) WHERE is_active = true;
```

### Tool Discovery Flow (Session Start)

```python
async def build_tool_declarations(persona_id: str, db: AsyncSession) -> list:
    """
    Called when a LiveKit room is created.
    Discovers all MCP tools for this agent and builds Gemini function declarations.
    """
    declarations = []

    # 1. Always include built-in tools (RAG, scoring)
    declarations.append(BUILTIN_FETCH_CONTEXT_TOOL)
    declarations.append(BUILTIN_SAVE_NOTE_TOOL)

    # 2. Fetch active MCP connections for this agent
    connections = await mcp_repo.get_active_connections(persona_id, db)

    for conn in connections:
        # 3. Connect to MCP server, list available tools
        async with MCPClient(conn.server_url, conn.transport_type) as client:
            tools = await client.list_tools()

            # 4. Filter to enabled tools only
            if conn.enabled_tools:
                tools = [t for t in tools if t.name in conn.enabled_tools]

            # 5. Convert MCP tool schemas → Gemini function declarations
            for tool in tools:
                declarations.append({
                    "name": f"{conn.server_name}__{tool.name}",  # namespace to avoid collisions
                    "description": tool.description,
                    "parameters": tool.input_schema
                })

    return declarations
```

### Tool Execution Flow (Mid-Conversation)

```python
async def handle_tool_call(function_call, persona_id: str, db: AsyncSession):
    """
    Called when Gemini emits a function_call during a voice session.
    Routes to the correct MCP server or built-in handler.
    """
    name = function_call.name
    args = function_call.args

    # 1. Check if it's a built-in tool
    if name == "fetch_context":
        return await builtin_fetch_context(args, persona_id, db)
    if name == "save_note":
        return await builtin_save_note(args, persona_id, db)

    # 2. Parse namespaced MCP tool: "slack__send_message" → server="slack", tool="send_message"
    if "__" in name:
        server_name, tool_name = name.split("__", 1)

        conn = await mcp_repo.get_connection_by_name(persona_id, server_name, db)
        if not conn:
            return {"error": f"MCP server '{server_name}' not connected"}

        # 3. Check if this is a destructive action → require confirmation
        if await is_destructive_action(tool_name, args):
            return {"status": "confirmation_required", "action": tool_name, "args": args}

        # 4. Execute via MCP client with timeout
        async with MCPClient(conn.server_url, conn.transport_type) as client:
            try:
                result = await asyncio.wait_for(
                    client.call_tool(tool_name, args),
                    timeout=10.0  # 10 second max
                )
                return result
            except asyncio.TimeoutError:
                return {"error": f"Tool '{tool_name}' timed out after 10 seconds"}

    return {"error": f"Unknown tool: {name}"}
```

---

## 5. Human-in-the-Loop Confirmation

The blueprint requires user confirmation for destructive/financial actions. Since the user is in a **voice session**, we need a way to confirm without breaking the audio flow.

### Design: WebSocket Event → Frontend Confirmation Modal

```
Gemini says: "I'm ready to create the Jira ticket. Please confirm on your screen."
    │
    ▼
Agent sends WebSocket event to frontend:
{
    "type": "action_confirmation",
    "tool": "jira__create_issue",
    "args": {"title": "Login screen redesign", "priority": "high"},
    "timeout_seconds": 30
}
    │
    ▼
Frontend shows confirmation modal overlay on LivePitchPage:
┌─────────────────────────────────────┐
│  Agent wants to perform an action:  │
│                                     │
│  Create Jira Ticket                 │
│  Title: "Login screen redesign"     │
│  Priority: High                     │
│                                     │
│  [Approve]          [Deny]          │
└─────────────────────────────────────┘
    │
    ▼
Frontend sends response back via WebSocket/data channel:
{ "type": "action_response", "approved": true }
    │
    ▼
Agent executes or skips the MCP call, resumes voice.
```

### Implementation in LiveKit

Use LiveKit's **Data Channel** (already available in the SDK) to send structured messages between agent and frontend without interrupting audio:

```python
# Agent side — send confirmation request
await room.local_participant.publish_data(
    json.dumps({
        "type": "action_confirmation",
        "tool": tool_name,
        "args": args,
        "request_id": str(uuid4())
    }).encode(),
    reliable=True
)

# Agent side — wait for response (with timeout)
response = await wait_for_data_message(
    room, filter_type="action_response", timeout=30
)
```

```typescript
// Frontend side — listen for confirmation requests
room.on(RoomEvent.DataReceived, (payload) => {
    const data = JSON.parse(new TextDecoder().decode(payload));
    if (data.type === "action_confirmation") {
        setConfirmationRequest(data); // Show modal
    }
});
```

### Destructive Action Classification

```python
# Actions that ALWAYS require confirmation
ALWAYS_CONFIRM = {
    "delete", "remove", "drop", "cancel",         # Destructive
    "send", "post", "publish", "submit",           # Outbound communication
    "pay", "purchase", "order", "transfer", "buy", # Financial
    "create", "update", "modify",                   # Write operations
}

async def is_destructive_action(tool_name: str, args: dict) -> bool:
    """Check if a tool action requires human confirmation."""
    for keyword in ALWAYS_CONFIRM:
        if keyword in tool_name.lower():
            return True
    return False
```

---

## 6. Credential Storage & Security

Users will paste OAuth tokens / API keys for their MCP connections. These MUST be encrypted at rest.

### Encryption Approach

```python
# backend/app/core/encryption.py
from cryptography.fernet import Fernet

# ENCRYPTION_KEY must be in environment variables, NOT in code
fernet = Fernet(settings.ENCRYPTION_KEY)

def encrypt_credentials(plaintext: str) -> bytes:
    return fernet.encrypt(plaintext.encode())

def decrypt_credentials(ciphertext: bytes) -> str:
    return fernet.decrypt(ciphertext).decode()
```

### What Gets Encrypted

| Field | Stored As | Encrypted? |
|---|---|---|
| MCP server URL | Plain text | No — needed for display |
| OAuth access token | BYTEA | Yes |
| OAuth refresh token | BYTEA | Yes |
| API key | BYTEA | Yes |
| Server name | VARCHAR | No |

### OAuth Flow for MCP Servers

For MCP servers that use OAuth (Slack, GitHub, Google services):

```
User clicks "Connect Slack" in Agent Settings
    │
    ▼
Frontend redirects to Slack OAuth:
https://slack.com/oauth/v2/authorize?client_id=...&redirect_uri=...&scope=...
    │
    ▼
User authorizes → Slack redirects back to:
https://falah.ai/api/v1/mcp/oauth/callback?code=ABC123&state=...
    │
    ▼
Backend exchanges code for access_token + refresh_token
    │
    ▼
Backend encrypts tokens, stores in agent_mcp_connections
    │
    ▼
Frontend shows "Slack Connected ✓"
```

---

## 7. Frontend — Agent MCP Configuration UI

### Where It Lives

Add to the existing **AgentDetailPage** as a new section below the current fields.

### UI Design

```
┌─ Agent Settings ──────────────────────────────────┐
│                                                   │
│  [Current fields: name, role, voice, etc.]        │
│                                                   │
│  ─── Connected Tools ──────────────────────────── │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ 🔗 Slack          Connected    [Disconnect] │  │
│  │    Tools: send_message, list_channels       │  │
│  ├─────────────────────────────────────────────┤  │
│  │ 🔗 Jira           Connected    [Disconnect] │  │
│  │    Tools: create_issue, search_issues       │  │
│  ├─────────────────────────────────────────────┤  │
│  │ + Connect New Tool                          │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ─── Quick Connect (Popular) ──────────────────── │
│                                                   │
│  [Slack] [GitHub] [Google Calendar] [Jira] [Notion]│
│                                                   │
│  ─── Custom MCP Server ───────────────────────── │
│                                                   │
│  Server URL: [https://...                      ]  │
│  Auth Type:  [OAuth2 ▼]                           │
│  API Key:    [••••••••••                       ]  │
│  [Test Connection]  [Save]                        │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## 8. API Endpoints

```
# MCP Connection Management
POST   /api/v1/mcp/connections              — Add MCP connection to agent
GET    /api/v1/mcp/connections?persona_id=   — List connections for agent
DELETE /api/v1/mcp/connections/{id}          — Remove connection
PATCH  /api/v1/mcp/connections/{id}          — Update (toggle tools, refresh token)

# MCP Tool Discovery
GET    /api/v1/mcp/connections/{id}/tools    — List available tools from server

# OAuth Callbacks
GET    /api/v1/mcp/oauth/callback            — OAuth redirect handler
POST   /api/v1/mcp/oauth/initiate            — Start OAuth flow for a provider

# Test
POST   /api/v1/mcp/connections/{id}/test     — Test connectivity to MCP server
```

---

## 9. Backend Feature Module Structure

Following the existing conventions:

```
backend/app/features/mcp/
├── models.py          — AgentMCPConnection SQLAlchemy model
├── schemas.py         — Pydantic schemas (CreateConnection, ConnectionResponse, etc.)
├── router.py          — FastAPI endpoints
├── service.py         — Business logic (connect, discover tools, execute)
├── repository.py      — DB operations
├── client.py          — MCP client wrapper (SSE, stdio, streamable HTTP)
├── encryption.py      — Credential encrypt/decrypt (or use core/encryption.py)
├── tool_router.py     — Routes Gemini function calls → correct MCP server
└── constants.py       — ALWAYS_CONFIRM set, popular MCP server configs
```

---

## 10. The Synchronous Function Calling Problem

### The Problem

Gemini 3.1 Flash Live function calling is **synchronous** — the model stops generating audio while waiting for the tool response. If an MCP call takes 3 seconds, the user hears 3 seconds of silence.

### Solutions

**A. Pre-announce before tool call (Recommended)**

Configure the system prompt to make the agent verbally announce what it's about to do BEFORE the tool call:

```
SYSTEM INSTRUCTION ADDITION:
"Before calling any external tool, always tell the user what you're about to do
and that it may take a moment. For example: 'Let me create that Jira ticket for you,
one moment.' Then proceed with the tool call."
```

This way the user hears the announcement, THEN experiences the brief silence during execution. Much better UX than unexpected silence.

**B. Timeout + graceful fallback**

```python
try:
    result = await asyncio.wait_for(execute_mcp_tool(...), timeout=10.0)
except asyncio.TimeoutError:
    # Return error so Gemini can verbally tell the user
    result = {"error": "The tool is taking too long. Let's continue and try again later."}
```

**C. Parallel tool execution (when model requests multiple tools)**

```python
if len(function_calls) > 1:
    results = await asyncio.gather(*[
        execute_tool(fc) for fc in function_calls
    ], return_exceptions=True)
```

---

## 11. Migration Path from Current Codebase

### What Changes in agent.py

```python
# CURRENT (Gemini 2.5 Flash)
config = LiveConnectConfig(
    response_modalities=["AUDIO"],
    thinking_config=types.ThinkingConfig(thinking_budget=128),
    context_window_compression=...,
    realtime_input_config=types.RealtimeInputConfig(
        automatic_activity_detection=types.AutomaticActivityDetection(disabled=False)
    ),
)

# NEW (Gemini 3.1 Flash Live)
config = LiveConnectConfig(
    response_modalities=["AUDIO"],
    thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),  # CHANGED
    context_window_compression=...,
    realtime_input_config=types.RealtimeInputConfig(
        automatic_activity_detection=types.AutomaticActivityDetection(disabled=False)
    ),
    tools=await build_tool_declarations(persona_id, db),  # NEW — MCP tools
    # REMOVED: affective_dialog flag (not needed — 3.1 audio-to-audio handles
    #          emotion implicitly. Compensate via system prompt instructions.)
    # REMOVED: proactivity (not supported in 3.1)
)
```

### What Changes in the Receive Loop

```python
# CURRENT — only handles audio responses
async for response in session.receive():
    if response.data:  # audio data
        await send_audio_to_livekit(response.data)

# NEW — handles audio AND tool calls
async for response in session.receive():
    if response.data:
        await send_audio_to_livekit(response.data)

    if response.tool_call:  # NEW
        for fc in response.tool_call.function_calls:
            # Check if confirmation needed
            if await is_destructive_action(fc.name, fc.args):
                approved = await request_user_confirmation(room, fc)
                if not approved:
                    await session.send(types.FunctionResponse(
                        name=fc.name, id=fc.id,
                        response={"error": "User denied this action"}
                    ))
                    continue

            # Execute tool
            result = await handle_tool_call(fc, persona_id, db)
            await session.send(types.FunctionResponse(
                name=fc.name, id=fc.id,
                response=result
            ))
```

---

## 12. Phase 1 Scope — Start Small

Don't build the entire MCP universe on day one. Start with:

### 3 Built-in Tools (No MCP servers needed)

| Tool | What It Does | Why First |
|---|---|---|
| `fetch_context` | Queries pgvector RAG mid-conversation | Completes your Live RAG pillar |
| `save_note` | Saves a user note/action item to DB | Simple write operation, tests the full flow |
| `end_session_with_score` | Ends session and triggers scoring | Replaces current manual scoring trigger |

### 2 MCP Integrations (Prove the MCP flow)

| Integration | Why |
|---|---|
| **Google Calendar** | Google has official MCP server. High value — agents can schedule follow-ups. |
| **Slack** | High demand. Agents can send session summaries to a Slack channel. |

### What to Defer

- Custom MCP URL input (Phase 2)
- OAuth flow for third-party services (Phase 2 — start with API key auth)
- Docker sandboxing (Phase 2 — not needed for trusted first-party MCP servers)
- MCP marketplace / directory (Phase 3)

---

## 13. Estimated Effort

| Task | Days | Depends On |
|---|---|---|
| Upgrade to Gemini 3.1 Flash Live (config changes) | 1 | Nothing |
| Built-in tools (fetch_context, save_note, end_session) | 2-3 | Refactoring Phase 2.3 (async fix) |
| MCP feature module (models, schemas, router, service) | 3-4 | Refactoring Phase 1.1 (RBAC) |
| MCP client wrapper (SSE + streamable HTTP) | 2 | Nothing |
| Tool router + Gemini integration in agent.py | 2-3 | MCP feature module |
| Human-in-the-loop confirmation (data channel) | 2 | Tool router |
| Frontend: MCP connection UI on AgentDetailPage | 2-3 | MCP API endpoints |
| Frontend: Confirmation modal on LivePitchPage | 1 | Data channel events |
| Google Calendar + Slack integration + testing | 2-3 | Everything above |
| **Total** | **~15-18 days** | |

---

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| MCP server goes down mid-voice-session | Medium | User hears long silence → bad UX | 10-second timeout + verbal fallback |
| User pastes malicious MCP URL | Low | Could exfiltrate data | Allowlist for Phase 1, validate URL format, encrypt credentials |
| Gemini calls wrong tool | Low | Unintended action | Human confirmation for all write operations |
| OAuth token expires mid-session | Medium | Tool call fails silently | Refresh token flow + verbal error message |
| Too many tools slow session start | Low | 2-3s delay on room join | Cache tool declarations per agent, refresh on config change |

---

## Sources

- [Gemini 3.1 Flash Live — Google Blog](https://blog.google/innovation-and-ai/technology/developers-tools/build-with-gemini-3-1-flash-live/)
- [Gemini 3.1 Flash Live Developer Docs](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview)
- [Gemini 3.1 Flash Live — Making Audio AI More Natural](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-live/)
- [Tool Use with Live API](https://ai.google.dev/gemini-api/docs/live-api/tools)
- [Google MCP Support Announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-official-mcp-support-for-google-services)
- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [9to5Google — Gemini 3.1 Flash Live](https://9to5google.com/2026/03/26/gemini-3-1-flash-live/)
- [MarkTechPost — Gemini 3.1 Flash Live](https://www.marktechpost.com/2026/03/26/google-releases-gemini-3-1-flash-live-a-real-time-multimodal-voice-model-for-low-latency-audio-video-and-tool-use-for-ai-agents/)
