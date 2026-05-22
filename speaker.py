import redis
import sys

# Connect to the Event Bus
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

# Ask the human for an idea via command line argument, or use a default
idea = sys.argv[1] if len(sys.argv) > 1 else "Let's build a giant mirror in space."

# Publish the idea to the 'hivemind.ideas' topic
r.publish('hivemind.ideas', idea)
print(f"\n[System]: Idea broadcasted to all listening agents: '{idea}'")
