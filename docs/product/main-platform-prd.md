# Falah.ai — Platform PRD

## 1. Product Vision

Falah.ai is a real-time AI practice platform where users create custom AI personas and have live, voice-based conversations with them — for sales calls, investor pitches, interviews, onboarding, training, or any scenario requiring verbal skill development.

The AI sees your screen (multimodal vision), hears your voice, responds in real-time audio, scores your performance post-session, and adapts across sessions to progressively challenge you.

## 2. Target Audiences

| Audience | Use Case |
|----------|----------|
| **Sales Reps** | Practice investor and client pitches with realistic AI personas |
| **Startup Founders** | Rehearse VC pitches where the AI pushes back on weak areas |
| **Interview Candidates** | Simulate technical or behavioral interviews |
| **Corporate Trainers** | Build custom onboarding or compliance training agents |
| **Educators** | Create AI tutors for language practice or exam prep |

## 3. Core Features

### 3.1 Custom AI Agents (Personas)
Users create personas with configurable: name, role, personality, focus areas, voice, scoring criteria, behavior rules, and opening messages.

### 3.2 Live Sessions (WebRTC + Gemini Live API)
Real-time audio conversations over LiveKit WebRTC. The AI can see the user's screen via screen sharing and respond contextually to what's displayed.

### 3.3 AI Scoring & Transcripts
Every session is recorded with a full transcript and AI-generated scorecard across 5 dimensions (Clarity, Objection Handling, Engagement, Context Awareness, Closing Strength). Each dimension is scored 1-10 with specific feedback.

### 3.4 Cross-Session Adaptive Intelligence
The AI remembers past sessions. It probes weak areas from previous runs, acknowledges improvement, escalates difficulty, and avoids repeating the same opening questions.

### 3.5 Community Sharing
Users can make agents public for others to discover and use on the Community page. Agents track `use_count`.

### 3.6 Context Injection (Connectors)
Upload documents (PDF, text) that the AI uses as context during live sessions. Semantic search via pgvector embeddings (Gemini Embedding 2, 3072 dims). Pre-call briefings are auto-generated with structured sections: Key Concerns, Recent Communications, Decision Factors, and Specific Data Points.

### 3.7 Voice-Guided Onboarding
First-time users get an AI onboarding agent that walks them through the platform via real-time voice conversation. The agent can see the user's screen and guide them step-by-step. Supports resumption if interrupted.

### 3.8 Google OAuth Authentication
Single sign-on with Google. JWT-based session tokens (HS256, 7-day expiry for dev).

## 4. Out of Scope (Current Phase)

- Multi‑tenant / team workspaces
- Billing / subscriptions
- Native mobile app
- Video recording of sessions
- Real-time collaborative sessions (multiple humans)
