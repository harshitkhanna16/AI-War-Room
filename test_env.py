from backend.env.env import WarRoomEnv

for task in ["easy", "medium", "hard"]:
    print(f"\n===== TESTING {task.upper()} TASK =====")

    env = WarRoomEnv(task_name=task)
    state = env.reset()

    print("Initial State:", state)

    for step in range(10):
        action = ["block cyber", "intercept drone"]

        state, reward, done, _ = env.step(action)

        print(f"\nStep {step+1}")
        print("State:", state)
        print("Reward:", reward)

        if done:
            break