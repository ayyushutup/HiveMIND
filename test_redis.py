import redis

# Connect to the local Redis server
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

# Publish a message to a channel called 'hivemind.general'
r.publish('hivemind.general', 'Hello Swarm! The event bus is online.')
print("Message sent to the event bus!")
