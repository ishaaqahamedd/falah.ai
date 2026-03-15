.PHONY: setup migrate dev dev-backend dev-frontend dev-api dev-agent

# ── Path helpers (works on Mac/Linux/Windows Git Bash) ──────────────────────
ifeq ($(OS),Windows_NT)
	PYTHON   := backend/venv/Scripts/python
	UVICORN  := backend/venv/Scripts/uvicorn
else
	PYTHON   := backend/venv/bin/python
	UVICORN  := backend/venv/bin/uvicorn
endif

# ── First-time setup ─────────────────────────────────────────────────────────
setup:
	@echo ">>> Setting up backend..."
	cd backend && python -m venv venv
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install -r backend/requirements.txt
	@if [ ! -f backend/.env ]; then \
		cp backend/.env.example backend/.env; \
		echo ""; \
		echo "!! Created backend/.env — open it and fill in your API keys before running 'make dev'"; \
	fi
	@echo ""
	@echo ">>> Setting up frontend..."
	cd frontend && npm ci
	@if [ ! -f frontend/.env ]; then cp frontend/.env.example frontend/.env; fi
	@echo ""
	@echo ">>> Running database migrations..."
	cd backend && PYTHONPATH=. $(PYTHON) -m alembic upgrade head
	@echo ""
	@echo "✓ Setup complete. Run 'make dev' to start everything."

# ── Database migrations ───────────────────────────────────────────────────────
migrate:
	cd backend && PYTHONPATH=. $(PYTHON) -m alembic upgrade head

# ── Run everything (API + Agent + Frontend) ───────────────────────────────────
dev:
	@echo ">>> Starting all services (Ctrl+C to stop all)..."
	@trap 'kill 0' EXIT; \
	(cd backend && PYTHONPATH=. $(PYTHON) -m app.features.livekit.agent dev 2>&1 | sed 's/^/[agent]  /') & \
	(cd backend && $(UVICORN) main:app --reload --port 8000 2>&1 | sed 's/^/[api]    /') & \
	(cd frontend && npm run dev 2>&1 | sed 's/^/[web]    /') & \
	wait

# ── Backend only (API + Agent) ────────────────────────────────────────────────
dev-backend:
	@trap 'kill 0' EXIT; \
	(cd backend && PYTHONPATH=. $(PYTHON) -m app.features.livekit.agent dev 2>&1 | sed 's/^/[agent]  /') & \
	(cd backend && $(UVICORN) main:app --reload --port 8000 2>&1 | sed 's/^/[api]    /') & \
	wait

# ── Individual services (for monitoring/debugging) ───────────────────────────
dev-api:
	cd backend && $(UVICORN) main:app --reload --port 8000

dev-agent:
	cd backend && PYTHONPATH=. $(PYTHON) -m app.features.livekit.agent dev
