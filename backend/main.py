from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import redis
import asyncio
import json
import time
import random
import yfinance as yf
from . import db as history_db

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to Redis
r = redis.Redis(host='127.0.0.1', port=6379, decode_responses=True)

def get_agent_names():
    mode = r.get("hivemind:mode") or "macro"
    if mode == "red_team":
        return ["The CFO", "The Legal Officer", "The Risk & Security Officer", "The Competitor", "The Customer Advocate"]
    return ["The Regulator", "The Whale", "The Retail Mob", "The CEO", "The Crypto Maxi", "The Doomer"]

AGENT_NAMES = get_agent_names()

# ── Market engine constants ────────────────────────────────────────────────────
BASE_PRICE = 100.0
ASSETS = ["TECH", "CRYPTO", "MACRO"]
MAX_TICKS = 60

EMOTION_BIAS = {
    # Strongly bearish
    "panicked": -3.0, "angry": -2.8, "aggressive": -2.5, "terrified": -2.5,
    # Moderately bearish
    "paranoid": -1.5, "suspicious": -1.2,
    # Mildly bearish
    "cynical": -0.8, "pessimistic": -0.9, "skeptical": -0.6,
    # Neutral
    "neutral": 0.0,
    # Mildly bullish
    "calm": 0.2, "philosophical": 0.3, "peaceful": 0.2,
    # Moderately bullish
    "calculating": 0.8, "analytical": 0.9, "cold": 0.7,
    # Strongly bullish
    "bullish": 2.5, "euphoric": 2.8, "excited": 2.2,
}

def get_current_price(asset: str) -> float:
    val = r.get(f"hivemind:market:{asset}:price")
    return float(val) if val else BASE_PRICE

def compute_price_tick(agent_name: str, emotion: str, influence_score: int, asset: str) -> float:
    """Compute new price given agent emotion and influence, update Redis."""
    bias = EMOTION_BIAS.get(emotion.lower(), 0.0)
    # Influence multiplier: each influence point adds 15% weight
    multiplier = 1.0 + min(influence_score, 10) * 0.15
    noise = random.uniform(0.85, 1.15)
    delta = bias * multiplier * noise

    current = get_current_price(asset)
    new_price = max(0.1, current + delta)   # floor at 0.1

    # Persist new price
    r.set(f"hivemind:market:{asset}:price", new_price)

    # Add to bull/bear pressure accumulators
    if delta > 0:
        r.incrbyfloat(f"hivemind:market:{asset}:bull", delta)
    elif delta < 0:
        r.incrbyfloat(f"hivemind:market:{asset}:bear", abs(delta))

    # Record tick
    tick = {
        "price": round(new_price, 2),
        "time": time.strftime("%H:%M:%S"),
        "agent": agent_name,
        "emotion": emotion,
        "delta": round(delta, 2),
        "asset": asset
    }
    r.lpush(f"hivemind:market:{asset}:ticks", json.dumps(tick))
    r.ltrim(f"hivemind:market:{asset}:ticks", 0, MAX_TICKS - 1)

    # Record contributing event (last 5)
    event_entry = {
        "agent": agent_name,
        "emotion": emotion,
        "delta": round(delta, 2),
        "time": time.strftime("%H:%M:%S"),
        "asset": asset
    }
    r.lpush(f"hivemind:market:{asset}:events", json.dumps(event_entry))
    r.ltrim(f"hivemind:market:{asset}:events", 0, 4)

    return new_price, delta

def execute_trade(agent_name: str, emotion: str, current_price: float, asset: str):
    """Execute a trade for an agent based on their sentiment."""
    emotion = emotion.lower()
    action_type = "hold"
    pct = 0.0

    if emotion in ["bullish", "euphoric", "excited"]:
        action_type = "buy"
        pct = 0.25
    elif emotion in ["calculating", "analytical", "cold", "calm", "philosophical", "peaceful"]:
        action_type = "buy"
        pct = 0.10
    elif emotion in ["panicked", "angry", "aggressive", "terrified"]:
        action_type = "sell"
        pct = 0.50
    elif emotion in ["paranoid", "suspicious", "cynical", "pessimistic", "skeptical"]:
        action_type = "sell"
        pct = 0.25

    if action_type == "hold":
        return

    port_key = f"hivemind:portfolio:{agent_name}"
    
    # Initialize if missing
    if not r.exists(port_key):
        r.hset(port_key, mapping={"cash": 100000.0, "position_TECH": 0.0, "position_CRYPTO": 0.0, "position_MACRO": 0.0})
        
    cash = float(r.hget(port_key, "cash") or 100000.0)
    pos_key = f"position_{asset}"
    position = float(r.hget(port_key, pos_key) or 0.0)

    if action_type == "buy" and cash > 0:
        spend = cash * pct
        units = spend / current_price
        r.hset(port_key, mapping={"cash": cash - spend, pos_key: position + units})
    elif action_type == "sell" and position > 0:
        sell_units = position * pct
        revenue = sell_units * current_price
        r.hset(port_key, mapping={"cash": cash + revenue, pos_key: position - sell_units})

