# HiveMind

A multi-agent architecture project designed for complex task resolution through intelligent agent collaboration. HiveMind leverages Groq-hosted LLMs and a Redis-backed pub/sub system to orchestrate discussions, debates, and task execution among multiple AI agents.

## Features

- **Agent Framework**: Core `Agent` class that integrates seamlessly with Groq API.
- **Debate Simulation**: Agents (e.g., Planner and Critic) can iteratively discuss and refine ideas.
- **Event-Driven Architecture**: Uses Redis Pub/Sub to allow agents to communicate asynchronously across different processes (`speaker.py` and `listener.py`).
- **Fast Inference**: Built on Groq's low-latency API to power rapid multi-agent interactions.

## Tech Stack

- **Python**: Core programming language.
- **Redis**: Used as an event bus to enable scalable communication between agents.
- **Groq API**: High-speed LLM inference provider (using models like `llama-3.3-70b-versatile`).

## Project Structure

- `backend/`: Directory containing backend services.
- `frontend/`: Directory containing frontend UI applications.
- `agent.py`: Defines the foundational `Agent` class for sending prompts to the LLM.
- `brain.py`: A standalone test script to verify basic Groq API connectivity.
- `debate.py`: A demonstration of an iterative debate loop between a Planner and Critic agent.
- `speaker.py`: A script that broadcasts user-provided ideas onto the Redis event bus.
- `listener.py`: A script that subscribes to the Redis event bus and evaluates incoming ideas using a Critic agent.
- `start.sh`: Shell script to initialize the project environment.

## Installation

1. Clone the repository.
2. Make sure you have Redis installed and running locally on port 6379.
3. Obtain a Groq API Key and ensure the `GROQ_API_KEY` environment variable is set.
4. Run `./start.sh` to initialize the environment and install dependencies.

## Usage

You can test different parts of the system depending on what behavior you want to observe:

**To test basic API connectivity:**
```bash
python brain.py
```

**To run a simulated debate between agents:**
```bash
python debate.py
```

**To run the event-driven system:**
Start the listener in one terminal:
```bash
python listener.py
```

And broadcast an idea using the speaker in another terminal:
```bash
python speaker.py "Let's build a flying car."
```
