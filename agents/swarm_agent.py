"""
swarm_agent.py — HiveMind Agent Layer
======================================
Defines the three-tier agent class hierarchy used by the swarm runner:

  BaseAgent
  ├── NativeGroqAgent   — calls Groq API directly (groq-python SDK)
  └── LangChainAgent    — calls Groq via a LangChain prompt chain

All agents:
  • Maintain a system prompt that forces structured JSON output.
  • Read/write episodic memory in Redis (last 8 turns per agent).
  • Track a live sentiment hash (emotion, intensity, influence score).
  • Record an emotion timeline capped at 10 entries.
"""

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

# ---------------------------------------------------------------------------
# Emotion → price-bias intensity mapping
# Used by the market engine (backend/main.py) to translate agent mood into
# a numeric directional score in [0.0, 1.0].
# ---------------------------------------------------------------------------
EMOTION_INTENSITY = {
    'panicked': 0.95, 'aggressive': 0.90, 'angry': 0.88,
    'terrified': 0.85, 'paranoid': 0.82, 'suspicious': 0.75,
    'calculating': 0.70, 'cold': 0.65, 'analytical': 0.60,
    'cynical': 0.55, 'pessimistic': 0.50, 'skeptical': 0.45,
    'calm': 0.35, 'philosophical': 0.30, 'peaceful': 0.25,
    'euphoric': 0.95, 'excited': 0.88, 'bullish': 0.80,
    'neutral': 0.20,
}

# Redis key templates
MEMORY_KEY = "hivemind:memory:{name}"     # List — episodic memory per agent
SENTIMENT_KEY = "hivemind:sentiment:{name}"  # Hash  — live sentiment state
MAX_MEMORY_ITEMS = 8                      # Rolling window size for memory


class BaseAgent:
    """
    Abstract base for all HiveMind agents.

    Responsibilities:
      - Holds the structured JSON system prompt enforcing the debate schema.
      - Provides read/write helpers for Redis-backed episodic memory.
      - Tracks live sentiment state (emotion, intensity, influence score).
      - Enforces influence scoring when another agent references this one.

    Args:
        name (str): Unique agent identifier (must match persona name in JSON).
        role_description (str): Free-text persona description appended to the
            system prompt after the agent's name.
    """

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
        """
        Retrieve this agent's episodic memory from Redis and format it as a
        prompt prefix injected before the user message.

        Returns:
            str: A formatted memory block, or an empty string if no memory
                 exists or Redis is unavailable.
        """
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
        """
        Persist a memory entry to Redis and refresh the live sentiment state.

        This method performs three atomic Redis operations:
          1. Prepend a memory item to the episodic list and trim to MAX_MEMORY_ITEMS.
          2. Overwrite the sentiment hash with the new emotion and intensity.
          3. Prepend an entry to the emotion timeline (capped at 10).

        Args:
            trigger (str): The event or message that caused this response
                           (truncated to 200 chars for storage efficiency).
            speech (str): What the agent said out loud (truncated to 300 chars).
            emotion (str): Single-word emotion label (see EMOTION_INTENSITY keys).
            asset_focus (str): One of "TECH", "CRYPTO", or "MACRO".
        """
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
        """
        Increment this agent's influence score by 1.

        Called by the swarm runner whenever another agent explicitly references
        this agent's name in their speech, rewarding persuasive debaters.
        The influence score also amplifies this agent's future price ticks in
        the market engine (up to a 10-point cap).
        """
        sent_key = SENTIMENT_KEY.format(name=self.name)
        self.r.hincrby(sent_key, "influence_score", 1)

    def think(self, user_message):
        """
        Abstract method — subclasses must implement LLM inference here.

        Args:
            user_message (str): The current debate prompt (may include memory
                                context prepended by the runner).

        Returns:
            str: Raw JSON string matching the debate schema.

        Raises:
            NotImplementedError: Always, unless overridden by a subclass.
        """
        raise NotImplementedError("Subclasses must implement think()")


class NativeGroqAgent(BaseAgent):
    """
    Agent implementation using the native Groq Python SDK.

    Uses `response_format={"type": "json_object"}` to guarantee structured
    JSON output without additional parsing overhead.

    Args:
        name (str): Agent name.
        role_description (str): Persona description string.
    """

    def __init__(self, name, role_description):
        super().__init__(name, role_description)
        self.client = Groq()

    def think(self, user_message):
        """
        Call the Groq API with the agent's system prompt and user message.

        Prepends any available episodic memory to the user message before
        sending, providing the agent with historical context.

        Args:
            user_message (str): The debate prompt from the swarm runner.

        Returns:
            str: Raw JSON string from the LLM response.
        """
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
    """
    Agent implementation using the LangChain framework with Groq as the LLM.

    Uses a PromptTemplate chain (`prompt | llm`) and forces JSON output via
    `model_kwargs`. Functionally equivalent to NativeGroqAgent but enables
    LangChain-native tooling, tracing (LangSmith), and future chain extensions.

    Args:
        name (str): Agent name.
        role_description (str): Persona description string.
    """

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
        """
        Invoke the LangChain prompt chain with episodic memory context.

        Args:
            user_message (str): The debate prompt from the swarm runner.

        Returns:
            str: Raw JSON string from the LLM response.
        """
        print(f"[{self.name}] is processing via LangChain Framework...")
        memory_ctx = self.get_memory_context()
        full_prompt = f"{memory_ctx}\n\n{user_message}" if memory_ctx else user_message

        response = self.chain.invoke({
            "system_prompt": self.system_prompt,
            "user_message": full_prompt
        })
        return response.content
