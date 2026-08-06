import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tabulate import tabulate
import json

from api.analytics import generate_productivity_report
from api.core import TaskManager
from api.ml_model import TaskDurationPredictor
from api.database import engine, get_db
from api import models

def main():
    models.Base.metadata.create_all(bind=engine)
    db = next(get_db())
    manager = TaskManager(db)
    predictor = TaskDurationPredictor()
    predictor.train(db)

    print("-----Welcome to the Task Ledger!-----")

    while True:
        print("\nMenu:")
        print("1. Add Task")
        print("2. Log Progress")
        print("3. Complete Task")
        print("4. View Active Tasks")
        print("5. View a task's progress log")
        print("6. View Completed Tasks")
        print("7. Generate Productivity Report (JSON)")
        print("8. Exit")

        choice = input("Enter your choice: ")

        match choice:
            case "1":
                name = input("Enter task name: ")
                complexity_str = input("Enter estimated complexity (1-10) [5]: ")
                try:
                    complexity = int(complexity_str) if complexity_str.strip() else 5
                    if not (1 <= complexity <= 10):
                        print("Complexity must be between 1 and 10.")
                        continue
                except ValueError:
                    print("Invalid complexity, using default of 5.")
                    complexity = 5

                predicted_days = predictor.predict(complexity)
                try:
                    manager.add_task(name, complexity=complexity, predicted_days=predicted_days)
                    print(f"Task '{name}' added successfully.")
                    print(
                        f"  -> ML Prediction: This task will take approximately {predicted_days} days."
                    )
                except ValueError as exc:
                    print(exc)

            case "2":
                name = input("Enter task name to log progress: ")
                note = input("Enter progress note: ")
                try:
                    manager.log_progress(name, note)
                    print(f"Progress logged for task '{name}'.")
                except ValueError as exc:
                    print(exc)

            case "3":
                name = input("Enter task name to complete: ")
                try:
                    manager.complete_task(name)
                    predictor.train(db)
                    print(f"Task '{name}' marked as complete.")
                except ValueError as exc:
                    print(exc)

            case "4":
                active_tasks = manager.get_active_tasks()
                if not active_tasks:
                    print("No active tasks.")
                else:
                    table_data = [
                        {
                            "Name": task.name,
                            "Complexity": task.complexity,
                            "Started on": task.start_date,
                            "Last updated": task.last_update,
                            "Predicted days": task.predicted_days,
                        }
                        for task in active_tasks
                    ]
                    print("\n-----Active Tasks-----")
                    print(tabulate(table_data, headers="keys", tablefmt="grid"))

            case "5":
                name = input("Enter task name to view progress log: ")
                task = next(
                    (task for task in manager.get_active_tasks() if task.name.lower() == name.lower()),
                    None,
                )
                if task is None:
                    print(f"Task '{name}' not found.")
                elif not task.progress_log:
                    print(f"No progress log available for task '{name}'.")
                else:
                    print(f"\nProgress Log for Task '{name}':")
                    print(tabulate(task.progress_log, headers="keys", tablefmt="grid"))

            case "6":
                completed_tasks = manager.get_completed_tasks()
                if not completed_tasks:
                    print("No completed tasks.")
                else:
                    table_data = [
                        {
                            "Name": task.name,
                            "Complexity": task.complexity,
                            "Started on": task.start_date,
                            "End date": task.end_date,
                            "Days taken": task.days_taken,
                            "Predicted days": task.predicted_days,
                        }
                        for task in completed_tasks
                    ]
                    print("\n-----Completed Tasks-----")
                    print(tabulate(table_data, headers="keys", tablefmt="grid"))

            case "7":
                print("Generating productivity report...")
                completed_tasks = [
                    {
                        "name": task.name,
                        "complexity": task.complexity,
                        "start_date": task.start_date,
                        "end_date": task.end_date,
                        "days_taken": task.days_taken,
                        "predicted_days": task.predicted_days,
                    }
                    for task in manager.get_completed_tasks()
                ]
                report = generate_productivity_report(completed_tasks)
                print(json.dumps(report, indent=2))

            case "8":
                print("Exiting Task Manager. Goodbye!")
                break

            case _:
                print("Invalid choice. Please try again.")

if __name__ == "__main__":
    main()
