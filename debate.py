import os
from groq import Groq
from agent import Agent  # This imports the class we built in Lesson 2!

# 1. Spawn our two agents
planner = Agent(
    name="PlannerAgent",
    role_description="You are an optimistic software architect. Keep your responses to ONE short paragraph maximum."
)

critic = Agent(
    name="CriticAgent",
    role_description="You are a grumpy security engineer. You hate ambitious plans and point out flaws. Keep your responses to ONE short paragraph maximum."
)

# 2. Set the initial idea
current_idea = "Let's build a flying car that runs on Javascript."

print(f"--- STARTING DEBATE ---\nInitial Idea: {current_idea}\n")

# 3. Create a Debate Loop! 
# They will argue back and forth 3 times.
for round in range(1, 4):
    print(f"====== ROUND {round} ======")
    
    # The Critic attacks the current idea
    critic_attack = critic.think(f"Critique this idea: {current_idea}")
    
    # The Planner defends and revises the idea based on the attack
    planner_defense = planner.think(f"The critic said: '{critic_attack}'. Defend your idea and propose a revised version to address their concerns.")
    
    # The revised idea becomes the new current_idea for the next round!
    current_idea = planner_defense

print("--- DEBATE FINISHED ---")