#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo "========================================"
echo "  Agentic Video Editor — Starting Up"
echo "========================================"

# ── Backend setup ─────────────────────────────────────────────────────────────
echo ""
echo "📦 Setting up Python backend..."
cd "$BACKEND"

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "  ⚠️  Created .env from template — add your ANTHROPIC_API_KEY"
fi

if [ ! -d "venv" ]; then
  echo "  Creating Python virtual environment..."
  python -m venv venv
fi

source venv/bin/activate || source venv/Scripts/activate

echo "  Installing Python dependencies..."
pip install -q -r requirements.txt

echo "  Starting FastAPI server on port 8000..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

cd "$ROOT"

# ── Frontend setup ─────────────────────────────────────────────────────────────
echo ""
echo "🎨 Setting up React frontend..."
cd "$FRONTEND"

if [ ! -d "node_modules" ]; then
  echo "  Installing npm packages..."
  npm install
fi

echo "  Starting Vite dev server on port 5173..."
npm run dev &
FRONTEND_PID=$!

cd "$ROOT"

echo ""
echo "========================================"
echo "  ✅ Both servers started!"
echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo "  API docs: http://localhost:8000/docs"
echo ""
echo "  Press Ctrl+C to stop both servers"
echo "========================================"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
