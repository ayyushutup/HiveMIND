import redis
import json
import threading
import time
import random
from swarm_agent import NativeGroqAgent, LangChainAgent, _redis_client
from moderator import Moderator

r = redis.Redis(host='127.0.0.1', port=6379, decode_responses=True)

# Global State
swarm_state = {"silenced": False}

# Load personas
with open("agents/personas.json", "r") as f:
    macro_personas = json.load(f)

with open("agents/red_team_personas.json", "r") as f:
    red_team_personas = json.load(f)

macro_names = [p["name"] for p in macro_personas]
red_team_names = [p["name"] for p in red_team_personas]

agents = []
for p in macro_personas + red_team_personas:
    if p.get("framework") == "langchain":
        agents.append(LangChainAgent(p["name"], p["role_description"]))
    else:
        agents.append(NativeGroqAgent(p["name"], p["role_description"]))

def listen_and_react(agent):
    pubsub = r.pubsub()
    pubsub.subscribe('hivemind.events')
    print(f"[Swarm] {agent.name} is online in the Cyberpunk Sandbox.")
    
    agent_history = []
    
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
                
            active_mode = r.get("hivemind:mode") or "macro"
            if active_mode == "red_team":
                if agent.name not in red_team_names:
                    continue
            else:
                if agent.name not in macro_names:
                    continue
                
            # Manage history
            if data.get("type") in ["world_event", "agent_speech"]:
                agent_history.append(data)
                if len(agent_history) > 6:
                    agent_history.pop(0)

            # Don't react to our own messages or system commands
            if data.get("sender") == agent.name or data.get("type") == "system_command":
                continue
                
            # Wait a tiny bit to stagger agent responses
            time.sleep(random.uniform(0.5, 3.0))
            
            # Check silenced again after waiting, just in case
            if swarm_state["silenced"]:
                continue
                
            try:
                # Format history for prompt
                history_str = "\n".join([f"[{m.get('sender', 'World')}]: {m.get('content', '')}" for m in agent_history])
                if active_mode == "red_team":
                    prompt = (
                        f"Recent discussion on the strategy:\n{history_str}\n\n"
                        "You must now evaluate the proposed strategy from the perspective of your role. Remember your corporate persona. "
                        "Identify risks, flaws, or operational/cost/legal issues, or advocate for it if it benefits your area. "
                        "CRITICAL DEBATE RULE: You must call out other stakeholders by name, build on their points if you agree, or directly challenge their logic if you disagree. "
                        "Make this a sharp, professional corporate red-teaming debate!"
                    )
                else:
                    prompt = (
                        f"Recent events:\n{history_str}\n\n"
                        "You must now respond to the situation. Remember your persona. "
                        "CRITICAL DEBATE RULE: If another agent has spoken and you disagree with their perspective, you MUST call them out by name and directly rebut their logic. "
                        "If you agree with them, mention them by name and build upon their argument. Make this a structured, fiery debate!"
                    )
                
                raw_response = agent.think(prompt)
                parsed_response = json.loads(raw_response)
                
                speech = parsed_response.get("speech", "")
                emotion = parsed_response.get("emotion", "neutral")
                asset_focus = parsed_response.get("asset_focus", "MACRO")

                if speech != "SILENT":
                    # --- Persist memory and update sentiment ---
                    trigger_summary = data.get('content', '')[:200]
                    agent.update_memory(trigger=trigger_summary, speech=speech, emotion=emotion, asset_focus=asset_focus)

                    # --- Influence scoring: check if this speech mentions another agent ---
                    for other_agent in agents:
                        if other_agent.name != agent.name and other_agent.name.lower() in speech.lower():
                            other_agent.increment_influence()

                    # --- Broadcast response back to the bus ---
                    event = {
                        "type": "agent_speech",
                        "sender": agent.name,
                        "content": speech,
                        "thought": parsed_response.get("thought", ""),
                        "emotion": emotion,
                        "asset_focus": asset_focus
                    }
                    r.publish('hivemind.events', json.dumps(event))

                    # --- Broadcast live sentiment update for the dashboard ---
                    sent_key = f"hivemind:sentiment:{agent.name}"
                    influence = int(_redis_client.hget(sent_key, 'influence_score') or 0)
                    sentiment_event = {
                        "type": "sentiment_update",
                        "agent": agent.name,
                        "emotion": emotion,
                        "influence_score": influence,
                        "asset_focus": asset_focus
                    }
                    r.publish('hivemind.events', json.dumps(sentiment_event))
            except Exception as e:
                print(f"[Error] {agent.name} failed to process: {e}")

# Start all agents in separate threads
threads = []
for agent in agents:
    t = threading.Thread(target=listen_and_react, args=(agent,))
    t.daemon = True
    t.start()
    threads.append(t)

# Start Moderator
mod = Moderator(max_rounds=12) # Allow 12 messages before cutting them off
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
