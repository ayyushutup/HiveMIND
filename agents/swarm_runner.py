import redis
import json
import threading
import time
from agent import Agent
from moderator import Moderator

r = redis.Redis(host='127.0.0.1', port=6379, decode_responses=True)

# Global State
swarm_state = {"silenced": False}

# Load personas
with open("agents/personas.json", "r") as f:
    persona_data = json.load(f)

agents = []
for p in persona_data:
    agents.append(Agent(p["name"], p["role_description"]))

def listen_and_react(agent):
    pubsub = r.pubsub()
    pubsub.subscribe('hivemind.events')
    print(f"[Swarm] {agent.name} is online in the Cyberpunk Sandbox.")
    
    for message in pubsub.listen():
        if message['type'] == 'message':
            data = json.loads(message['data'])
            
            # Handle state commands
            if data.get("type") == "world_event":
                swarm_state["silenced"] = False
            elif data.get("type") == "system_command" and data.get("action") == "silence":
                swarm_state["silenced"] = True
                
            # If silenced, do not process new thoughts
            if swarm_state["silenced"]:
                continue
                
            # Don't react to our own messages or system commands
            if data.get("sender") == agent.name or data.get("type") == "system_command":
                continue
                
            incoming_content = data.get("content", "")
            sender = data.get("sender", "World")
            
            # Wait a tiny bit to stagger agent responses
            time.sleep(1)
            
            # Check silenced again after waiting, just in case
            if swarm_state["silenced"]:
                continue
                
            try:
                raw_response = agent.think(f"[{sender}] just said/did: {incoming_content}. React to this.")
                parsed_response = json.loads(raw_response)
                
                # Broadcast response back to the bus
                event = {
                    "type": "agent_speech",
                    "sender": agent.name,
                    "content": parsed_response.get("speech", ""),
                    "thought": parsed_response.get("thought", ""),
                    "emotion": parsed_response.get("emotion", "neutral")
                }
                r.publish('hivemind.events', json.dumps(event))
            except Exception as e:
                print(f"[Error] {agent.name} failed to process.")

# Start all agents in separate threads
threads = []
for agent in agents:
    t = threading.Thread(target=listen_and_react, args=(agent,))
    t.daemon = True
    t.start()
    threads.append(t)

# Start Moderator
mod = Moderator(max_rounds=6) # Allow 6 messages before cutting them off
mod_thread = threading.Thread(target=mod.listen)
mod_thread.daemon = True
mod_thread.start()
threads.append(mod_thread)

print("\n--- Cyberpunk Swarm Engine Running ---")
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Shutting down swarm.")
