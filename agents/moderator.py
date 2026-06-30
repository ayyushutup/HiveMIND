import redis
import json
import re
from agent import Agent

class Moderator:
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
        pubsub = self.r.pubsub()
        pubsub.subscribe('hivemind.events')
        print("[Moderator] is online. Enforcing debate limits.")
        
        for message in pubsub.listen():
            if message['type'] == 'message':
                data = json.loads(message['data'])
                
                if data.get("type") == "world_event":
                    # New scenario injected, reset the counter
                    print("[Moderator] New world event detected. Resetting counter.")
                    self.current_count = 0
                    self.history = []
                    self.history.append(f"[World Event]: {data.get('content', '')}")
                    
                elif data.get("type") == "system_config":
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
                        print(f"[Moderator] Max rounds ({self.max_rounds}) reached. Stopping debate.")
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
