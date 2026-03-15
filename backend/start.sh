#!/bin/bash
set -e

# Trap signals for clean shutdown
cleanup() {
    echo "Shutting down..."
    kill $AGENT_PID 2>/dev/null || true
    wait $AGENT_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

# Start LiveKit agent worker in background
echo "Starting LiveKit agent worker..."
python -m app.features.livekit.agent &
AGENT_PID=$!

# Start FastAPI server in foreground
echo "Starting FastAPI server on port ${PORT:-8000}..."
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
