import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from api.analytics import generate_productivity_report
from api.core import TaskManager
from api.ml_model import TaskDurationPredictor
from api.database import Base
from api.models import Task

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    yield db
    db.close()

def test_task_manager_adds_task_with_prediction(db_session):
    manager = TaskManager(db_session)
    task = manager.add_task("Test Task", complexity=8, predicted_days=4)

    assert task.name == "Test Task"
    assert task.complexity == 8
    assert task.predicted_days == 4
    assert len(manager.get_active_tasks()) == 1

    with pytest.raises(ValueError):
        manager.add_task("Test Task")

def test_task_manager_logs_completes_and_reopens(db_session):
    manager = TaskManager(db_session)
    manager.add_task("Test Task", complexity=5)

    logged = manager.log_progress("Test Task", "Initial progress update")
    assert len(logged.progress_log) == 1
    assert logged.progress_log[0]["note"] == "Initial progress update"

    completed = manager.complete_task("Test Task")
    assert completed.end_date is not None
    assert completed.days_taken >= 0
    assert len(manager.get_active_tasks()) == 0
    assert len(manager.get_completed_tasks()) == 1

    reopened = manager.reopen_task("Test Task")
    assert reopened.end_date is None
    assert len(manager.get_active_tasks()) == 1
    assert len(manager.get_completed_tasks()) == 0

def test_task_duration_predictor_fallback_for_empty_data(db_session):
    predictor = TaskDurationPredictor()
    assert predictor.train(db_session) is False
    assert predictor.predict(8) == 4

def test_task_duration_predictor_trains_from_completed_tasks(db_session):
    db_session.add(Task(name="A", start_date="2026-07-01", complexity=2, end_date="2026-07-03", days_taken=2))
    db_session.add(Task(name="B", start_date="2026-07-02", complexity=4, end_date="2026-07-07", days_taken=5))
    db_session.add(Task(name="C", start_date="2026-07-03", complexity=8, end_date="2026-07-13", days_taken=10))
    db_session.commit()

    predictor = TaskDurationPredictor()
    assert predictor.train(db_session) is True
    assert predictor.predict(6) >= 0

def test_analytics_empty_data_returns_empty_json():
    report = generate_productivity_report([])
    assert report == {"complexity_data": [], "day_data": []}
