from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import redis
import asyncio
import json

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
            except Exception as e:
                pass

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keeping the connection alive
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
            except Exception as e:
                pass
        await asyncio.sleep(0.1)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(redis_listener())

@app.post("/inject_seed")
async def inject_seed(payload: dict):
    # The frontend calls this to act as God and inject a world event
    seed = payload.get("seed", "")
    event = {
        "type": "world_event",
        "content": seed,
        "sender": "God-Mode"
    }
    r.publish('hivemind.events', json.dumps(event))
    return {"status": "success", "event": event}
