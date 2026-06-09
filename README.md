# HiveMind

A multi-agent architecture project designed for complex task resolution through intelligent agent collaboration. Or, in simpler terms, a bunch of bots talking to each other because humans are too slow and complain too much. 

## Tech Stack

Because we love overengineering, here's what powers this beautiful mess:
- **Python**: Obviously. The duct tape of the internet.
- **Redis**: For when the agents need a memory span longer than a goldfish.
- **Some LLMs**: Taking all our jobs, one token at a time.

## How it Works (Sort of)

1. You give it a task that's way too complex for a single prompt.
2. The `Speaker` starts yelling at the `Listener`.
3. The `Debate` ensues, where agents argue until they reach consensus (or hit the rate limit).
4. Magic happens in the `Brain`, and eventually, a semi-coherent output is spat out. 
5. If it fails, blame the LLM provider.

## Installation

1. Clone the repository (if you have the bandwidth)
2. Run `./start.sh` to initialize the environment and hope it doesn't break your system.

## Usage

To start the agentic system, run the main agent script and watch the magic (or chaos) unfold:
```bash
python agent.py
```
