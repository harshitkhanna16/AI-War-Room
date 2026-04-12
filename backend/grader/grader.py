def _normalize_score(score):
    """Ensure score is always strictly in (0, 1)"""
    return max(0.01, min(0.99, round(score, 2)))


# 🟢 EASY TASK
def grade_easy(env):
    state = env.state()

    damage   = state.get("damage", 0)
    threats  = state.get("threats", [])
    resolved = sum(1 for t in threats if t.get("status") == "resolved")

    score = 1.0
    score -= damage * 0.1
    score += min(0.2, resolved * 0.05)

    return _normalize_score(score)


# 🟡 MEDIUM TASK
def grade_medium(env):
    state = env.state()

    damage   = state.get("damage", 0)
    threats  = state.get("threats", [])
    resolved = sum(1 for t in threats if t.get("status") == "resolved")
    active   = sum(1 for t in threats if t.get("status") == "active")

    score = 1.0
    score -= damage * 0.15
    score += min(0.2, resolved * 0.04)
    score -= active * 0.03

    return _normalize_score(score)


# 🔴 HARD TASK
def grade_hard(env):
    state = env.state()

    damage   = state.get("damage", 0)
    threats  = state.get("threats", [])
    resolved = sum(1 for t in threats if t.get("status") == "resolved")

    critical_active = sum(
        1 for t in threats
        if t.get("type") == "cyber"
        and t.get("stage") == "critical"
        and t.get("status") == "active"
    )

    score = 1.0
    score -= damage * 0.2
    score += min(0.15, resolved * 0.03)
    score -= critical_active * 0.1

    return _normalize_score(score)


# 🔥 MASTER GRADER
class WarRoomGrader:
    def __init__(self, task_name):
        self.task_name = task_name

    def evaluate(self, env):
        if self.task_name == "easy":
            return grade_easy(env)
        elif self.task_name == "medium":
            return grade_medium(env)
        elif self.task_name == "hard":
            return grade_hard(env)
        return grade_easy(env)