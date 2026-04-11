import os

def log_step(step, action, reward):
    if os.getenv("ENABLE_LOGS", "false") == "true":
        print(f"[LOG] Step={step} | Action={action} | Reward={reward}")