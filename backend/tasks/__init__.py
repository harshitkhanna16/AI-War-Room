from backend.tasks.task_easy import get_task as easy_task
from backend.tasks.task_medium import get_task as medium_task
from backend.tasks.task_hard import get_task as hard_task


def get_all_tasks():
    return {
        "easy": easy_task(),
        "medium": medium_task(),
        "hard": hard_task()
    }


def get_task_by_name(name):
    tasks = get_all_tasks()
    return tasks.get(name, tasks["easy"])