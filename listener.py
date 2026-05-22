import os
import redis
from agent import Agent

# 1. Initialize our Listener Agent
critic = Agent(
    name="CriticAgent",
    role_description="You are a grumpy security engineer. When you hear an idea, critique it in one short sentence."
)

# 2. Connect to the Event Bus
r = redis.Redis(host='localhost', port=6379, decode_responses=True)
pubsub = r.pubsub()

# 3. Subscribe to the 'hivemind.ideas' topic
pubsub.subscribe('hivemind.ideas')

print(f"[{critic.name}] is online and listening to the event bus...")

# 4. Wait for messages!
for message in pubsub.listen():
    if message['type'] == 'message':
        incoming_idea = message['data']
        print(f"\n--- [NEW EVENT RECEIVED] ---")
        print(f"Idea on the bus: {incoming_idea}")
        
        # The agent thinks about the idea and responds!
        critic.think(f"Critique this idea: {incoming_idea}")
