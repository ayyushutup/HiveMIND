import os
from groq import Groq

class Agent:
    def __init__(self, name, role_description):
        self.name = name
        self.role_description = role_description
        self.client = Groq()
        
    def think(self, user_message):
        print(f"\n[{self.name}] is thinking...")
        
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