from datetime import date
import json

class Task:
    def __init__(self, name, start_date=None, complexity=5, last_update=None, end_date=None, progress_log=None, predicted_days=None):
        self.name = name
        self.start_date = start_date if start_date else str(date.today())
        self.complexity = complexity
        self.last_update = last_update if last_update else str(date.today())
        self.end_date = end_date
        self.progress_log = progress_log if progress_log else []
        self.predicted_days = predicted_days

    def log_progress(self, note, log_date=None):
        """Adds a progress note to the task's log."""
        if not log_date:
            log_date = str(date.today())
        self.progress_log.append({"date": log_date, "note": note})
        self.last_update = log_date

    def complete(self):
        """Marks the task as completed and returns the number of days taken."""
        self.end_date = str(date.today())
        self.last_update = self.end_date
        try:
            start = date.fromisoformat(self.start_date)
            end = date.fromisoformat(self.end_date)
            return (end - start).days
        except ValueError:
            return 0

    def days_in_progress(self):
        """Returns how many days the task has been active."""
        try:
            start = date.fromisoformat(self.start_date)
            return (date.today() - start).days
        except ValueError:
            return 0

    def to_dict(self):
        """Converts the task to a dictionary for JSON storage."""
        data = {
            "name": self.name,
            "start_date": self.start_date,
            "complexity": self.complexity,
            "last_update": self.last_update,
            "end_date": self.end_date,
            "progress_log": self.progress_log,
        }
        if self.predicted_days is not None:
            data["predicted_days"] = self.predicted_days
        return data

    @classmethod
    def from_dict(cls, data):
        """Creates a Task instance from a dictionary."""
        return cls(
            name=data["name"],
            start_date=data.get("start_date"),
            complexity=data.get("complexity", 5),
            last_update=data.get("last_update"),
            end_date=data.get("end_date"),
            progress_log=data.get("progress_log"),
            predicted_days=data.get("predicted_days"),
        )

class TaskManager:
    def __init__(self, data_file="tasks.json"):
        self.data_file = data_file
        self.tasks = self.load_tasks()

    def load_tasks(self):
        """Load tasks from a JSON file."""
        try:
            with open(self.data_file, "r") as f:
                data = json.load(f)
                active_tasks = [Task.from_dict(t) for t in data.get("active", [])]
                completed_tasks = data.get("completed", [])
                return {"active": active_tasks, "completed": completed_tasks}
        except (FileNotFoundError, json.JSONDecodeError):
            return {"active": [], "completed": []}

    def save_tasks(self):
        """Save tasks to a JSON file."""
        data = {
            "active": [t.to_dict() for t in self.tasks["active"]],
            "completed": self.tasks["completed"],
        }
        with open(self.data_file, "w") as f:
            json.dump(data, f, indent=4)

    def add_task(self, name, complexity=5, predicted_days=None):
        """Add a new task."""
        if any(task.name.lower() == name.lower() for task in self.tasks["active"]):
            raise ValueError(f"Task with name '{name}' already exists.")

        new_task = Task(name, complexity=complexity, predicted_days=predicted_days)
        self.tasks["active"].append(new_task)
        self.save_tasks()
        return new_task

    def complete_task(self, name):
        """Complete a task."""
        for i, task in enumerate(self.tasks["active"]):
            if task.name.lower() == name.lower():
                days_taken = task.complete()
                completed_record = task.to_dict()
                completed_record["days_taken"] = days_taken
                self.tasks["active"].pop(i)
                self.tasks["completed"].append(completed_record)
                self.save_tasks()
                return completed_record
        raise ValueError(f"Task with name '{name}' not found in active tasks.")

    def reopen_task(self, name):
        """Reopen a completed task."""
        for i, task_dict in enumerate(self.tasks["completed"]):
            if task_dict["name"].lower() == name.lower():
                # Strip completion metadata
                if "end_date" in task_dict:
                    del task_dict["end_date"]
                if "days_taken" in task_dict:
                    del task_dict["days_taken"]
                
                reopened_task = Task.from_dict(task_dict)
                reopened_task.end_date = None
                
                self.tasks["completed"].pop(i)
                self.tasks["active"].append(reopened_task)
                self.save_tasks()
                return reopened_task
        raise ValueError(f"Task with name '{name}' not found in completed tasks.")

    def log_progress(self, name, note, log_date=None):
        """Log progress."""
        for t in self.tasks["active"]:
            if t.name.lower() == name.lower():
                t.log_progress(note, log_date)
                self.save_tasks()
                return t
        raise ValueError(f"Task with name '{name}' not found in active tasks.")
