from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import redis
import asyncio
import json
import time
import random
import yfinance as yf

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

AGENT_NAMES = [
    "The Regulator", "The Whale", "The Retail Mob",
    "The CEO", "The Crypto Maxi", "The Doomer"
]

# ── Market engine constants ────────────────────────────────────────────────────
BASE_PRICE = 100.0
MARKET_PRICE_KEY = "hivemind:market:price"
MARKET_TICKS_KEY = "hivemind:market:ticks"       # list of tick JSON objects
MARKET_EVENTS_KEY = "hivemind:market:events"     # last 5 contributing events
MARKET_BULL_KEY   = "hivemind:market:bull"       # running bull pressure sum
MARKET_BEAR_KEY   = "hivemind:market:bear"       # running bear pressure sum
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

def get_current_price() -> float:
    val = r.get(MARKET_PRICE_KEY)
    return float(val) if val else BASE_PRICE

def compute_price_tick(agent_name: str, emotion: str, influence_score: int) -> float:
    """Compute new price given agent emotion and influence, update Redis."""
    bias = EMOTION_BIAS.get(emotion.lower(), 0.0)
    # Influence multiplier: each influence point adds 15% weight
    multiplier = 1.0 + min(influence_score, 10) * 0.15
    noise = random.uniform(0.85, 1.15)
    delta = bias * multiplier * noise

    current = get_current_price()
    new_price = max(0.1, current + delta)   # floor at 0.1

    # Persist new price
    r.set(MARKET_PRICE_KEY, new_price)

    # Add to bull/bear pressure accumulators
    if delta > 0:
        r.incrbyfloat(MARKET_BULL_KEY, delta)
    elif delta < 0:
        r.incrbyfloat(MARKET_BEAR_KEY, abs(delta))

    # Record tick
    tick = {
        "price": round(new_price, 2),
        "time": time.strftime("%H:%M:%S"),
        "agent": agent_name,
        "emotion": emotion,
        "delta": round(delta, 2),
    }
    r.lpush(MARKET_TICKS_KEY, json.dumps(tick))
    r.ltrim(MARKET_TICKS_KEY, 0, MAX_TICKS - 1)

    # Record contributing event (last 5)
    event_entry = {
        "agent": agent_name,
        "emotion": emotion,
        "delta": round(delta, 2),
        "time": time.strftime("%H:%M:%S"),
    }
    r.lpush(MARKET_EVENTS_KEY, json.dumps(event_entry))
    r.ltrim(MARKET_EVENTS_KEY, 0, 4)

    return new_price, delta

def execute_trade(agent_name: str, emotion: str, current_price: float):
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
        r.hset(port_key, mapping={"cash": 100000.0, "position": 0.0})
        
    cash = float(r.hget(port_key, "cash") or 100000.0)
    position = float(r.hget(port_key, "position") or 0.0)

    if action_type == "buy" and cash > 0:
        spend = cash * pct
        units = spend / current_price
        r.hset(port_key, mapping={"cash": cash - spend, "position": position + units})
    elif action_type == "sell" and position > 0:
        sell_units = position * pct
        revenue = sell_units * current_price
        r.hset(port_key, mapping={"cash": cash + revenue, "position": position - sell_units})

def reset_market():
    """Reset market to base price on new world event."""
    r.set(MARKET_PRICE_KEY, BASE_PRICE)
    r.delete(MARKET_TICKS_KEY)
    r.delete(MARKET_EVENTS_KEY)
    r.set(MARKET_BULL_KEY, 0)
    r.set(MARKET_BEAR_KEY, 0)
    # Seed with the opening tick
    tick = {"price": BASE_PRICE, "time": time.strftime("%H:%M:%S"), "agent": "System", "emotion": "neutral", "delta": 0}
    r.lpush(MARKET_TICKS_KEY, json.dumps(tick))


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
}

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

                elif parsed.get("type") == "sentiment_update":
                    agent_name = parsed.get("agent", "")
                    emotion    = parsed.get("emotion", "neutral")
                    influence  = int(parsed.get("influence_score", 0))
                    new_price, delta = compute_price_tick(agent_name, emotion, influence)

                    # Execute trade at the new price
                    execute_trade(agent_name, emotion, new_price)

                    market_tick_event = {
                        "type": "market_tick",
                        "price": round(new_price, 2),
                        "delta": round(delta, 2),
                        "agent": agent_name,
                        "emotion": emotion,
                        "time": time.strftime("%H:%M:%S"),
                    }
                    await manager.broadcast(market_tick_event)
                # ─────────────────────────────────────────────────────────

                await manager.broadcast(parsed)

            except Exception:
                pass
        await asyncio.sleep(0.1)

@app.on_event("startup")
async def startup_event():
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
    current_price = get_current_price()
    
    for name in AGENT_NAMES:
        sent_key = f"hivemind:sentiment:{name}"
        timeline_key = f"hivemind:timeline:{name}"
        port_key = f"hivemind:portfolio:{name}"
        
        state = r.hgetall(sent_key)
        raw_timeline = r.lrange(timeline_key, 0, 9)
        timeline = [json.loads(t) for t in raw_timeline]
        
        # Portfolio
        if not r.exists(port_key):
            r.hset(port_key, mapping={"cash": 100000.0, "position": 0.0})
        cash = float(r.hget(port_key, "cash") or 100000.0)
        position = float(r.hget(port_key, "position") or 0.0)
        total_value = cash + (position * current_price)
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
                "position": position,
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
    current_price = get_current_price()
    pct_change = ((current_price - BASE_PRICE) / BASE_PRICE) * 100
    raw_ticks  = r.lrange(MARKET_TICKS_KEY, 0, MAX_TICKS - 1)
    raw_events = r.lrange(MARKET_EVENTS_KEY, 0, 4)
    ticks  = [json.loads(t) for t in raw_ticks]
    events = [json.loads(e) for e in raw_events]
    ticks_chrono = list(reversed(ticks))
    bull = float(r.get(MARKET_BULL_KEY) or 0)
    bear = float(r.get(MARKET_BEAR_KEY) or 0)
    return {
        "current_price": round(current_price, 2),
        "base_price": BASE_PRICE,
        "pct_change": round(pct_change, 2),
        "bull_pressure": round(bull, 2),
        "bear_pressure": round(bear, 2),
        "ticks": ticks_chrono,
        "recent_events": events,
    }

# ── Autopilot endpoints ───────────────────────────────────────────────────────

@app.post("/autopilot/start")
async def autopilot_start(payload: dict):
    interval = int(payload.get("interval_seconds", 60))
    interval = max(15, min(interval, 300))   # clamp 15s–5min

    autopilot_state["interval"] = interval
    autopilot_state["running"]  = True

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
    }
