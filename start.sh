#!/bin/bash

# Ensure Redis is running (starts it if installed via brew)
brew services start redis

# Activate python environment and set API Key
source venv/bin/activate
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "Starting FastAPI Backend on port 8000..."
uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "Starting Macro-Economic Swarm Runner..."
python3 agents/swarm_runner.py &
SWARM_PID=$!

echo "Starting React Frontend on port 5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "====================================================="
echo "SharkFin Simulation Engine is LIVE!"
echo "Open your browser to: http://localhost:5173"
echo "Press Ctrl+C to shut everything down."
echo "====================================================="

# Wait for user to press Ctrl+C, then kill background jobs
trap "kill $BACKEND_PID $SWARM_PID $FRONTEND_PID; exit" INT TERM
wait