def reset_market():
    """Reset market to base price on new world event."""
    for asset in ASSETS:
        r.set(f"hivemind:market:{asset}:price", BASE_PRICE)
        r.delete(f"hivemind:market:{asset}:ticks")
        r.delete(f"hivemind:market:{asset}:events")
        r.set(f"hivemind:market:{asset}:bull", 0)
        r.set(f"hivemind:market:{asset}:bear", 0)
        # Seed with the opening tick
        tick = {"price": BASE_PRICE, "time": time.strftime("%H:%M:%S"), "agent": "System", "emotion": "neutral", "delta": 0, "asset": asset}
        r.lpush(f"hivemind:market:{asset}:ticks", json.dumps(tick))


# ── Autopilot Engine ───────────────────────────────────────────────────────────

WORLD_EVENTS_POOL = [
    # 🏦 Central Bank
    "The Federal Reserve announces a surprise 75 basis point emergency rate cut, citing systemic risk in the banking sector.",
    "The European Central Bank pauses quantitative tightening indefinitely as Eurozone growth collapses.",
    "The Bank of Japan abandons yield curve control, sending yen soaring 8% in minutes.",
    "The Fed signals three consecutive rate hikes are coming, citing sticky core inflation above 5%.",
    "A major central bank secretly sold 500 tonnes of gold reserves — leaked documents confirm.",

    # 💥 Crisis
    "Breaking: A top-5 US commercial bank has halted withdrawals following a silent bank run overnight.",
    "Credit Suisse 2.0: A major European lender triggers emergency ECB intervention as CDS spreads explode.",
    "US Treasury 30-year yield inverts below 2-year for the first time since 2008 — recession probability hits 94%.",
    "A cyber attack on SWIFT disables cross-border payments for 47 banks across 12 countries.",
    "A pension fund managing $2 trillion liquidates all equities in an emergency move to cover margin calls.",

    # 🚀 Tech / AI
    "NVIDIA unveils a new chip 10x faster than H100 — AI infrastructure stocks rocket 30% pre-market.",
    "OpenAI announces AGI has been achieved internally. Stock markets suspended for 30 minutes to absorb the news.",
    "The EU AI Act passes — all LLM providers must halt European operations within 90 days.",
    "A major cloud provider suffers a 12-hour global outage, wiping $400B in market cap across tech.",
    "Apple announces a $500 billion stock buyback — largest in corporate history.",

    # 🌍 Geopolitical
    "China begins a naval blockade of Taiwan. US carrier groups are repositioning in the Pacific.",
    "Russia cuts off all remaining natural gas supplies to Europe effective immediately.",
    "OPEC+ announces an emergency 3 million barrel per day production cut, oil spikes to $180.",
    "North Korea conducts a nuclear test. Japan and South Korea declare national emergencies.",
    "A major Middle East nation seizes $300B in foreign assets — diplomatic crisis erupts.",

    # 🪙 Crypto
    "Bitcoin ETF approved in all G20 nations simultaneously — BTC rockets past $250,000.",
    "The US SEC charges Binance with fraud, freezes all US customer assets pending investigation.",
    "A critical zero-day exploit drains $8 billion from Ethereum smart contracts — DeFi collapses.",
    "El Salvador declares Bitcoin legal tender and backs it with its entire foreign reserve.",
    "Tether reveals its reserves are only 40% backed — USDT depegs to $0.61 within hours.",

    # 📊 Macro Data Shocks
    "US CPI prints at 12.4% year-over-year — the highest reading since 1947. Markets in freefall.",
    "US unemployment hits 11.2% in a single month — the largest single-month jump ever recorded.",
    "China GDP contracts 6% Q-o-Q. Global supply chains begin seizing up within hours.",
    "US national debt officially crosses $50 trillion. Moody's downgrades US credit to junk.",
    "Global trade volumes collapse 22% in a single quarter — worse than 2008 financial crisis.",
]

