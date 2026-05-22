import redis
import json

class Moderator:
    def __init__(self, max_rounds=5):
        self.max_rounds = max_rounds
        self.current_count = 0
        self.r = redis.Redis(host='127.0.0.1', port=6379, decode_responses=True)

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
                    
                elif data.get("type") == "agent_speech":
                    self.current_count += 1
                    
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
