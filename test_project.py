import json

import pytest

from api.analytics import generate_productivity_report
from api.core import Task, TaskManager
from api.ml_model import TaskDurationPredictor


def test_task_manager_adds_task_with_prediction(tmp_path):
    data_file = tmp_path / "tasks.json"
    manager = TaskManager(data_file=str(data_file))

    task = manager.add_task("Test Task", complexity=8, predicted_days=4)

    assert task.name == "Test Task"
    assert task.complexity == 8
    assert task.predicted_days == 4
    assert len(manager.tasks["active"]) == 1

    reloaded = TaskManager(data_file=str(data_file))
    assert reloaded.tasks["active"][0].predicted_days == 4

    with pytest.raises(ValueError):
        manager.add_task("Test Task")


def test_task_manager_logs_completes_and_reopens(tmp_path):
    data_file = tmp_path / "tasks.json"
    manager = TaskManager(data_file=str(data_file))
    manager.add_task("Test Task", complexity=5)

    logged = manager.log_progress("Test Task", "Initial progress update")
    assert logged.progress_log == [
        {"date": logged.last_update, "note": "Initial progress update"}
    ]

    completed = manager.complete_task("Test Task")
    assert completed["end_date"] is not None
    assert completed["days_taken"] >= 0
    assert len(manager.tasks["active"]) == 0
    assert len(manager.tasks["completed"]) == 1

    reopened = manager.reopen_task("Test Task")
    assert reopened.end_date is None
    assert len(manager.tasks["active"]) == 1
    assert len(manager.tasks["completed"]) == 0


def test_task_duration_predictor_fallback_for_empty_data():
    predictor = TaskDurationPredictor("dummy_file_that_doesnt_exist.json")

    assert predictor.train() is False
    assert predictor.predict(8) == 4


def test_task_duration_predictor_trains_from_completed_tasks(tmp_path):
    data_file = tmp_path / "tasks.json"
    data_file.write_text(
        json.dumps(
            {
                "active": [],
                "completed": [
                    Task("A", "2026-07-01", complexity=2).to_dict()
                    | {"end_date": "2026-07-03", "days_taken": 2},
                    Task("B", "2026-07-02", complexity=4).to_dict()
                    | {"end_date": "2026-07-07", "days_taken": 5},
                    Task("C", "2026-07-03", complexity=8).to_dict()
                    | {"end_date": "2026-07-13", "days_taken": 10},
                ],
            }
        )
    )

    predictor = TaskDurationPredictor(str(data_file))

    assert predictor.train() is True
    assert predictor.predict(6) >= 0


def test_analytics_empty_data_returns_false():
    assert generate_productivity_report("dummy_file_that_doesnt_exist.json") is False
