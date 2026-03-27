# Developer Setup Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.12+ | Backend runtime |
| Node.js | 22+ | Frontend tooling |
| PostgreSQL | Any recent | Primary database |
| Docker + Docker Compose | (Optional) | Containerized deployment |

## External Services (Free Tiers Available)

| Service | Where to Get It | What You Need |
|---------|----------------|---------------|
| **Google Gemini API Key** | [Google AI Studio](https://aistudio.google.com/apikey) | `GOOGLE_API_KEY` |
| **Google OAuth Client ID** | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) | `GOOGLE_CLIENT_ID` |
| **LiveKit Cloud** | [LiveKit Cloud](https://cloud.livekit.io/) | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` |
| **PostgreSQL** | Local install, or [Supabase](https://supabase.com/) / [Neon](https://neon.tech/) | `DATABASE_URL` |

## Option A: Local Setup (Recommended)

### 1. Clone and enter the project

```bash
git clone <repo-url>
cd falah
```

### 2. One-time setup

```bash
make setup
```

This creates the Python venv, installs all dependencies, scaffolds `.env` files, and runs DB migrations.

> **Windows users**: Install Make via `choco install make` or use the manual fallback below.

### 3. Fill in API keys

**`backend/.env`**

| Variable | Description |
|----------|-------------|
| `GOOGLE_API_KEY` | Gemini API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `LIVEKIT_URL` | LiveKit server URL (`wss://...`) |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | Generate with: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` |

**`frontend/.env`**

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | `http://localhost:8000/api/v1` |
| `VITE_LIVEKIT_URL` | Same LiveKit URL as backend |
| `VITE_GOOGLE_CLIENT_ID` | Same Google OAuth client ID |

### 4. Run everything

```bash
make dev
```

Starts API server (`:8000`), LiveKit agent worker, and React frontend (`:5173`) in one terminal.

### Other commands

| Command | What it runs |
|---------|-------------|
| `make dev` | API + Agent + Frontend |
| `make dev-backend` | API + Agent only |
| `make dev-api` | FastAPI server only |
| `make dev-agent` | LiveKit agent only (raw logs) |
| `make migrate` | Run DB migrations |

## Option B: Docker Setup

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Fill in API keys, then:
docker compose up --build
```

Frontend at `http://localhost`, backend at `http://localhost:8000`.

## Manual Fallback (Windows without Make)

```bash
cd backend
python -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
# Fill in .env, then:
alembic upgrade head

# Terminal 1: API server
uvicorn main:app --reload --port 8000

# Terminal 2: Agent worker
set PYTHONPATH=.
venv\Scripts\python -m app.features.livekit.agent dev
```
