# PRD Gap Analysis

## Purpose
Audit comparing the PRD requirements against the actual coded implementation.

## Feature Coverage

| PRD Feature | Backend | Frontend | Status |
|-------------|---------|----------|--------|
| Custom AI Agents (Personas) | ✅ Full CRUD + templates | ✅ AgentsPage + AgentDetailPage | ✅ Complete |
| Live Sessions (WebRTC + Gemini) | ✅ LiveKit agent + token API | ✅ LivePitchPage | ✅ Complete |
| AI Scoring (5 dimensions) | ✅ Auto-trigger post-session | ✅ SessionDetailPage w/ scorecard | ✅ Complete |
| Cross-Session Adaptation | ✅ Session history in metadata | ✅ Adaptive prompting rules | ✅ Complete |
| Community Sharing | ✅ `is_public` + `use_count` | ✅ CommunityPage | ✅ Complete |
| Context Injection (Connectors) | ✅ Upload, embeddings, search, briefing | ✅ ConnectorsPage | ✅ Complete |
| Voice-Guided Onboarding | ✅ Onboarding agent + step tracking | ✅ OnboardingBubble | ✅ Complete |
| Google OAuth | ✅ `POST /auth/google` | ✅ LoginPage | ✅ Complete |
| Screen Sharing + Vision | ✅ Frame throttling + Gemini vision | ✅ Screen share in LivePitchPage | ✅ Complete |

## Outstanding Gaps

| Gap | Severity | Details |
|-----|----------|---------|
| E2E Verification (Phase 4F) | 🟡 Medium | 10 verification steps remain unchecked in `PHASE4_TASKS.md` |
| Manual auth routes | 🟢 Low | `POST /register` and `POST /login` are commented out — Google OAuth only |
| Legacy WebSocket endpoint | 🟢 Low | `/ws/pitch/{persona_id}` in `main.py` exists alongside LiveKit path — dead code candidate |
| Analytics page | 🟡 Medium | No dedicated `/analytics` route — session analytics are per-session only |

## Action Items

- [ ] Complete Phase 4F E2E verification checklist
- [ ] Remove or mark legacy WebSocket endpoint as deprecated
- [ ] Consider a global analytics dashboard route
