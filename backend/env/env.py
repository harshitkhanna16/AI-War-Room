from backend.env.simulator import simulate
from backend.grader.reward import compute_reward
from backend.grader.grader import WarRoomGrader
from backend.tasks import get_task_by_name
from backend.env.models import Observation

import copy
import random


class WarRoomEnv:
    def __init__(self, task_name="easy", seed=42):
        self.task_name = task_name
        self.task = get_task_by_name(task_name)

        self._state = None
        self.time = 0

        # ✅ Deterministic seed
        self.seed = seed
        random.seed(self.seed)

        # Max steps
        self.max_steps = self.task.get("max_steps", 10)

        # ✅ Grader
        self.grader = WarRoomGrader(self.task_name)

    # ✅ REQUIRED
    def state(self):
        return self._state

    # 🔁 RESET
    def reset(self):
        random.seed(self.seed)

        self.time = 0
        self._state = copy.deepcopy(self.task["initial_state"])

        # ✅ Only ACTIVE + VISIBLE threats
        self._state["visible_threats"] = [
            t for t in self._state.get("threats", [])
            if not t.get("hidden", False) and t.get("status") == "active"
        ]

        return Observation(**self._state).dict()

    # ⚡ STEP
    def step(self, action):

        if self._state is None:
            raise ValueError("Call reset() before step().")

        # ✅ Normalize action
        if isinstance(action, dict):
            action = action.get("actions", [])
        if not isinstance(action, list):
            action = []

        self.time += 1

        # 🔹 Simulate
        new_state = simulate(self._state, action)
        new_state["time"] = self.time  # ✅ keep time consistent

        # =========================
        # 🔥 DETERMINISTIC SPAWN
        # =========================
        if self.time % 3 == 0:
            new_state.setdefault("threats", []).append({
                "id": len(new_state.get("threats", [])) + 1,
                "type": ["drone", "cyber"][self.time % 2],
                "status": "active",
                "hidden": False,
                "distance": 10 + (self.time % 10),
                "speed": 3 + (self.time % 3),
                "stage": ["probing", "breach", "critical"][self.time % 3]
            })

        # =========================
        # 🛡 FAIL-SAFE
        # =========================
        active_threats = [
            t for t in new_state.get("threats", [])
            if t.get("status") == "active"
        ]

        if len(active_threats) == 0:
            new_state.setdefault("threats", []).append({
                "id": len(new_state.get("threats", [])) + 1,
                "type": "drone",
                "status": "active",
                "hidden": False,
                "distance": 15,
                "speed": 4
            })

        # =========================
        # 🌫 FOG OF WAR
        # =========================
        for i, t in enumerate(new_state.get("threats", [])):
            if t.get("hidden", False) and (self.time + i) % 2 == 0:
                t["hidden"] = False

        # =========================
        # 👁 VISIBLE THREATS (FIXED)
        # =========================
        new_state["visible_threats"] = [
            t for t in new_state.get("threats", [])
            if not t.get("hidden", False) and t.get("status") == "active"
        ]

        # =========================
        # 🎯 REWARD
        # =========================
        reward = compute_reward(new_state, action)
        reward = max(0.0, min(1.0, reward))

        # =========================
        # 🏁 DONE
        # =========================
        done = (
            self.time >= self.max_steps or
            new_state.get("damage", 0) >= 10
        )

        # =========================
        # 🔄 UPDATE STATE
        # =========================
        self._state = new_state

        return Observation(**self._state).dict(), reward, done, {}

    # 🏁 FINAL SCORE
    def get_score(self):
        return self.grader.evaluate(self)