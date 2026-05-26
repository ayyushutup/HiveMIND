from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import redis
import asyncio
import json
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
                await manager.broadcast(parsed)
            except Exception:
                pass
        await asyncio.sleep(0.1)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(redis_listener())

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

# ─── NEW: Sentiment & Memory Endpoints ────────────────────────────────────────

@app.get("/sentiment")
def get_sentiment():
    """
    Returns a live snapshot of all agents' emotional states, influence scores,
    and their last 10-step emotion timeline — used to populate the dashboard.
    """
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
            "timeline": timeline,  # [{emotion, intensity, time}, ...]
        })
    return result

@app.get("/agent_memory/{agent_name}")
def get_agent_memory(agent_name: str):
    """
    Returns the full episodic memory log for a specific agent.
    """
    mem_key = f"hivemind:memory:{agent_name}"
    raw_items = r.lrange(mem_key, 0, -1)
    memories = [json.loads(item) for item in raw_items]
    return {"agent": agent_name, "memories": memories}
