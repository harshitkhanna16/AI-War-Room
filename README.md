---
title: War Room Simulator
emoji: 🛡️
colorFrom: red
colorTo: green
sdk: docker
app_port: 7860
tags: [openenv, reinforcement-learning, cybersecurity, drone-defense, simulation, multi-agent, defense-ai]
---

# 🛡️ AI War Room — Cyber & Drone Defense Simulator

> **An OpenEnv-compatible reinforcement learning environment where an AI agent defends critical infrastructure against simultaneous cyber attacks and drone incursions in real time.**

🔴 **Live Demo:** [https://HarshitKhanna16-war-room-simulator.hf.space/app](https://HarshitKhanna16-war-room-simulator.hf.space/app)

API Reference: https://harshitkhanna16-war-room-simulator.hf.space/docs

---

## 🌍 Real-World Utility

Modern Security Operations Centers (SOCs) and defense command posts face multi-vector threats simultaneously — a cyber breach escalating in the background while hostile drones close in on physical assets. Human operators must triage, prioritize, and act with limited resources under extreme time pressure.

This environment models exactly that challenge:

- 🖥️ **Cyber threats** that escalate through stages: `probing → breach → critical`
- 🚁 **Drone threats** that physically close in over time and cause damage if not intercepted
- ⚙️ **Resource constraints** — limited cyber teams and defense units force hard prioritization
- 👁️ **Partial observability** — not all threats are visible at once, mimicking real sensor limitations
- ⏱️ **Time pressure** — delayed action leads to cascading damage and mission failure

This is not a toy or a game. It directly maps to real SOC decision-making workflows and could be used to train, evaluate, and benchmark autonomous defense agents.

---

## 🎮 Environment Overview

| Property | Value |
|---|---|
| **Environment ID** | `war-room-simulator` |
| **Action Space** | Multi-discrete (`idle`, `block cyber`, `intercept drone`) |
| **Observation Space** | Structured JSON — threats, resources, damage, time |
| **Reward Range** | `0.0 – 1.0` (normalized by grader) |
| **Episode Length** | Up to 50 steps (terminates early if damage ≥ 10) |
| **Tasks** | 3 — Easy → Medium → Hard |
| **Framework** | OpenEnv spec compliant |

---

## 🗂️ Action Space

Actions are sent as a list — one action per available resource unit per step.

```json
{
  "actions": ["block cyber", "intercept drone"]
}
```

| Action | Description |
|---|---|
| `idle` | Do nothing this step — conserve resources |
| `block cyber` | Deploy one cyber team to neutralize an active cyber threat |
| `intercept drone` | Deploy one defense unit to shoot down an incoming drone |

**Key design:** Multiple actions can be issued per step, but each consumes one resource unit. If no resources remain, additional actions are ignored — forcing the agent to learn resource-aware prioritization.

---

## 👁️ Observation Space

Full typed observation returned by `reset()`, `step()`, and `state()`:

```json
{
  "time": 5,
  "damage": 2,
  "resources": {
    "defense_units": 2,
    "cyber_teams": 1
  },
  "visible_threats": [
    {
      "id": 1,
      "type": "cyber",
      "stage": "breach",
      "status": "active"
    },
    {
      "id": 2,
      "type": "drone",
      "distance": 15,
      "speed": 4,
      "status": "active"
    }
  ],
  "threats": [
    {
      "id": 0,
      "type": "drone",
      "status": "resolved"
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `time` | int | Current step number |
| `damage` | int | Accumulated damage (0–10, episode ends at 10) |
| `resources.defense_units` | int | Available drone interceptors |
| `resources.cyber_teams` | int | Available cyber responders |
| `visible_threats` | list | Currently observable active threats |
| `threats` | list | Full threat history including resolved |

---

## 🏆 Tasks

### ✅ Easy — `POST /reset?task=easy`
- 1–2 simultaneous threats maximum
- Slow cyber escalation rate
- Generous resources (3 defense units, 2 cyber teams)
- Drones start far away (distance 40–50)
- **Expected agent score: 0.70 – 1.00**

### ⚠️ Medium — `POST /reset?task=medium`
- 2–3 simultaneous threats
- Moderate escalation speed
- Balanced resources (2 defense units, 1 cyber team)
- Drones at medium range (distance 25–40)
- **Expected agent score: 0.40 – 0.70**

### 🔴 Hard — `POST /reset?task=hard`
- 3–5 simultaneous threats
- Rapid cyber escalation (reaches critical in 3 steps)
- Minimal resources (1 defense unit, 1 cyber team)
- Fast drones at close range (distance 10–25, high speed)
- **Expected agent score: 0.10 – 0.40**

---

## 🎯 Reward Function

Rewards are **dense and shaped** — the agent receives signal at every step, not just at episode end. This enables meaningful gradient-based learning throughout the episode.

| Event | Reward |
|---|---|
| Threat successfully neutralized | `+0.30` |
| Step survived with zero new damage | `+0.10` |
| Damage taken this step | `-0.20 × damage_points` |
| Idle while threats are active | `-0.05` (light penalty) |
| Episode completed, damage < 3 | `+0.50` bonus |
| Episode terminated due to max damage | `-0.50` penalty |

Final score returned by `/score` is normalized to **[0.0, 1.0]** using the task grader, enabling fair cross-task comparison.

**Design rationale:** Partial progress rewards (per neutralization, per safe step) ensure the agent learns meaningful policies even in hard tasks where perfect play is unlikely.

---

## 🔌 API Reference

Hugging Face: https://harshitkhanna16-war-room-simulator.hf.space/docs

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check — returns `{"status": "running"}` |
| `POST` | `/reset?task=easy` | Reset env, returns initial state |
| `POST` | `/step` | Take a step, returns state + reward + done |
| `GET` | `/state` | Get current state without stepping |
| `GET` | `/score` | Get final normalized score (0.0–1.0) |

### Quick Start — Python

```python
import requests

BASE = "https://HarshitKhanna16-war-room-simulator.hf.space"

# 1. Reset
resp = requests.post(f"{BASE}/reset?task=easy").json()
state = resp["state"]

# 2. Step loop
done = False
total_reward = 0
while not done:
    result = requests.post(f"{BASE}/step", json={
        "actions": ["block cyber", "intercept drone"]
    }).json()
    state = result["state"]
    total_reward += result["reward"]
    done = result["done"]

# 3. Get graded score
score = requests.get(f"{BASE}/score").json()
print(f"Final score: {score['score']:.3f}")
```

---

## 🤖 Baseline Inference Script

```bash
python inference.py
```

The baseline agent uses a **priority-based heuristic**:
- Cyber threats at `critical` stage → highest priority
- Drones with `distance < 15` → second priority
- Cyber threats at `breach` stage → third priority
- Remaining threats filled by available resources

### Expected Output Format

```
[START] task=easy env=war-room-simulator model=baseline
[STEP]  step=1 action=intercept_drone reward=0.24 done=false error=null
[STEP]  step=2 action=block_cyber reward=0.30 done=false error=null
[STEP]  step=3 action=idle reward=0.10 done=false error=null
...
[END]   success=true steps=22 score=0.74 rewards=0.24,0.30,0.10,...
```

### Baseline Scores

| Task | Steps | Score |
|---|---|---|
| Easy | ~20 | ~0.74 |
| Medium | ~28 | ~0.49 |
| Hard | ~35 | ~0.22 |

---

## 🚀 Setup & Installation

### Prerequisites
- Python 3.10+
- Docker (for containerized run)

### Local Setup

```bash
# Clone
git clone https://huggingface.co/spaces/HarshitKhanna16/war-room-simulator
cd war-room-simulator

# Install
pip install -r requirements.txt

# Run
uvicorn backend.api.main:app --host 0.0.0.0 --port 7860
```

Then open: `http://localhost:7860/app`

### Docker Setup

```bash
docker build -t war-room-simulator .
docker run -p 7860:7860 war-room-simulator
```

---

## 📁 Project Structure

```
war-room-simulator/
├── backend/
│   ├── api/
│   │   └── main.py          # FastAPI server + static frontend serving
│   ├── env/
│   │   ├── env.py           # Core OpenEnv environment logic
│   │   └── models.py        # Pydantic typed Action/Observation models
│   ├── grader/              # Task graders — deterministic scoring per task
│   ├── tasks/               # Task configs (easy / medium / hard)
│   ├── agent/               # Baseline heuristic agent
│   └── utils/               # Shared utilities
├── frontend/
│   ├── index.html           # Live War Room command UI
│   ├── script.js            # Real-time backend-driven frontend logic
│   └── style.css            # Military-themed dark UI styling
├── Dockerfile               # Container definition
├── inference.py             # Baseline inference script (hackathon required)
├── openenv.yaml             # OpenEnv metadata and task registry
├── pyproject.toml           # Python package configuration
├── requirements.txt         # Python dependencies
└── README.md                # This file
```

---

## ✅ OpenEnv Compliance Checklist

- ✅ `reset()` returns clean, typed initial observation
- ✅ `step(action)` returns `(state, reward, done, info)` 
- ✅ `state()` returns current observation without side effects
- ✅ Typed Pydantic models for `Action` and `Observation`
- ✅ `openenv.yaml` present at repo root
- ✅ `pyproject.toml` present at repo root
- ✅ `inference.py` present at repo root
- ✅ `Dockerfile` present at repo root — builds and runs cleanly
- ✅ 3 tasks with programmatic graders (easy → medium → hard)
- ✅ All scores in `[0.0, 1.0]` range
- ✅ Dense reward signal (not sparse)
- ✅ Deployed and running on Hugging Face Spaces (Docker)
- ✅ Episode terminates cleanly with `done=true`

---

## 🏗️ Built With

- **FastAPI** — High-performance async backend API
- **Pydantic** — Typed observation and action models
- **Uvicorn** — ASGI server
- **Docker** — Containerized deployment
- **Hugging Face Spaces** — Cloud hosting
- **Chart.js** — Live real-time metrics charts
- **Python 3.10** — Core environment logic

---

## 👤 Author

**Manas Khanna** & **Harshit Khanna**
