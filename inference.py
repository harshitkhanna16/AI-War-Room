import sys
import os

# Add root path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from backend.env.env import WarRoomEnv
from backend.agent.risk import risk_score


# 🔥 AGENT (Deterministic)
def agent(state):
    threats = state.get("visible_threats", [])
    resources = state.get("resources", {})

    defense_units = resources.get("defense_units", 0)
    cyber_teams = resources.get("cyber_teams", 0)

    def threat_score(threat):
        if threat.get("type") == "cyber":
            return {"probing": 1, "breach": 3, "critical": 5}.get(threat.get("stage"), 1)
        elif threat.get("type") == "drone":
            return max(0, 30 - threat.get("distance", 30))
        return 0

    threats_sorted = sorted(
        threats,
        key=lambda t: risk_score(t) + threat_score(t),
        reverse=True
    )

    actions = []

    for t in threats_sorted:
        if t.get("status") != "active":
            continue

        if t.get("type") == "cyber" and cyber_teams > 0:
            actions.append("block cyber")
            cyber_teams -= 1

        elif t.get("type") == "drone" and defense_units > 0:
            actions.append("intercept drone")
            defense_units -= 1

    return actions if actions else ["idle"]


# 🔥 HELPER: FORMAT ACTIONS
def format_action(action):
    if isinstance(action, list):
        return "+".join([a.replace(" ", "_") for a in action])
    return str(action).replace(" ", "_")


# 🔥 RUN TASK
def run_task(task_name):
    env = WarRoomEnv(task_name)
    state = env.reset()

    model_name = "rule-based-agent"

    # ✅ START
    print(f"[START] task={task_name} env=war_room model={model_name}")

    rewards_list = []
    step = 0
    done = False

    while not done:
        step += 1

        try:
            action = agent(state)

            state, reward, done, _ = env.step(action)

            reward = round(float(reward), 2)
            rewards_list.append(reward)

            action_str = format_action(action)

            # ✅ STEP
            print(
                f"[STEP] step={step} action={action_str} reward={reward:.2f} done={str(done).lower()} error=null"
            )

        except Exception as e:
            print(
                f"[STEP] step={step} action=error reward=0.00 done=true error={str(e)}"
            )
            done = True
            break

        # Safety cap
        if step >= env.max_steps:
            done = True

    # ✅ SCORE
    score = float(env.get_score())
    score = round(score, 2)

    success = score >= 0.5

    rewards_str = "[" + ",".join([f"{r:.2f}" for r in rewards_list]) + "]"

    # ✅ END
    print(
        f"[END] success={str(success).lower()} steps={step} score={score:.2f} rewards={rewards_str}"
    )


# 🔥 MAIN
if __name__ == "__main__":
    for task in ["easy", "medium", "hard"]:
        run_task(task)