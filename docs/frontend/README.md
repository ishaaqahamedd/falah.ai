# Frontend Documentation

This folder contains documentation for all frontend implementations, specs, and architectural decisions.

## Files

| File | Description | Status |
|------|-------------|--------|
| *(Add files as frontend features are documented)* | | |

> **Rule:** Add new docs here whenever a significant frontend feature is built or a design decision is made.

## Architecture: Feature-Sliced Design (FSD)

The frontend follows FSD architecture inside `frontend/src/`:

| Layer | Path | Purpose |
|-------|------|---------|
| `app/` | `src/app/` | App shell: router config, layouts (AppLayout, LiveLayout), ProtectedRoute |
| `pages/` | `src/pages/` | Route-level page components |
| `features/` | `src/features/` | Feature modules with API clients, stores, and logic |
| `widgets/` | `src/widgets/` | Composite UI blocks (scorecard, transcript viewer, dock, etc.) |
| `entities/` | `src/entities/` | Domain types & constants |
| `shared/` | `src/shared/` | Reusable UI components & utilities |

## Pages & Routes

| Route | Page Component | Layout | Auth |
|-------|---------------|--------|------|
| `/login` | `LoginPage` | None (public) | ❌ |
| `/signup` | `SignupPage` | None (public) | ❌ |
| `/agents` | `AgentsPage` | AppLayout | ✅ |
| `/agents/:id` | `AgentDetailPage` | AppLayout | ✅ |
| `/sessions` | `SessionsPage` | AppLayout | ✅ |
| `/sessions/:id` | `SessionDetailPage` | AppLayout | ✅ |
| `/community` | `CommunityPage` | AppLayout | ✅ |
| `/connectors` | `ConnectorsPage` | AppLayout | ✅ |
| `/live/:roomName` | `LivePitchPage` | LiveLayout (fullscreen) | ✅ |

> Default route `/` redirects to `/agents`.

## Frontend Feature Modules

| Module | Path | Purpose |
|--------|------|---------|
| `auth` | `src/features/auth/` | Auth API client, Zustand store, Google OAuth flow |
| `personas` | `src/features/personas/` | Persona CRUD API client, state management |
| `sessions` | `src/features/sessions/` | Session list/detail API, scoring triggers |
| `livekit` | `src/features/livekit/` | LiveKit room connection, WebRTC audio/video, token fetching |
| `onboarding` | `src/features/onboarding/` | Onboarding bubble UI, voice agent connection |
| `context` | `src/features/context/` | Document upload, briefing retrieval |

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** (dev server + bundler)
- **Tailwind CSS v4**
- **Zustand** (state management)
- **React Router v7** (`createBrowserRouter`)
