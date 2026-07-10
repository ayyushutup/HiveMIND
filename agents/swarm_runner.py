"""
swarm_runner.py — HiveMind Swarm Orchestration
================================================
Entry point for the multi-agent swarm. Spawns one daemon thread per agent
persona and one additional thread for the Moderator, all connected to the
shared Redis Pub/Sub channel `hivemind.events`.

Execution flow:
  1. Load macro and red-team personas from JSON config files.
  2. Instantiate each agent as NativeGroqAgent or LangChainAgent based on the
     `"framework"` field in the persona config.
  3. Start `listen_and_react()` in a daemon thread for every agent.
  4. Start the Moderator in its own daemon thread (max 12 rounds by default).
  5. Block on `while True / sleep(1)` until Ctrl+C triggers a clean shutdown.

Agent thread lifecycle (`listen_and_react`):
  • Subscribe to `hivemind.events`.
  • On each message:
      - Handle `world_event`  → unsilence all agents for this mode.
      - Handle `system_command/silence` → suppress further responses.
      - Skip messages from self or system commands.
      - Stagger response with a random 0.5–3 s delay to avoid stampede.
      - Call `agent.think()` with a mode-aware prompt + recent history.
      - Parse the JSON response; if speech != "SILENT":
          * Update agent memory and sentiment in Redis.
          * Score influence: increment any named agent's influence counter.
          * Publish `agent_speech` event back to the bus.
          * Publish `sentiment_update` event for the market engine.

Mode support:
  • `macro`    — Only macro persona agents respond.
  • `red_team` — Only red-team persona agents respond.
  Active mode is read from the Redis key `hivemind:mode` on each message.
"""

import redis
import json
import threading
import time
import random
from swarm_agent import NativeGroqAgent, LangChainAgent, _redis_client
from moderator import Moderator

r = redis.Redis(host='127.0.0.1', port=6379, decode_responses=True)

# ---------------------------------------------------------------------------
# Global swarm state — shared across all agent threads via this dict.
# `silenced` is set to True by a system_command/silence event (published by
# the Moderator when max_rounds is reached) and reset to False on the next
# world_event.
# ---------------------------------------------------------------------------
swarm_state = {"silenced": False}

# Load persona configs from the agents directory
with open("agents/personas.json", "r") as f:
    macro_personas = json.load(f)

with open("agents/red_team_personas.json", "r") as f:
    red_team_personas = json.load(f)

macro_names = [p["name"] for p in macro_personas]
red_team_names = [p["name"] for p in red_team_personas]

# Instantiate agents — NativeGroqAgent or LangChainAgent per persona config
agents = []
for p in macro_personas + red_team_personas:
    if p.get("framework") == "langchain":
        agents.append(LangChainAgent(p["name"], p["role_description"]))
    else:
        agents.append(NativeGroqAgent(p["name"], p["role_description"]))


def listen_and_react(agent):
    """
    Main event loop for a single agent thread.

    Subscribes to `hivemind.events` and reacts to incoming events according to
    the current debate mode and the swarm silence state.

    Prompt construction:
      - `macro` mode:    Instruct agents to rebut or build on named peers.
      - `red_team` mode: Instruct agents to evaluate strategy risk by role.

    Memory window:
      A rolling `agent_history` list (max 6 entries) of recent world events
      and agent speeches is maintained per thread and injected as context.

    Influence scoring:
      After publishing a speech, the runner checks if the speech text contains
      any other agent's name. If so, that agent's influence score is
      incremented by 1 via `other_agent.increment_influence()`.

    Args:
        agent (BaseAgent): The agent instance to run in this thread.
    """
    pubsub = r.pubsub()
    pubsub.subscribe('hivemind.events')
    print(f"[Swarm] {agent.name} is online in the Cyberpunk Sandbox.")
    
    agent_history = []
    
    for message in pubsub.listen():
        if message['type'] == 'message':
            data = json.loads(message['data'])
            
            # Handle state commands
            if data.get("type") == "world_event":
                # New scenario: lift the silence so agents can debate again
                swarm_state["silenced"] = False
            elif data.get("type") == "system_command" and data.get("action") == "silence":
                swarm_state["silenced"] = True
                
            # If silenced, do not process new thoughts
            if swarm_state["silenced"]:
                continue
                
            # Mode gate — each agent only responds when its mode is active
            active_mode = r.get("hivemind:mode") or "macro"
            if active_mode == "red_team":
                if agent.name not in red_team_names:
                    continue
            else:
                if agent.name not in macro_names:
                    continue
                
            # Maintain a rolling history window (last 6 messages)
            if data.get("type") in ["world_event", "agent_speech"]:
                agent_history.append(data)
                if len(agent_history) > 6:
                    agent_history.pop(0)

            # Don't react to our own messages or system commands
            if data.get("sender") == agent.name or data.get("type") == "system_command":
                continue
                
            # Stagger agent responses to avoid thundering herd on the LLM
            time.sleep(random.uniform(0.5, 3.0))
            
            # Re-check silence after the delay (Moderator may have fired)
            if swarm_state["silenced"]:
                continue
                
            try:
                # Build the mode-aware debate prompt with recent history
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
                    # Persist memory and update sentiment state in Redis
                    trigger_summary = data.get('content', '')[:200]
                    agent.update_memory(trigger=trigger_summary, speech=speech, emotion=emotion, asset_focus=asset_focus)

                    # Influence scoring: if this speech names a peer, reward that peer
                    for other_agent in agents:
                        if other_agent.name != agent.name and other_agent.name.lower() in speech.lower():
                            other_agent.increment_influence()

                    # Broadcast the agent's speech back to the event bus
                    event = {
                        "type": "agent_speech",
                        "sender": agent.name,
                        "content": speech,
                        "thought": parsed_response.get("thought", ""),
                        "emotion": emotion,
                        "asset_focus": asset_focus
                    }
                    r.publish('hivemind.events', json.dumps(event))

                    # Broadcast a live sentiment update for the market engine
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


# ---------------------------------------------------------------------------
# Startup: launch all agent threads and the Moderator thread
# ---------------------------------------------------------------------------

threads = []
for agent in agents:
    t = threading.Thread(target=listen_and_react, args=(agent,))
    t.daemon = True
    t.start()
    threads.append(t)

# Moderator enforces round limits (12 speeches before calling a winner)
mod = Moderator(max_rounds=12)
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
