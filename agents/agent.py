import os
import json
from groq import Groq

class Agent:
    def __init__(self, name, role_description):
        self.name = name
        self.role_description = role_description
        self.client = Groq()
        self.system_prompt = (
            f"You are {name}. {role_description}\n"
            "You exist in a dystopian cyberpunk digital sandbox. "
            "You MUST respond with valid JSON strictly matching this schema:\n"
            "{\n"
            '  "thought": "your internal monologue assessing the situation",\n'
            '  "speech": "what you say out loud to the world or other characters",\n'
            '  "emotion": "a single word describing your current emotion (e.g., panicked, calculating, aggressive, cynical)"\n'
            "}"
        )
        
    def think(self, user_message):
        print(f"[{self.name}] is processing...")
        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_message}
            ]
        )
        reply = response.choices[0].message.content
        return reply
