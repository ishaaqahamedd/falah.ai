# Live CPR - AI Sales & Investor Pitch Simulator

Real-time AI pitch simulator powered by Gemini Live API and LiveKit WebRTC.

## Prerequisites

- **Python 3.12** (check with `python --version`)
- **Node.js 22** (check with `node --version`)
- **PostgreSQL** (or use the Supabase cloud DB)
- **Docker & Docker Compose** (optional, for containerized setup)

## Quick Start (Local)

### 1. Clone the repo

```bash
git clone <repo-url>
cd Live-cpr
```

### 2. One-time setup

> **Windows**: requires [Make for Git Bash](https://chocolatey.org/packages/make) — or use Docker below.

```bash
make setup
```

This creates the Python venv, installs all dependencies, scaffolds your `.env` files, and runs DB migrations automatically.

### 3. Fill in your API keys

Open `backend/.env` and fill in:

| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` | Gemini API key from Google Cloud Console |
| `LIVEKIT_URL` | Your LiveKit server URL (wss://...) |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | Random string for JWT signing — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `CORS_ORIGINS` | Comma-separated allowed origins |

### 4. Run everything

```bash
make dev
```

This starts the FastAPI server, LiveKit agent worker, and React frontend — all in one terminal with prefixed logs:

```
[api]     INFO:     Uvicorn running on http://localhost:8000
[agent]   INFO:     Connected to LiveKit, waiting for rooms...
[web]     VITE ready on http://localhost:5173
```

Press `Ctrl+C` to stop all processes at once.

#### Other commands

| Command | What it runs |
|---|---|
| `make dev` | API + Agent + Frontend (everything) |
| `make dev-backend` | API + Agent only (no frontend) |
| `make dev-api` | FastAPI server only |
| `make dev-agent` | LiveKit agent only — raw logs for monitoring |
| `make migrate` | Run DB migrations manually |

> Tip: open two terminals and run `make dev-api` + `make dev-agent` separately if you want to monitor the agent logs on their own.

## Quick Start (Docker)

```bash
# 1. Copy both env files and fill in your keys
cp .env.example .env                     # root: LIVEKIT_URL for frontend build
cp backend/.env.example backend/.env    # backend: all API keys

# 2. Build and run
docker compose up --build
```

Frontend will be available at `http://localhost` and backend at `http://localhost:8000`.

## Project Structure

```
├── backend/           # FastAPI + Python
│   ├── app/
│   │   ├── core/      # Config, security
│   │   ├── db/        # Database setup
│   │   └── features/  # Auth, personas, sessions, livekit, context
│   ├── alembic/       # DB migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/          # React + Vite
│   ├── src/
│   │   ├── features/  # Auth, personas, sessions, livekit, context
│   │   ├── pages/
│   │   └── shared/    # API client, utilities
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```
