def get_task():
    return {
        "name": "hard_strategic_planning",
        "description": "Multiple high-risk threats with extreme resource constraints requiring prioritization and planning",
        "difficulty": "hard",
        "max_steps": 10,

        # ✅ NEW
        "scoring": "Score based on long-term survival, prioritization of critical threats, and minimizing cumulative damage",

        "initial_state": {
            "time": 0,
            "threats": [
                {
                    "id": 1,
                    "type": "drone",
                    "distance": 25,
                    "speed": 6,
                    "status": "active",
                    "hidden": True
                },
                {
                    "id": 2,
                    "type": "cyber",
                    "stage": "breach",
                    "status": "active",
                    "hidden": False
                },
                {
                    "id": 3,
                    "type": "drone",
                    "distance": 18,
                    "speed": 5,
                    "status": "active",
                    "hidden": False
                },
                {
                    "id": 4,
                    "type": "cyber",
                    "stage": "probing",
                    "status": "active",
                    "hidden": True
                }
            ],
            "resources": {
                "defense_units": 1,
                "cyber_teams": 1
            },
            "damage": 0
        },

        "success_condition": "minimize_damage_with_optimal_decisions",
        "failure_condition": "high_damage_or_bad_prioritization"
    }