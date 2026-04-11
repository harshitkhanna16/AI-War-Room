import copy


def simulate(state, action):
    new_state = copy.deepcopy(state)

    threats = new_state.get("threats", [])
    resources = new_state.get("resources", {})

    defense_units = resources.get("defense_units", 0)
    cyber_teams = resources.get("cyber_teams", 0)

    used_defense = 0
    used_cyber = 0

    # ✅ Normalize action (OpenEnv compliant)
    if isinstance(action, dict):
        action = action.get("actions", [])

    if not isinstance(action, list):
        action = []

    # =========================
    # 🔄 PROCESS EACH THREAT
    # =========================
    for t in threats:

        # Skip non-active threats
        if t.get("status") != "active":
            continue

        t_type = t.get("type")

        # =========================
        # 🔴 ACTION HANDLING
        # =========================

        # 🚁 DRONE INTERCEPTION
        if t_type == "drone" and "intercept drone" in action:
            if used_defense < defense_units:
                t["status"] = "resolved"
                used_defense += 1
                continue

        # 💻 CYBER DEFENSE
        if t_type == "cyber" and "block cyber" in action:
            if used_cyber < cyber_teams:
                t["status"] = "resolved"
                used_cyber += 1
                continue

        # =========================
        # ⚠️ THREAT EVOLUTION
        # =========================

        # 🚁 DRONE MOVEMENT
        if t_type == "drone":
            distance = t.get("distance", 0)
            speed = t.get("speed", 0)

            t["distance"] = distance - speed

            if t["distance"] <= 0:
                t["status"] = "resolved"
                new_state["damage"] = new_state.get("damage", 0) + 3

        # 💻 CYBER ESCALATION
        elif t_type == "cyber":
            stage = t.get("stage", "probing")

            if stage == "probing":
                t["stage"] = "breach"

            elif stage == "breach":
                t["stage"] = "critical"

            elif stage == "critical":
                new_state["damage"] = new_state.get("damage", 0) + 2

    return new_state