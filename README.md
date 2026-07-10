# HiveMind — Cyberpunk Multi-Agent Financial Simulator

HiveMind is a full-stack, real-time multi-agent simulation where autonomous AI agents debate live world events, drive a sentiment-powered market engine, and compete in structured red-team challenges. Built on Groq-hosted LLMs, FastAPI, Redis Pub/Sub, and a React dashboard.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Swarm Debate Engine** | A configurable cast of AI personas (The Regulator, The Whale, The Crypto Maxi…) debate macro events in parallel threads via Redis Pub/Sub. |
| **Sentiment-Driven Market** | Agent emotions (e.g. *panicked*, *bullish*) and influence scores move TECH, CRYPTO, and MACRO price indices in real time. |
| **Agent Portfolios & PnL** | Each agent autonomously buys/sells assets based on their current emotion, tracked against a $100,000 starting portfolio. |
| **Moderator & Debate Judge** | An LLM-powered Moderator enforces round limits and declares a debate winner, triggering a dramatic market price spike. |
| **Red-Team Mode** | Swap to a corporate red-team lineup (CFO, Legal Officer, CISO, Competitor, Customer Advocate) to stress-test a user-submitted strategy. |
| **Autopilot Mode** | Automatically inject curated or LLM-generated macro world events at configurable intervals (10 s – 5 min). |
| **Live React Dashboard** | Bento-box UI with agent sentiment cards, emotion timelines, live price charts, network graph, fear & greed gauge, and a live ticker tape. |
| **Dual Agent Backends** | Agents use either the native Groq SDK (`NativeGroqAgent`) or LangChain (`LangChainAgent`) — configurable per-persona in `personas.json`. |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React Frontend (Vite, port 5173)                           │
│  • Real-time WebSocket connection to FastAPI                │
│  • Sentiment Dashboard, Market Charts, Network Graph        │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket /ws
┌────────────────────────▼────────────────────────────────────┐
│  FastAPI Backend (Uvicorn, port 8000)                       │
│  • Bridges Redis → WebSocket → Frontend                     │
│  • REST API: /inject_seed, /set_mode, /autopilot/*          │
│  • Market Engine: price ticks, trades, portfolios           │
└────────────────────────┬────────────────────────────────────┘
                         │ Redis Pub/Sub (hivemind.events)
┌────────────────────────▼────────────────────────────────────┐
│  Swarm Runner (agents/swarm_runner.py)                      │
│  • N agent threads each subscribing to hivemind.events      │
│  • Agents read context, call Groq LLM, publish speech       │
│  • Moderator thread enforces max_rounds, picks winner       │
└─────────────────────────────────────────────────────────────┘
```

**Redis Key Schema:**

| Key Pattern | Purpose |
|---|---|
| `hivemind:events` | Central Pub/Sub channel for all events |
| `hivemind:mode` | Current mode (`macro` or `red_team`) |
| `hivemind:memory:{name}` | Episodic memory list per agent (last 8 turns) |
| `hivemind:sentiment:{name}` | Agent emotion, intensity, influence score |
| `hivemind:timeline:{name}` | Emotion history (last 10 entries) |
| `hivemind:market:{asset}:price` | Live price for `TECH`, `CRYPTO`, `MACRO` |
| `hivemind:market:{asset}:ticks` | Price tick history (last 60 ticks) |
| `hivemind:portfolio:{name}` | Agent portfolio: cash + asset positions |

---

## 📁 Project Structure

```
HiveMind/
├── agent.py                  # Base Agent class (simple Groq wrapper)
├── brain.py                  # Standalone Groq API connectivity test
├── debate.py                 # Simple two-agent Planner vs Critic demo
├── speaker.py                # Broadcasts ideas onto the Redis event bus
├── listener.py               # Subscribes to Redis bus, evaluates ideas
├── start.sh                  # One-command launcher for the full stack
├── commit_steps.py           # Dev utility for structured git commits
│
├── agents/
│   ├── swarm_agent.py        # BaseAgent, NativeGroqAgent, LangChainAgent
│   ├── swarm_runner.py       # Multi-threaded swarm orchestration + Moderator
│   ├── moderator.py          # Round-limited debate judge
│   ├── personas.json         # Macro mode agent personas
│   └── red_team_personas.json# Red-team mode corporate personas
│
├── backend/
│   └── main.py               # FastAPI app: WebSocket bridge, market engine, REST API
│
└── frontend/                 # React + Vite dashboard
    ├── src/
    ├── index.html
    └── package.json
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| **LLM Inference** | [Groq API](https://groq.com) — `llama-3.3-70b-versatile` |
| **Agent Framework** | Native Groq SDK + LangChain (per-agent configurable) |
| **Event Bus** | Redis Pub/Sub |
| **Backend API** | FastAPI + Uvicorn + WebSockets |
| **Market Data** | `yfinance` (live tickers for network graph nodes) |
| **Frontend** | React, Vite, Recharts |
| **Language** | Python 3.11+, JavaScript (ES2022) |

---

## 🚀 Installation

### Prerequisites
- Python 3.11+
- Node.js 18+
- Redis (running on `localhost:6379`)
- A [Groq API Key](https://console.groq.com)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/HiveMind.git
cd HiveMind

# 2. Start Redis (macOS with Homebrew)
brew services start redis

# 3. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# 4. Install Python dependencies
pip install groq langchain-groq fastapi uvicorn redis yfinance

# 5. Install frontend dependencies
cd frontend && npm install && cd ..

# 6. Set your Groq API key
echo "GROQ_API_KEY=your_key_here" > .env
```

---

## 🎮 Usage

### Full Stack (Recommended)

Launch everything — backend, swarm, and frontend — with a single command:

```bash
./start.sh
```

Then open **http://localhost:5173** in your browser.

---

### Individual Components

**Test basic Groq API connectivity:**
```bash
python brain.py
```

**Run a simple two-agent debate (no Redis required):**
```bash
python debate.py
```

**Run the event-driven pub/sub system:**

Start the listener in one terminal:
```bash
python listener.py
```
Broadcast an idea from another terminal:
```bash
python speaker.py "The Fed just raised rates by 100bps."
```

**Run only the backend API:**
```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Run only the swarm runner:**
```bash
cd agents && python swarm_runner.py
```

---

## 🌐 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/inject_seed` | Inject a custom world event (`{"seed": "..."}`) |
| `POST` | `/set_mode` | Switch debate mode (`{"mode": "macro"}` or `"red_team"`) |
| `POST` | `/inject_strategy` | Inject a strategy for red-team stress-testing |
| `POST` | `/update_config` | Update live config (e.g. `{"max_rounds": 10}`) |
| `GET`  | `/sentiment` | Get all agents' live emotion, influence, and portfolio |
| `GET`  | `/market_state` | Get current TECH/CRYPTO/MACRO prices and tick history |
| `GET`  | `/agent_memory/{name}` | Get an agent's episodic memory log |
| `GET`  | `/network_graph` | Get node/link data for the network graph visualization |
| `GET`  | `/personas` | Get the active mode's persona list |
| `POST` | `/autopilot/start` | Start autopilot (`{"interval_seconds": 60, "dynamic": false}`) |
| `POST` | `/autopilot/stop` | Stop autopilot |
| `GET`  | `/autopilot/status` | Get autopilot state and next fire countdown |
| `WS`   | `/ws` | WebSocket for real-time frontend event streaming |

---

## 🤖 Agent Modes

### Macro Mode (Default)

Six opinionated financial personas debate macro world events:

| Agent | Persona |
|---|---|
| **The Regulator** | SEC/Fed Chairman — market stability, rule enforcement |
| **The Whale** | Hedge fund manager — profit maximization, loophole hunting |
| **The Retail Mob** | r/WallStreetBets crowd — emotional, meme-driven, volatile |
| **The CEO** | Fortune 500 tech CEO — PR-focused, shareholder-obsessed |
| **The Crypto Maxi** | Bitcoin maximalist — anti-fiat, HODL mentality |
| **The Doomer** | Cynical bear — every event signals collapse |

### Red-Team Mode

Five corporate stakeholders stress-test a user-submitted strategy:

| Agent | Role |
|---|---|
| **The CFO** | Cash flow, ROI, cost-efficiency |
| **The Legal Officer** | GDPR, IP risk, regulatory compliance |
| **The Risk & Security Officer** | CISO — cybersecurity, architecture flaws |
| **The Competitor** | Hostile rival — undercuts and exploits weaknesses |
| **The Customer Advocate** | End-user voice — usability and pricing concerns |

---

## 📈 Market Engine

Every time an agent speaks, the backend computes a **price tick** based on:

- **Emotion Bias**: Maps emotions to directional pressure (e.g. `panicked → -3.0`, `bullish → +2.5`).
- **Influence Multiplier**: Each influence point (earned when named by another agent) adds 15% weight.
- **Noise**: A random ±15% factor keeps the simulation lively.
- **Debate Winner Spike**: When the Moderator declares a winner, a massive 500-influence price tick fires on their focused asset.

Three synthetic assets are tracked: **TECH**, **CRYPTO**, and **MACRO**, each starting at a base price of $100.

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Your Groq API key (required) |

---

## 📜 License

MIT
