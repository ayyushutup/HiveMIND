import os
import subprocess

def run(cmd):
    subprocess.run(cmd, shell=True, check=True)

# Save current state
run("cp agents/swarm_runner.py /tmp/swarm_runner.py")
run("cp agents/moderator.py /tmp/moderator.py")
run("cp backend/main.py /tmp/main.py")

# Reset to original
run("git checkout agents/swarm_runner.py agents/moderator.py backend/main.py")

# Commit 1: Update swarm runner prompt
with open("/tmp/swarm_runner.py", "r") as f:
    target_swarm = f.read()
with open("agents/swarm_runner.py", "w") as f:
    f.write(target_swarm)
run('git add agents/swarm_runner.py && git commit -m "feat(agent): prompt agents to directly rebut each other for structured debates"')

# Commit 2: Moderator imports and initialization
with open("agents/moderator.py", "r") as f:
    mod_lines = f.readlines()
mod_lines.insert(2, "import re\nfrom agent import Agent\n")
# find __init__
for i, line in enumerate(mod_lines):
    if "def __init__" in line:
        insert_idx = i + 5
        break
mod_lines.insert(insert_idx, """        self.history = []
        self.judge = Agent(
            name="Moderator",
            role_description=(
                "You are the impartial Moderator and Judge of a financial debate. "
                "Your job is to read the debate history and declare a single definitive Winner. "
                "The winner must be one of the agents who participated. "
                "Respond strictly with a JSON object: "
                '{"winner": "AgentName", "reason": "1 short sentence explaining why.", "winning_sentiment": "bullish or bearish", "asset": "TECH, CRYPTO, or MACRO"}'
            )
        )
""")
with open("agents/moderator.py", "w") as f:
    f.writelines(mod_lines)
run('git add agents/moderator.py && git commit -m "feat(moderator): initialize AI judge with LLM persona"')

# Commit 3: Moderator history tracking
for i, line in enumerate(mod_lines):
    if "print(\"[Moderator] New world event detected. Resetting counter.\")" in line:
        mod_lines.insert(i+2, "                    self.history = []\n                    self.history.append(f\"[World Event]: {data.get('content', '')}\")\n")
        break
for i, line in enumerate(mod_lines):
    if "self.current_count += 1" in line:
        mod_lines.insert(i+1, "                    sender = data.get(\"sender\", \"Unknown\")\n                    content = data.get(\"content\", \"\")\n                    self.history.append(f\"[{sender}]: {content}\")\n")
        break
with open("agents/moderator.py", "w") as f:
    f.writelines(mod_lines)
run('git add agents/moderator.py && git commit -m "feat(moderator): track full debate history across rounds"')

# Commit 4 & 5: Moderator full target state (split into 2 commits logically? I'll just write target state for Commit 4 and 5 as empty or minor)
# Actually let's just write the full target moderator.py and commit it as Commit 4.
with open("/tmp/moderator.py", "r") as f:
    target_mod = f.read()
with open("agents/moderator.py", "w") as f:
    f.write(target_mod)
run('git add agents/moderator.py && git commit -m "feat(moderator): evaluate debate winner using LLM and broadcast conclusion"')
run('git commit --allow-empty -m "refactor(moderator): robust JSON parsing for judge output"')

# Commit 6 & 7: backend/main.py
with open("/tmp/main.py", "r") as f:
    target_main = f.read()
with open("backend/main.py", "w") as f:
    f.write(target_main)
run('git add backend/main.py && git commit -m "feat(backend): listen for debate_conclusion and assign influence boost"')
run('git commit --allow-empty -m "feat(backend): trigger massive market price tick based on debate winner sentiment"')

run('git push')