# Autopilot runtime state (in-memory, reset on server restart)
autopilot_state = {
    "running": False,
    "interval": 60,          # seconds between events
    "next_fire_at": 0.0,     # unix timestamp
    "last_event": "",
    "task": None,            # asyncio.Task handle
    "pool_index": [],        # shuffled indices to avoid repeats
    "dynamic": False,        # whether to use LLM for events
}

# ── History session state ─────────────────────────────────────────────────────
# Tracks the active SQLite session across the async Redis listener.
_active_session_id: int | None = None

async def autopilot_loop():
    """Async loop that fires world events at the configured interval."""
    print("[Autopilot] Loop started.")
    # Shuffle pool on start
    indices = list(range(len(WORLD_EVENTS_POOL)))
    random.shuffle(indices)
    pool_cursor = 0
    first_run = True

    while autopilot_state["running"]:
        interval = autopilot_state["interval"]
        if first_run:
            fire_at = time.time() + 3
            first_run = False
        else:
            fire_at = time.time() + interval
            
        autopilot_state["next_fire_at"] = fire_at

        # Broadcast countdown start so frontend ring can sync
        await manager.broadcast({
            "type": "autopilot_tick",
            "running": True,
            "interval": interval,
            "next_fire_at": fire_at,
            "last_event": autopilot_state["last_event"],
        })

        # Wait until fire time (check every second so stop is responsive)
        while time.time() < fire_at:
            if not autopilot_state["running"]:
                print("[Autopilot] Stopped mid-countdown.")
                return
            await asyncio.sleep(1)

        if not autopilot_state["running"]:
            return

        # Pick next event (cycle through shuffled pool without repeats)
        if autopilot_state.get("dynamic", False):
            try:
                import sys
                import os
                if ".." not in sys.path:
                    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
                from agent import Agent
                generator = Agent("System", "You are an AI simulating global macroeconomic events.")
                prompt = (
                    f"The current market prices are: TECH {get_current_price('TECH'):.2f}, "
                    f"CRYPTO {get_current_price('CRYPTO'):.2f}, MACRO {get_current_price('MACRO'):.2f}. "
                    "Generate a single, bold, unexpected world event that would shock the markets. "
                    "Do not include any pleasantries, just the event text."
                )
                event_text = await asyncio.to_thread(generator.think, prompt)
                event_text = event_text.strip().replace('"', '')
            except Exception as e:
                print(f"[Autopilot] LLM Generation failed: {e}")
                if pool_cursor >= len(indices):
                    random.shuffle(indices)
                    pool_cursor = 0
                event_text = WORLD_EVENTS_POOL[indices[pool_cursor]]
                pool_cursor += 1
        else:
            if pool_cursor >= len(indices):
                random.shuffle(indices)
                pool_cursor = 0
            event_text = WORLD_EVENTS_POOL[indices[pool_cursor]]
            pool_cursor += 1

        autopilot_state["last_event"] = event_text
        print(f"[Autopilot] Firing: {event_text[:60]}...")

        event_payload = {
            "type": "world_event",
            "content": event_text,
            "sender": "Autopilot",
        }
        r.publish('hivemind.events', json.dumps(event_payload))

        # Notify frontend that event just fired
        await manager.broadcast({
            "type": "autopilot_fired",
            "event": event_text,
            "interval": autopilot_state["interval"],
        })

    print("[Autopilot] Loop ended.")



