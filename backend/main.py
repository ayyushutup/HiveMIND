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

    return new_price

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
                    new_price  = compute_price_tick(agent_name, emotion, influence)

                    market_tick_event = {
                        "type": "market_tick",
                        "price": round(new_price, 2),
                        "delta": round(new_price - get_current_price(), 2),
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
    for name in AGENT_NAMES:
        sent_key = f"hivemind:sentiment:{name}"
        timeline_key = f"hivemind:timeline:{name}"
        state = r.hgetall(sent_key)
        raw_timeline = r.lrange(timeline_key, 0, 9)
        timeline = [json.loads(t) for t in raw_timeline]
        result.append({
            "name": name,
            "current_emotion": state.get("current_emotion", "idle"),
            "intensity": float(state.get("intensity", 0.0)),
            "influence_score": int(state.get("influence_score", 0)),
            "last_updated": state.get("last_updated", "--:--:--"),
            "timeline": timeline,
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
    """
    Returns current simulated market price, % change from base,
    bull/bear pressure totals, last 5 contributing events, and
    full tick history (newest first).
    """
    current_price = get_current_price()
    pct_change = ((current_price - BASE_PRICE) / BASE_PRICE) * 100

    raw_ticks  = r.lrange(MARKET_TICKS_KEY, 0, MAX_TICKS - 1)
    raw_events = r.lrange(MARKET_EVENTS_KEY, 0, 4)

    ticks  = [json.loads(t) for t in raw_ticks]
    events = [json.loads(e) for e in raw_events]

    # Ticks are newest-first from Redis; reverse for chronological chart display
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
