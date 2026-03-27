# Changelog: v1.0

## v1.0.0 (2026-03-28)

### Core Platform
- Custom AI persona creation with configurable name, role, personality, focus areas, voice, scoring criteria, behavior rules
- Real-time voice sessions via LiveKit WebRTC + Gemini 2.5 Flash Live API
- Screen sharing with AI vision — agent sees and responds to user's screen
- Google OAuth authentication (JWT, HS256)

### AI Intelligence
- Post-session AI scoring across 5 dimensions (Clarity, Objection Handling, Engagement, Context Awareness, Closing Strength)
- AI-generated session summaries
- Cross-session adaptive prompting — AI remembers past sessions, probes weak areas, escalates difficulty
- Context window compression (trigger at 90K tokens, compress to 45K)

### Context System
- Document upload with text extraction
- pgvector embeddings (Gemini Embedding 2, 3072 dims) for semantic search
- Pre-call briefing generation with structured sections

### Community
- Public persona sharing with use count tracking
- Community discovery page with search and type filtering
- Starter persona templates (Sarah - Tier 1 VC, David - Enterprise CTO)

### Onboarding
- Voice-guided onboarding agent for first-time users
- Screen-aware platform tour
- Step tracking with resumption support

### Infrastructure
- Two-process backend architecture (API server + LiveKit agent worker)
- Docker + Docker Compose deployment
- PostgreSQL with asyncpg async driver
- Alembic migrations
- Feature-Sliced Design frontend (React 19, Vite, Tailwind v4, Zustand)

### Documentation
- Hybrid documentation structure scaffolded (`docs/` with 10 directories)
- CONVENTIONS.md for AI coding assistant context optimization