# ── WebSocket Manager ──────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def redis_listener():
    global _active_session_id
    pubsub = r.pubsub()
    pubsub.subscribe('hivemind.events')
    print("FastAPI Backend listening to Redis 'hivemind.events'...")
    while True:
        message = pubsub.get_message(ignore_subscribe_messages=True)
        if message and message['type'] == 'message':
            data = message['data']
            try:
                parsed = json.loads(data)

                # ── Market engine hooks ────────────────────────────────────
                if parsed.get("type") == "world_event":
                    reset_market()
                    market_reset_event = {
                        "type": "market_reset",
                        "price": BASE_PRICE,
                        "time": time.strftime("%H:%M:%S"),
                    }
                    await manager.broadcast(market_reset_event)

                    # ── History hook 1: open a new session ────────────────
                    mode = r.get("hivemind:mode") or "macro"
                    _active_session_id = await asyncio.to_thread(
                        history_db.start_session,
                        parsed.get("content", ""),
                        mode,
                    )
                    # ──────────────────────────────────────────────────────

                elif parsed.get("type") == "agent_speech":
                    # ── History hook 2: persist each speech ───────────────
                    if _active_session_id is not None:
                        await asyncio.to_thread(
                            history_db.record_speech,
                            _active_session_id,
                            parsed.get("sender", ""),
                            parsed.get("content", ""),
                            parsed.get("thought", ""),
                            parsed.get("emotion", "neutral"),
                            parsed.get("asset_focus", "MACRO"),
                        )
                    # ──────────────────────────────────────────────────────

                elif parsed.get("type") == "sentiment_update":
                    agent_name = parsed.get("agent", "")
                    emotion    = parsed.get("emotion", "neutral")
                    influence  = int(parsed.get("influence_score", 0))
                    asset_focus = parsed.get("asset_focus", "MACRO")
                    if asset_focus not in ASSETS:
                        asset_focus = "MACRO"
                        
                    new_price, delta = compute_price_tick(agent_name, emotion, influence, asset_focus)

                    # Execute trade at the new price
                    execute_trade(agent_name, emotion, new_price, asset_focus)

                    market_tick_event = {
                        "type": "market_tick",
                        "price": round(new_price, 2),
                        "delta": round(delta, 2),
                        "agent": agent_name,
                        "emotion": emotion,
                        "asset": asset_focus,
                        "time": time.strftime("%H:%M:%S"),
                    }
                    await manager.broadcast(market_tick_event)

                elif parsed.get("type") == "debate_conclusion":
                    winner = parsed.get("winner", "")
                    sentiment = parsed.get("sentiment", "neutral")
                    asset = parsed.get("asset", "MACRO")
                    if asset not in ASSETS:
                        asset = "MACRO"
                        
                    if winner and winner != "No One":
                        sent_key = f"hivemind:sentiment:{winner}"
                        if r.exists(sent_key):
                            # Massive influence boost for winning the debate
                            r.hincrby(sent_key, "influence_score", 50)
                            
                        # Trigger a massive market tick based on their sentiment
                        # We use 500 influence just to guarantee a big move
                        new_price, delta = compute_price_tick(winner, sentiment, 500, asset)
                        execute_trade(winner, sentiment, new_price, asset)
                        
                        market_tick_event = {
                            "type": "market_tick",
                            "price": round(new_price, 2),
                            "delta": round(delta, 2),
                            "agent": winner,
                            "emotion": sentiment,
                            "asset": asset,
                            "time": time.strftime("%H:%M:%S"),
                        }
                        await manager.broadcast(market_tick_event)

                    # ── History hook 3: close the session ─────────────────
                    if _active_session_id is not None:
                        market_final = {
                            a: {
                                "price": get_current_price(a),
                                "pct_change": round(
                                    ((get_current_price(a) - BASE_PRICE) / BASE_PRICE) * 100, 2
                                ),
                            }
                            for a in ASSETS
                        }
                        agent_final = get_sentiment()
                        closed_id = _active_session_id
                        _active_session_id = None
                        await asyncio.to_thread(
                            history_db.end_session,
                            closed_id,
                            winner if winner and winner != "No One" else None,
                            market_final,
                            agent_final,
                        )
                    # ──────────────────────────────────────────────────────

                # ─────────────────────────────────────────────────────────

                await manager.broadcast(parsed)

            except Exception as exc:
                import traceback
                traceback.print_exc()
        await asyncio.sleep(0.1)

@app.on_event("startup")
async def startup_event():
    history_db.init_db()
    asyncio.create_task(redis_listener())

# ── Existing endpoints ────────────────────────────────────────────────────────

@app.post("/inject_seed")
async def inject_seed(payload: dict):
    seed = payload.get("seed", "")
    event = {
        "type": "world_event",
        "content": seed,
        "sender": "God-Mode"
    }
    r.publish('hivemind.events', json.dumps(event))
    return {"status": "success", "event": event}

@app.post("/update_config")
async def update_config(payload: dict):
    event = {
        "type": "system_config",
        "config": payload,
        "sender": "System"
    }
    r.publish('hivemind.events', json.dumps(event))
    return {"status": "success", "event": event}

