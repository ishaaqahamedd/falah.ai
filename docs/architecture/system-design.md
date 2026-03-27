# System Design

## Overview

Falah.ai runs as a **two-process backend** (REST API + LiveKit Agent Worker) with a React SPA frontend. All real-time audio/video flows through LiveKit Cloud (WebRTC), and the AI brain is Gemini 2.5 Flash with native audio + vision capabilities via the Live API.

## Architecture Diagram

```
                        ┌─────────────┐
                        │  React SPA  │
                        │  (Vite)     │
                        └──────┬──────┘
                               │
              ┌────────────────┼────────────────┐
              │ HTTP (REST)    │                 │ WebRTC (audio/video)
              ▼                │                 ▼
    ┌──────────────────┐       │       ┌──────────────────┐
    │   FastAPI Server │       │       │  LiveKit Cloud   │
    │   :8000          │       │       │  (WebRTC SFU)    │
    │                  │       │       └────────┬─────────┘
    │  Auth, Personas, │       │                │
    │  Sessions, etc.  │       │                │ Joins rooms
    └────────┬─────────┘       │       ┌────────▼─────────┐
             │                 │       │  Agent Worker     │
             │ read/write      │       │  (livekit SDK)    │
             ▼                 │       │                   │
    ┌──────────────────┐       │       └────────┬──────────┘
    │   PostgreSQL     │       │                │
    │   (asyncpg)      │       │                │ Streaming audio/video
    │   + pgvector     │       │       ┌────────▼──────────┐
    └──────────────────┘       │       │  Gemini Live API  │
                               │       │  (Google Cloud)   │
                               │       └───────────────────┘
                               │
```

## Infrastructure Choices

| Layer | Technology | Why |
|-------|------------|-----|
| **Frontend** | React 19, Vite, Tailwind CSS v4, Zustand, React Router v7 | Modern SPA stack with fast HMR and minimal bundle |
| **Backend API** | FastAPI + Uvicorn (async) | High-performance async Python, auto OpenAPI docs |
| **ORM** | SQLAlchemy (async) + Alembic | Mature async ORM with migration support |
| **Database** | PostgreSQL + pgvector | Relational data + vector similarity search for context/embeddings |
| **AI Engine** | Gemini 2.5 Flash (`gemini-2.5-flash-native-audio-preview-12-2025`) | Native audio + vision, real-time streaming via Live API |
| **Real-time** | LiveKit WebRTC + LiveKit Agents SDK | Low-latency audio/video, server-side agent framework |
| **Auth** | JWT (HS256) + Google OAuth | Simple token auth with social login |
| **Containerization** | Docker + Docker Compose | Two-service deployment (frontend Nginx + backend) |

## Key Architectural Decisions

### Two-Process Model
The API server and LiveKit agent worker are separate processes. The API handles REST CRUD; the agent worker joins WebRTC rooms and orchestrates AI sessions. They share the same PostgreSQL database but run independently.

### Persona Snapshots
When a session starts, the persona config is frozen as a JSONB snapshot in the `PitchSession` record. This means analytics survive persona edits or deletions.

### Context Window Compression
Gemini's 128K context window is managed with sliding window compression: trigger at 90K tokens, compress down to 45K tokens. This prevents session degradation in long conversations.

### Async Throughout
Every DB call uses asyncpg via SQLAlchemy's async engine. No blocking I/O in the request path.

### Video Frame Throttling
Screen share frames are throttled to prevent context bloat: 0.5 FPS while speaking, 0.2 FPS while silent, minimum 2s between frames on the direct WebSocket path.
