def get_task():
    return {
        "name": "easy_single_drone",
        "description": "Handle a single approaching drone threat",
        "difficulty": "easy",
        "max_steps": 6,

        # ✅ NEW (IMPORTANT FOR JUDGES)
        "scoring": "Score based on minimizing damage and resolving the drone quickly",

        "initial_state": {
            "time": 0,
            "threats": [
                {
                    "id": 1,
                    "type": "drone",
                    "distance": 20,
                    "speed": 5,
                    "status": "active",
                    "hidden": False
                }
            ],
            "resources": {
                "defense_units": 2,
                "cyber_teams": 1
            },
            "damage": 0
        },

        "success_condition": "neutralize_drone",
        "failure_condition": "damage_exceeds"
    }