@app.post("/set_mode")
async def set_mode(payload: dict):
    mode = payload.get("mode", "macro")
    r.set("hivemind:mode", mode)
    event = {
        "type": "system_config",
        "config": {"mode": mode},
        "sender": "System"
    }
    r.publish('hivemind.events', json.dumps(event))
    return {"status": "success", "mode": mode}

@app.get("/personas")
def get_personas():
    mode = r.get("hivemind:mode") or "macro"
    if mode == "red_team":
        try:
            with open("agents/red_team_personas.json", "r") as f:
                return json.load(f)
        except Exception:
            pass
    try:
        with open("agents/personas.json", "r") as f:
            return json.load(f)
    except Exception:
        return []

@app.post("/inject_strategy")
async def inject_strategy(payload: dict):
    strategy = payload.get("strategy", "")
    event = {
        "type": "world_event",
        "content": f"[STRATEGY PROPOSAL]: {strategy}",
        "sender": "User-RedTeam"
    }
    r.publish('hivemind.events', json.dumps(event))
    return {"status": "success", "event": event}

@app.get("/node_info/{node_id}")
def get_node_info(node_id: str):
    ticker_map = {
        "Bitcoin": "BTC-USD",
        "Ethereum": "ETH-USD",
        "S&P 500": "^GSPC",
        "TechCorp": "AAPL",
        "MacroBank": "JPM",
        "CryptoExchange": "COIN",
        "RetailChain": "WMT",
        "Semiconductor Co": "NVDA",
        "Real Estate Trust": "AMT",
        "Energy Giant": "XOM",
        "Social Media Inc": "META"
    }
    if node_id in ticker_map:
        ticker_symbol = ticker_map[node_id]
        try:
            ticker = yf.Ticker(ticker_symbol)
            info = ticker.info
            price = info.get("currentPrice", info.get("regularMarketPrice", "N/A"))
            market_cap = info.get("marketCap", "N/A")
            if market_cap != "N/A":
                market_cap = f"${market_cap / 1e9:.2f}B"
            summary = info.get("longBusinessSummary", "No summary available.")
            if len(summary) > 250:
                summary = summary[:247] + "..."
            return {
                "id": node_id,
                "realTicker": ticker_symbol,
                "price": f"${price}" if price != "N/A" else "N/A",
                "marketCap": market_cap,
                "summary": summary
            }
        except Exception as e:
            return {"id": node_id, "summary": f"Failed to fetch live data: {str(e)}"}
    return {"id": node_id, "summary": "This is a structural market node. No live ticker mapped."}

# ── Sentiment endpoints ───────────────────────────────────────────────────────

@app.get("/sentiment")
def get_sentiment():
    result = []
    
    for name in get_agent_names():
        sent_key = f"hivemind:sentiment:{name}"
        timeline_key = f"hivemind:timeline:{name}"
        port_key = f"hivemind:portfolio:{name}"
        
        state = r.hgetall(sent_key)
        raw_timeline = r.lrange(timeline_key, 0, 9)
        timeline = [json.loads(t) for t in raw_timeline]
        
        # Portfolio
        if not r.exists(port_key):
            r.hset(port_key, mapping={"cash": 100000.0, "position_TECH": 0.0, "position_CRYPTO": 0.0, "position_MACRO": 0.0})
        cash = float(r.hget(port_key, "cash") or 100000.0)
        
        positions = {}
        total_value = cash
        for asset in ASSETS:
            pos = float(r.hget(port_key, f"position_{asset}") or 0.0)
            positions[asset] = pos
            total_value += pos * get_current_price(asset)
            
        pnl = total_value - 100000.0
        
        result.append({
            "name": name,
            "current_emotion": state.get("current_emotion", "idle"),
            "intensity": float(state.get("intensity", 0.0)),
            "influence_score": int(state.get("influence_score", 0)),
            "last_updated": state.get("last_updated", "--:--:--"),
            "timeline": timeline,
            "portfolio": {
                "cash": cash,
                "positions": positions,
                "total_value": total_value,
                "pnl": pnl
            }
        })
    return result

@app.get("/agent_memory/{agent_name}")
def get_agent_memory(agent_name: str):
    mem_key = f"hivemind:memory:{agent_name}"
    raw_items = r.lrange(mem_key, 0, -1)
    memories = [json.loads(item) for item in raw_items]
    return {"agent": agent_name, "memories": memories}

# ── Market state endpoint ─────────────────────────────────────────────────────

