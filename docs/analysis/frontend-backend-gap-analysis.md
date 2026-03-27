# Frontend-Backend Gap Analysis

## Overview
Alignment check between backend API endpoints and frontend consumption.

## Endpoint Coverage

| Backend Endpoint | Frontend Consumer | Aligned? |
|-----------------|-------------------|----------|
| `POST /api/v1/auth/google` | `features/auth/` API client | ✅ |
| `GET /api/v1/auth/me` | `features/auth/` store | ✅ |
| `GET /api/v1/personas/` | `features/personas/` API client | ✅ |
| `POST /api/v1/personas/` | AgentDetailPage create flow | ✅ |
| `GET /api/v1/personas/{id}` | AgentDetailPage | ✅ |
| `PUT /api/v1/personas/{id}` | AgentDetailPage edit flow | ✅ |
| `DELETE /api/v1/personas/{id}` | AgentDetailPage delete action | ✅ |
| `GET /api/v1/personas/templates` | AgentsPage quick-start | ✅ |
| `GET /api/v1/personas/community` | CommunityPage | ✅ |
| `POST /api/v1/sessions/` | Session start flow | ✅ |
| `PATCH /api/v1/sessions/{id}` | Session end flow | ✅ |
| `GET /api/v1/sessions/` | SessionsPage | ✅ |
| `GET /api/v1/sessions/{id}` | SessionDetailPage | ✅ |
| `POST /api/v1/sessions/{id}/score` | Manual scoring trigger | ✅ |
| `GET /api/v1/livekit/token` | LivePitchPage pre-flight | ✅ |
| `GET /api/v1/livekit/onboarding-token` | OnboardingBubble | ✅ |
| `POST /api/v1/context/upload` | ConnectorsPage | ✅ |
| `GET /api/v1/context/documents` | ConnectorsPage document list | ✅ |
| `GET /api/v1/context/briefing` | Pre-session briefing panel | ✅ |
| `GET /api/v1/context/search` | ⚠️ No UI exposed | ❌ Gap |
| `PATCH /api/v1/onboarding/progress` | OnboardingBubble | ✅ |

## Identified Gaps

| Gap | Details | Priority |
|-----|---------|----------|
| **Context semantic search** | `GET /api/v1/context/search` has no frontend UI. The endpoint exists and works but is only used server-side. | 🟢 Low — briefing covers this use case |
| **Legacy WebSocket** | `/ws/pitch/{persona_id}` in `main.py` is not consumed by current frontend (migrated to LiveKit). | 🟡 Medium — dead code, candidate for removal |

## Resolutions
- Consider adding a search UI in the ConnectorsPage for power users
- Remove or deprecate the legacy WebSocket endpoint
