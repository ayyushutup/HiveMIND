"""
moderator.py — HiveMind Debate Moderator
=========================================
Provides the Moderator class: a Redis Pub/Sub subscriber that enforces debate
round limits and uses an LLM-powered judge to declare a winner at the end of
each debate cycle.

Role in the system:
  • Runs in its own daemon thread (started by swarm_runner.py).
  • Counts every `agent_speech` event on `hivemind.events`.
  • When the count reaches `max_rounds`, it prompts the judge LLM with the
    full debate transcript and broadcasts a `debate_conclusion` event.
  • Immediately follows with a `system_command / silence` to stop all agents.
  • Resets automatically when a new `world_event` arrives.

Mode-aware:
  • In `macro` mode: judges which agent made the strongest financial argument.
  • In `red_team` mode: judges whether the proposed strategy was approved or
    rejected by the corporate panel.
"""

import redis
import json
import re
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from agent import Agent


class Moderator:
    """
    LLM-powered debate moderator and judge.

    Subscribes to the `hivemind.events` Redis channel, counts agent speech
    turns, and terminates each debate round by invoking a judge LLM that
    selects a winner from the debate transcript.

    On conclusion, two events are published back to the channel:
      1. `debate_conclusion` — contains winner, reason, sentiment, and asset.
      2. `system_command / silence` — instructs all agent threads to go quiet.

    Args:
        max_rounds (int): Number of agent speech turns before the debate is
                          concluded. Defaults to 5. Can be updated at runtime
                          via a `system_config` event with `{"max_rounds": N}`.

    Attributes:
        max_rounds (int): Current round limit.
        current_count (int): Running count of agent speeches since last reset.
        r (redis.Redis): Redis connection shared with the swarm.
        history (list[str]): Accumulated transcript lines for the judge prompt.
        judge (Agent): A simple Groq-backed agent acting as the impartial judge.
    """

    def __init__(self, max_rounds=5):
        self.max_rounds = max_rounds
        self.current_count = 0
        self.r = redis.Redis(host='127.0.0.1', port=6379, decode_responses=True)
        self.history = []
        self.judge = Agent(
            name="Moderator",
            role_description=(
                "You are the impartial Moderator and Judge of a financial debate. "
                "Your job is to read the debate history and declare a single definitive Winner. "
                "The winner must be one of the agents who participated. "
                "Respond strictly with a JSON object: "
                '{"winner": "AgentName", "reason": "1 short sentence explaining why.", "winning_sentiment": "bullish or bearish", "asset": "TECH, CRYPTO, or MACRO"}'
            )
        )

    def listen(self):
        """
        Main event loop — subscribe to `hivemind.events` and process messages.

        Message handling:
          - `world_event`:    Reset round counter and history; record the event.
          - `system_config`:  Apply live config updates (e.g., `max_rounds`).
          - `agent_speech`:   Increment counter; evaluate when limit is reached.

        When `max_rounds` is reached:
          - Build a mode-aware judge prompt from `self.history`.
          - Call `self.judge.think()` and parse the JSON result.
          - Publish `debate_conclusion` and `system_command/silence` events.
          - Set `current_count = -9999` to suppress duplicate stop events.

        This method blocks indefinitely; it is intended to run inside a daemon
        thread so it does not prevent process shutdown.
        """
        pubsub = self.r.pubsub()
        pubsub.subscribe('hivemind.events')
        print("[Moderator] is online. Enforcing debate limits.")
        
        for message in pubsub.listen():
            if message['type'] == 'message':
                data = json.loads(message['data'])
                
                if data.get("type") == "world_event":
                    # New scenario injected — reset the counter and transcript
                    print("[Moderator] New world event detected. Resetting counter.")
                    self.current_count = 0
                    self.history = []
                    self.history.append(f"[World Event]: {data.get('content', '')}")
                    
                elif data.get("type") == "system_config":
                    # Allow runtime reconfiguration of the round limit
                    config = data.get("config", {})
                    if "max_rounds" in config:
                        self.max_rounds = int(config["max_rounds"])
                        print(f"[Moderator] Max rounds updated to {self.max_rounds}")
                        
                elif data.get("type") == "agent_speech":
                    self.current_count += 1
                    sender = data.get("sender", "Unknown")
                    content = data.get("content", "")
                    self.history.append(f"[{sender}]: {content}")
                    
                    if self.current_count >= self.max_rounds:
                        print(f"[Moderator] Max rounds ({self.max_rounds}) reached. Evaluating debate winner...")
                        
                        history_text = "\n".join(self.history)
                        active_mode = self.r.get("hivemind:mode") or "macro"

                        # Build a mode-aware judge prompt
                        if active_mode == "red_team":
                            prompt = (
                                f"Here is the strategy stress-testing debate transcript:\n{history_text}\n\n"
                                "As the Moderator, read the debate and determine the final consensus. "
                                "Is the strategy approved or rejected? Who made the most compelling case (the winner)? "
                                "Respond strictly with a JSON object:\n"
                                '{"winner": "AgentName", "reason": "1 short sentence explaining if the strategy was approved or rejected and why.", "winning_sentiment": "approved or rejected", "asset": "STRATEGY"}'
                            )
                        else:
                            prompt = f"Here is the debate transcript:\n{history_text}\n\nWho won? Return only the JSON object."
                        
                        try:
                            reply = self.judge.think(prompt)
                            # Strip markdown code fences if the LLM adds them
                            clean_reply = re.sub(r'```json\s*|\s*```', '', reply).strip()
                            result = json.loads(clean_reply)
                            
                            winner = result.get("winner", "No One")
                            reason = result.get("reason", "The debate was inconclusive.")
                            sentiment = result.get("winning_sentiment", "neutral").lower()
                            asset = result.get("asset", "MACRO").upper()
                            
                            # 1. Publish the structured conclusion (triggers market spike in backend)
                            conclusion_event = {
                                "type": "debate_conclusion",
                                "winner": winner,
                                "reason": reason,
                                "sentiment": sentiment,
                                "asset": asset
                            }
                            
                            # 2. Silence all agents for this round
                            stop_event = {
                                "type": "system_command",
                                "action": "silence",
                                "content": f"DEBATE CONCLUDED. The winner is {winner}. {reason}"
                            }
                            
                            self.r.publish('hivemind.events', json.dumps(conclusion_event))
                            self.r.publish('hivemind.events', json.dumps(stop_event))
                            
                        except Exception as e:
                            print(f"[Moderator] Failed to judge debate: {e}")
                            # Fallback: still silence the agents even if judging fails
                            stop_event = {
                                "type": "system_command",
                                "action": "silence",
                                "content": "DEBATE CONCLUDED. AWAITING NEXT SCENARIO."
                            }
                            self.r.publish('hivemind.events', json.dumps(stop_event))

                        # Prevent multiple stop events from spamming
                        self.current_count = -9999 


if __name__ == "__main__":
    mod = Moderator()
    mod.listen()
