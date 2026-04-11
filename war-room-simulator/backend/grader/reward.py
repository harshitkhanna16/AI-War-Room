def compute_reward(state, action):
    reward = 0.0

    threats = state.get("threats", [])
    damage = state.get("damage", 0)
    time = state.get("time", 0)

    # =========================
    # 🔴 DAMAGE PENALTY (STRONG SIGNAL)
    # =========================
    reward -= min(0.5, damage * 0.1)

    resolved_count = 0
    active_penalty = 0

    for t in threats:
        t_type = t.get("type")
        status = t.get("status")

        # =========================
        # ✅ REWARD: resolved threats (LIMITED)
        # =========================
        if status == "resolved":
            resolved_count += 1

        # =========================
        # ❌ CRITICAL CYBER PENALTY
        # =========================
        if t_type == "cyber" and t.get("stage") == "critical" and status == "active":
            active_penalty += 0.3

        # =========================
        # ❌ DRONE CLOSE PENALTY
        # =========================
        if t_type == "drone" and t.get("distance", 100) <= 5 and status == "active":
            active_penalty += 0.2

        # =========================
        # ⚠️ CYBER BREACH PENALTY
        # =========================
        if t_type == "cyber" and t.get("stage") == "breach" and status == "active":
            active_penalty += 0.15

    # =========================
    # 🎯 APPLY RESOLVED REWARD (CAPPED)
    # =========================
    reward += min(0.5, resolved_count * 0.15)

    # =========================
    # ⚠️ APPLY ACTIVE PENALTIES
    # =========================
    reward -= min(0.5, active_penalty)

    # =========================
    # 🎯 ACTION QUALITY BONUS (SMARTER)
    # =========================
    if action and action != ["idle"]:
        # reward only if threats exist
        if len(threats) > 0:
            reward += 0.1

    # =========================
    # ⚠️ IDLE PENALTY
    # =========================
    if action == ["idle"]:
        reward -= 0.1

    # =========================
    # ⏳ TIME PRESSURE (LIGHT)
    # =========================
    reward -= min(0.2, time * 0.01)

    # =========================
    # ✅ NORMALIZATION (MANDATORY)
    # =========================
    reward = max(0.0, min(1.0, reward))

    return round(reward, 2)