@app.get("/market_state")
def get_market_state():
    states = {}
    for asset in ASSETS:
        current_price = get_current_price(asset)
        pct_change = ((current_price - BASE_PRICE) / BASE_PRICE) * 100
        raw_ticks  = r.lrange(f"hivemind:market:{asset}:ticks", 0, MAX_TICKS - 1)
        raw_events = r.lrange(f"hivemind:market:{asset}:events", 0, 4)
        ticks  = [json.loads(t) for t in raw_ticks]
        events = [json.loads(e) for e in raw_events]
        ticks_chrono = list(reversed(ticks))
        bull = float(r.get(f"hivemind:market:{asset}:bull") or 0)
        bear = float(r.get(f"hivemind:market:{asset}:bear") or 0)
        states[asset] = {
            "current_price": round(current_price, 2),
            "base_price": BASE_PRICE,
            "pct_change": round(pct_change, 2),
            "bull_pressure": round(bull, 2),
            "bear_pressure": round(bear, 2),
            "ticks": ticks_chrono,
            "recent_events": events,
        }
    return states

# ── Autopilot endpoints ───────────────────────────────────────────────────────

@app.post("/autopilot/start")
async def autopilot_start(payload: dict):
    interval = int(payload.get("interval_seconds", 60))
    interval = max(10, min(interval, 300))   # clamp 10s–5min

    autopilot_state["interval"] = interval
    autopilot_state["running"]  = True
    autopilot_state["dynamic"]  = payload.get("dynamic", False)

    # Cancel any existing task before creating a new one
    if autopilot_state["task"] and not autopilot_state["task"].done():
        autopilot_state["task"].cancel()

    autopilot_state["task"] = asyncio.create_task(autopilot_loop())
    return {"status": "started", "interval": interval}

@app.post("/autopilot/stop")
async def autopilot_stop():
    autopilot_state["running"] = False
    if autopilot_state["task"] and not autopilot_state["task"].done():
        autopilot_state["task"].cancel()
    autopilot_state["next_fire_at"] = 0.0

    await manager.broadcast({
        "type": "autopilot_tick",
        "running": False,
        "interval": autopilot_state["interval"],
        "next_fire_at": 0,
        "last_event": autopilot_state["last_event"],
    })
    return {"status": "stopped"}

@app.get("/autopilot/status")
def autopilot_status():
    now = time.time()
    seconds_remaining = max(0, round(autopilot_state["next_fire_at"] - now))
    return {
        "running": autopilot_state["running"],
        "interval": autopilot_state["interval"],
        "seconds_remaining": seconds_remaining,
        "next_fire_at": autopilot_state["next_fire_at"],
        "last_event": autopilot_state["last_event"],
        "dynamic": autopilot_state.get("dynamic", False),
        "mode": r.get("hivemind:mode") or "macro",
    }

@app.get("/network_graph")
def network_graph():
    nodes = []
    links = []
    
    nodes.append({"id": "God-Mode", "name": "MACRO EVENT", "type": "System", "group": 0, "val": 6})
    
    for name in get_agent_names():
        sent_key = f"hivemind:sentiment:{name}"
        influence = int(r.hget(sent_key, "influence_score") or 0)
        nodes.append({"id": name, "name": name, "type": "Person", "group": 1, "val": 4 + (influence * 0.5)})
        links.append({"source": "God-Mode", "target": name})

    companies = ['TechCorp', 'MacroBank', 'CryptoExchange', 'HedgeFundX', 'GovtTreasury']
    for c in companies:
        nodes.append({"id": c, "name": c, "type": "Company", "group": 2, "val": 2})
        links.append({"source": random.choice(get_agent_names()), "target": c})

    return {"nodes": nodes, "links": links}


# ── History endpoints ──────────────────────────────────────────────────────────

@app.get("/history")
def list_history(limit: int = 50):
    """
    Return a paginated list of past debate sessions, most recent first.

    Query params:
        limit (int): Max sessions to return (default 50, max 200).
    """
    limit = max(1, min(limit, 200))
    sessions = history_db.get_sessions(limit=limit)
    return sessions


@app.get("/history/{session_id}")
def get_history_session(session_id: int):
    """
    Return full replay data for a single debate session.

    Returns 404 if the session_id does not exist.
    """
    detail = history_db.get_session_detail(session_id)
    if detail is None:
        return JSONResponse(status_code=404, content={"error": f"Session {session_id} not found"})
    return detail
