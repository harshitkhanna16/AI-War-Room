from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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

@app.get("/")
def root():
    return {"status": "running"}

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

# Serves /assets/audios/beep.mp3 etc.
app.mount("/assets", StaticFiles(directory="frontend/assets"), name="assets")

@app.get("/app")
def serve_frontend():
    return FileResponse("frontend/index.html")

# ✅ Catch-all: handles script.js, style.css, and everything else
@app.get("/{full_path:path}")
def catch_all(full_path: str):
    # Skip API-like paths to avoid shadowing (safety net)
    candidate = os.path.join("frontend", full_path)
    if os.path.exists(candidate) and os.path.isfile(candidate):
        return FileResponse(candidate)
    # Fallback: always serve index.html (SPA behavior)
    return FileResponse("frontend/index.html")