import os
from groq import Groq

class Agent:
    def __init__(self, name, role_description):
        # Every agent gets a name, a specific role, and its own brain (API client)
        self.name = name
        self.role_description = role_description
        self.client = Groq()
        
    def think(self, user_message):
        print(f"\n[{self.name}] is thinking...")
        
        # We pass the role_description as a 'system' message. 
        # This forces the AI to stay in character.
        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": self.role_description},
                {"role": "user", "content": user_message}
            ]
        )
        
        reply = response.choices[0].message.content
        print(f"[{self.name}]: {reply}\n")
        return reply

# --- Let's test our new Agent class! ---

# 1. Create an Optimistic Planner Agent
planner = Agent(
    name="PlannerAgent",
    role_description="You are a highly optimistic software architect. You always propose grand, ambitious solutions and focus on the positives."
)

# 2. Create a Grumpy Critic Agent
critic = Agent(
    name="CriticAgent",
    role_description="You are a grumpy, cynical security engineer. You hate overly ambitious plans and always point out how things will break or fail."
)

# 3. Give them a topic to respond to
topic = "We should build a flying car that runs on Javascript."

print(f"Topic: {topic}")
planner.think(topic)
critic.think(topic)