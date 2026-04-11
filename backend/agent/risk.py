def risk_score(threat):
    # 🔒 Safe access
    t_type = threat.get("type")
    status = threat.get("status")

    # Ignore non-active threats
    if status != "active":
        return -1

    # =========================
    # 💻 CYBER THREAT SCORING
    # =========================
    if t_type == "cyber":
        stage = threat.get("stage", "probing")

        if stage == "critical":
            return 10   # 🔴 highest priority

        elif stage == "breach":
            return 7    # 🟠 medium-high

        elif stage == "probing":
            return 4    # 🟡 early warning

        return 2

    # =========================
    # 🚁 DRONE THREAT SCORING
    # =========================
    elif t_type == "drone":
        distance = threat.get("distance", 100)
        speed = threat.get("speed", 1)

        # ✅ Stable & bounded scoring
        distance_score = max(0, 30 - distance)   # closer = higher risk
        speed_score = speed * 1.5

        risk = distance_score + speed_score

        return round(min(10, risk), 2)  # ✅ cap at 10 for consistency

    # =========================
    # ⚠️ UNKNOWN THREAT
    # =========================
    return 0