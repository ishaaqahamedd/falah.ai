# Backend — AI Pitch Simulator

FastAPI backend + LiveKit agent worker for the AI Sales & Investor Pitch Simulator.

## Architecture

The backend runs as **two separate processes**:

| Process | Command | Purpose |
|---|---|---|
| **API Server** | `make dev-api` | REST API — auth, sessions, personas, DB |
| **Agent Worker** | `make dev-agent` | LiveKit worker — joins WebRTC rooms, runs Gemini AI |

Both must be running for the simulator to work. `make dev` starts them together.

### Scenario 1 — `make dev` (everything together)

```
                        YOUR MACHINE
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │   Browser (React)                                   │
  │       │                                             │
  │       │ HTTP (REST)          ┌─────────────────┐   │
  │       ├─────────────────────►│  API Server     │   │
  │       │   login, personas,   │  :8000 (FastAPI)│   │
  │       │   session history    └────────┬────────┘   │
  │       │                              │ read/write  │
  │       │                         ┌───▼────┐         │
  │       │                         │  DB    │         │
  │       │                         │(Postgres)        │
  │       │                         └────────┘         │
  │       │                                             │
  │       │ WebRTC (audio/video)                        │
  │       ├────────────────────────────────────────────►│──► LiveKit Cloud
  │       │                                             │        │
  │       │                    ┌────────────────────┐  │        │
  │       │                    │  Agent Worker      │◄─│────────┘
  │       │                    │  (livekit/agent.py)│  │   joins room,
  │       │                    └─────────┬──────────┘  │   handles WebRTC
  │       │                             │              │
  │       │                    ┌────────▼────────┐     │
  │       │                    │  Gemini Live API│     │
  │       │                    │  (Google Cloud) │     │
  │       │                    └─────────────────┘     │
  └─────────────────────────────────────────────────────┘

  Started with: make dev   (all 3 processes, one terminal)
```

### Scenario 2 — `make dev-api` + `make dev-agent` (split terminals)

```
  Terminal 1                        Terminal 2
  ────────────────────────          ────────────────────────
  $ make dev-api                    $ make dev-agent

  ┌──────────────────┐              ┌──────────────────────┐
  │   API Server     │              │   Agent Worker       │
  │   :8000          │              │   (livekit/agent.py) │
  │                  │              │                      │
  │  [api] INFO ...  │              │  INFO Connecting...  │
  │  [api] POST /... │              │  INFO Room joined    │
  │  [api] 200 OK    │              │  INFO Session start  │
  │                  │              │  INFO Gemini reply   │
  └──────────────────┘              └──────────────────────┘
         │                                    │
         │ PostgreSQL                         │ LiveKit Cloud
         ▼                                    ▼
    ┌─────────┐                      ┌──────────────────┐
    │   DB    │                      │  Gemini Live API │
    └─────────┘                      └──────────────────┘

  Use this when: monitoring agent logs, debugging room
  connections, or developing agent behaviour in isolation.
```

## Setup & Running

> All commands are run from the **project root** (one level up from this folder), not from inside `backend/`.

---

### Step 1 — Prerequisites

Make sure you have these installed before starting:

```bash
python --version    # needs 3.12+
node --version      # needs 22+
psql --version      # PostgreSQL must be running
```

