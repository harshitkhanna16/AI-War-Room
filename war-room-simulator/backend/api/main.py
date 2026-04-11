from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os

from backend.env.env import WarRoomEnv
from backend.env.models import Action

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

env = None

# ── API ROUTES ────────────────────────────────────────────────────────

@app.post("/reset")
def reset(task: str = "easy"):
    global env
    env = WarRoomEnv(task)
    state = env.reset()
    return {"state": state, "message": f"environment reset: {task}"}

@app.post("/step")
def step(action: Action):
    global env
    if env is None:
        return {"error": "Environment not initialized. Call /reset first."}
    state, reward, done, _ = env.step(action.actions)
    return {"state": state, "reward": reward, "done": done}

@app.get("/state")
def get_state():
    global env
    if env is None:
        return {"error": "Environment not initialized. Call /reset first."}
    return env.state()

@app.get("/score")
def get_score():
    global env
    if env is None:
        return {"error": "Environment not initialized."}
    return {"score": env.get_score()}

# ── SERVE FRONTEND ────────────────────────────────────────────────────

# ✅ ROOT → show UI
@app.get("/")
def root():
    return FileResponse("war-room-simulator/frontend/index.html")

# ✅ Serve JS, CSS, etc.
@app.get("/{full_path:path}")
def catch_all(full_path: str):
    candidate = os.path.join("war-room-simulator/frontend", full_path)

    if os.path.exists(candidate) and os.path.isfile(candidate):
        return FileResponse(candidate)

    return FileResponse("war-room-simulator/frontend/index.html")