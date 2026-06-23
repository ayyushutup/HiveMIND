"""
Core agent module for HiveMind.
Provides the Agent class which wraps the Groq API for AI interactions.
"""
import os
from groq import Groq

class Agent:
    """
    Represents an AI agent capable of thinking and responding to prompts.
    
    Attributes:
        name (str): The name of the agent.
        role_description (str): The system prompt defining the agent's behavior.
        client (Groq): The Groq API client instance.
    """
    def __init__(self, name, role_description):
        self.name = name
        self.role_description = role_description
        self.client = Groq()
        
    def think(self, user_message):
        """
        Sends a message to the Groq LLM and returns the response.
        
        Args:
            user_message (str): The input message/prompt for the agent.
            
        Returns:
            str: The agent's generated response.
        """
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