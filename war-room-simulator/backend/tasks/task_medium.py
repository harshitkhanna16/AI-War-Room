def get_task():
    return {
        "name": "medium_multi_threat",
        "description": "Handle multiple simultaneous threats with limited resources",
        "difficulty": "medium",
        "max_steps": 8,

        # ✅ NEW
        "scoring": "Score based on resolving threats efficiently while minimizing damage and avoiding resource waste",

        "initial_state": {
            "time": 0,
            "threats": [
                {
                    "id": 1,
                    "type": "drone",
                    "distance": 30,
                    "speed": 5,
                    "status": "active",
                    "hidden": False
                },
                {
                    "id": 2,
                    "type": "cyber",
                    "stage": "probing",
                    "status": "active",
                    "hidden": False
                },
                {
                    "id": 3,
                    "type": "drone",
                    "distance": 25,
                    "speed": 4,
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

        "success_condition": "minimize_damage",
        "failure_condition": "critical_damage"
    }