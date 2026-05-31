import os
import json
import time
import redis
from groq import Groq

# Langchain imports
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate

# Shared Redis connection for all agents
_redis_client = redis.Redis(host='127.0.0.1', port=6379, decode_responses=True)

# Map emotions to intensity buckets for scoring
EMOTION_INTENSITY = {
    'panicked': 0.95, 'aggressive': 0.90, 'angry': 0.88,
    'terrified': 0.85, 'paranoid': 0.82, 'suspicious': 0.75,
    'calculating': 0.70, 'cold': 0.65, 'analytical': 0.60,
    'cynical': 0.55, 'pessimistic': 0.50, 'skeptical': 0.45,
    'calm': 0.35, 'philosophical': 0.30, 'peaceful': 0.25,
    'euphoric': 0.95, 'excited': 0.88, 'bullish': 0.80,
    'neutral': 0.20,
}

MEMORY_KEY = "hivemind:memory:{name}"
SENTIMENT_KEY = "hivemind:sentiment:{name}"
MAX_MEMORY_ITEMS = 8


class BaseAgent:
    def __init__(self, name, role_description):
        self.name = name
        self.role_description = role_description
        self.r = _redis_client
        self.system_prompt = (
            f"You are {name}. {role_description}\n"
            "You exist in a dystopian cyberpunk digital sandbox. "
            "You MUST respond with valid JSON strictly matching this schema:\n"
            "{\n"
            '  "thought": "your internal monologue assessing the situation",\n'
            '  "speech": "what you say out loud. If you agree and have nothing new to add, output strictly \'SILENT\'",\n'
            '  "emotion": "a single word describing your current emotion (e.g., panicked, calculating, aggressive, cynical)",\n'
            '  "asset_focus": "the primary asset you are focusing on (choose exactly one: TECH, CRYPTO, MACRO)"\n'
            "}"
        )

    def get_memory_context(self) -> str:
        """Retrieve this agent's episodic memory from Redis and format it as a prompt prefix."""
        key = MEMORY_KEY.format(name=self.name)
        try:
            raw_items = self.r.lrange(key, 0, MAX_MEMORY_ITEMS - 1)
            if not raw_items:
                return ""
            memories = [json.loads(item) for item in raw_items]
            lines = ["--- YOUR MEMORY OF PAST DEBATES ---"]
            for m in memories:
                ts = m.get("timestamp", "")
                trigger = m.get("trigger", "")
                speech = m.get("speech", "")
                emotion = m.get("emotion", "")
                asset = m.get("asset_focus", "MACRO")
                lines.append(f"[{ts}] You felt {emotion} about {asset}. In response to: \"{trigger[:80]}...\" — You said: \"{speech[:120]}...\"")
            lines.append("--- END MEMORY ---")
            return "\n".join(lines)
        except Exception:
            return ""

    def update_memory(self, trigger: str, speech: str, emotion: str, asset_focus: str = "MACRO"):
        """Persist a memory item to Redis and update the agent's sentiment state."""
        # 1. Push to episodic memory list
        mem_key = MEMORY_KEY.format(name=self.name)
        memory_item = {
            "timestamp": time.strftime("%H:%M:%S"),
            "trigger": trigger[:200],
            "speech": speech[:300],
            "emotion": emotion,
            "asset_focus": asset_focus,
        }
        self.r.lpush(mem_key, json.dumps(memory_item))
        self.r.ltrim(mem_key, 0, MAX_MEMORY_ITEMS - 1)  # Keep only last N

        # 2. Update live sentiment hash
        sent_key = SENTIMENT_KEY.format(name=self.name)
        intensity = EMOTION_INTENSITY.get(emotion.lower(), 0.5)
        self.r.hset(sent_key, mapping={
            "current_emotion": emotion,
            "intensity": intensity,
            "last_updated": time.strftime("%H:%M:%S"),
        })

        # 3. Append to emotion timeline (list capped at 10)
        timeline_key = f"hivemind:timeline:{self.name}"
        self.r.lpush(timeline_key, json.dumps({"emotion": emotion, "intensity": intensity, "time": time.strftime("%H:%M:%S")}))
        self.r.ltrim(timeline_key, 0, 9)

    def increment_influence(self):
        """Called when another agent reacts to this agent's speech."""
        sent_key = SENTIMENT_KEY.format(name=self.name)
        self.r.hincrby(sent_key, "influence_score", 1)

    def think(self, user_message):
        raise NotImplementedError("Subclasses must implement think()")


class NativeGroqAgent(BaseAgent):
    def __init__(self, name, role_description):
        super().__init__(name, role_description)
        self.client = Groq()

    def think(self, user_message):
        print(f"[{self.name}] is processing via Native Groq API...")
        memory_ctx = self.get_memory_context()
        full_prompt = f"{memory_ctx}\n\n{user_message}" if memory_ctx else user_message

        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": full_prompt}
            ]
        )
        return response.choices[0].message.content


class LangChainAgent(BaseAgent):
    def __init__(self, name, role_description):
        super().__init__(name, role_description)
        self.llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            model_kwargs={"response_format": {"type": "json_object"}}
        )
        self.prompt = PromptTemplate(
            template="{system_prompt}\n\nUser Message: {user_message}",
            input_variables=["system_prompt", "user_message"]
        )
        self.chain = self.prompt | self.llm

    def think(self, user_message):
        print(f"[{self.name}] is processing via LangChain Framework...")
        memory_ctx = self.get_memory_context()
        full_prompt = f"{memory_ctx}\n\n{user_message}" if memory_ctx else user_message

        response = self.chain.invoke({
            "system_prompt": self.system_prompt,
            "user_message": full_prompt
        })
        return response.content