> **Windows**: also install Make via `choco install make` (requires [Chocolatey](https://chocolatey.org/)).
> Or skip Make and use the manual commands in the fallback section below.

---

### Step 2 — Clone and enter the project

```bash
git clone <repo-url>
cd live
```

---

### Step 3 — One-time setup

```bash
make setup
```

This single command:
1. Creates `backend/venv/` (Python virtual environment)
2. Upgrades pip to avoid install conflicts
3. Installs all Python dependencies from `requirements.txt`
4. Creates `frontend/node_modules/` via `npm ci`
5. Scaffolds `backend/.env` from `.env.example` if it doesn't exist
6. Runs database migrations (`alembic upgrade head`)

---

### Step 4 — Fill in your API keys

Open `backend/.env` and fill in every blank value:

```bash
# open in your editor, e.g.:
code backend/.env
```

| Variable | Where to get it |
|---|---|
| `GOOGLE_API_KEY` | [Google AI Studio](https://aistudio.google.com) → API keys |
| `LIVEKIT_URL` | [LiveKit Cloud](https://cloud.livekit.io) → your project → Settings |
| `LIVEKIT_API_KEY` | LiveKit Cloud → your project → Keys |
| `LIVEKIT_API_SECRET` | LiveKit Cloud → your project → Keys |
| `DATABASE_URL` | your local Postgres: `postgresql://user:pass@localhost:5432/livepitch` |
| `SECRET_KEY` | run: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` (defaults are fine locally) |

---

### Step 5 — Choose your scenario and start

---

#### Scenario 1 — One terminal (recommended for daily use)

Everything starts together with prefixed logs so you can see all output in one place.

```bash
make dev
```

Expected output:

```
[agent]   INFO:     Connecting to LiveKit...
[agent]   INFO:     Worker registered, waiting for rooms
[api]     INFO:     Started reloader process
[api]     INFO:     Uvicorn running on http://localhost:8000
[web]     VITE v6.x  ready in 300ms
[web]     ➜  Local: http://localhost:5173
```

Press `Ctrl+C` to stop all three processes at once.

> Backend only (no frontend)? Use `make dev-backend` instead.

---

#### Scenario 2 — Split terminals (for monitoring / debugging)

Use this when you want to watch agent logs raw — room joins, metadata parsing,
Gemini session activity — without API log noise mixed in.

**Terminal 1 — API server:**

```bash
make dev-api
```

Expected output:

```
INFO:     Started reloader process
INFO:     Uvicorn running on http://localhost:8000
INFO:     Application startup complete
```

**Terminal 2 — Agent worker (full logs, no prefix):**

```bash
make dev-agent
```

Expected output:

```
INFO:     Connecting to LiveKit wss://...
INFO:     Worker registered successfully
INFO:     Waiting for room dispatch...
# (when a session starts)
INFO:     Room 'room-xyz' active. Connecting...
INFO:     Agent session started
INFO:     Gemini model initialized
```

Press `Ctrl+C` in either terminal to stop that process independently.

---

### Re-running migrations

Any time you pull new changes that include DB schema updates:

```bash
make migrate
```

---

### Fallback — no Make (Windows without Chocolatey)

If you can't install Make, run everything manually from inside `backend/`:

```bash
cd backend

# 1. Create venv
python -m venv venv

# 2. Activate it
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

# 3. Install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# 4. Copy and fill in .env
copy .env.example .env         # Windows
# cp .env.example .env         # Mac/Linux

# 5. Run migrations
alembic upgrade head
```

Then pick a scenario:

**Scenario 1 — single terminal (Git Bash):**

```bash
# run from backend/
PYTHONPATH=. python -m app.features.livekit.agent dev &
uvicorn main:app --reload --port 8000
```

**Scenario 2 — split terminals:**

```bash
# Terminal 1 (from backend/)
uvicorn main:app --reload --port 8000

# Terminal 2 (from backend/)
set PYTHONPATH=.                              # Windows CMD
# export PYTHONPATH=.                        # Mac/Linux/Git Bash
venv/Scripts/python -m app.features.livekit.agent dev
```

## Tech Stack

- **FastAPI** + Uvicorn — REST API
- **SQLAlchemy** (async) + Alembic — ORM and migrations
- **LiveKit Agents SDK** — WebRTC worker framework
- **Gemini Live API** (`gemini-2.5-flash-native-audio-preview-12-2025`) — real-time multimodal AI
- **PostgreSQL** — database

## Key files

| File | Purpose |
|---|---|
| `main.py` | FastAPI app entrypoint |
| `app/features/livekit/agent.py` | LiveKit agent worker — joins rooms, runs AI session |
| `app/features/livekit/personas.py` | Hardcoded investor persona prompts |
| `app/features/sessions/` | Session creation, scoring, transcript storage |
| `app/features/personas/` | Custom persona CRUD |
| `app/features/auth/` | JWT auth |
| `alembic/` | DB migration scripts |
| `start.sh` | Docker entrypoint — runs both processes in one container |

## Environment variables

| Variable | Description |
|---|---|
| `GOOGLE_API_KEY` | Gemini API key from Google Cloud Console |
| `LIVEKIT_URL` | LiveKit server URL (`wss://...`) |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `CORS_ORIGINS` | Comma-separated allowed origins (e.g. `http://localhost:5173`) |
