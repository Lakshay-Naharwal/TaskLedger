from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from typing import Optional
import os

from api.database import get_db, engine
from api import models
from api.core import TaskManager
from api.ml_model import TaskDurationPredictor
from api.analytics import generate_productivity_report

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="TaskLedger AI API")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

predictor = TaskDurationPredictor()

@app.on_event("startup")
def startup_event():
    # Attempt to train the model on startup with a fresh DB session
    db = next(get_db())
    predictor.train(db)

def get_task_manager(db: Session = Depends(get_db)):
    return TaskManager(db)

def background_train_model():
    db = next(get_db())
    predictor.train(db)

class PredictRequest(BaseModel):
    complexity: int
    start_date: Optional[str] = None

class AddTaskRequest(BaseModel):
    name: str
    complexity: int = 5

class ProgressLogRequest(BaseModel):
    note: str
    log_date: Optional[str] = None

class TaskItem(BaseModel):
    name: str
    start_date: str
    complexity: int
    last_update: str
    end_date: Optional[str] = None
    progress_log: list
    days_taken: Optional[int] = None
    predicted_days: Optional[int] = None

class ReportRequest(BaseModel):
    completed_tasks: list[TaskItem]

@app.get("/")
def health_check():
    return {"status": "ok", "model_trained": predictor.is_trained}

@app.get("/tasks")
def list_tasks(manager: TaskManager = Depends(get_task_manager)):
    active = [{"name": t.name, "start_date": t.start_date, "complexity": t.complexity, "last_update": t.last_update, "end_date": t.end_date, "progress_log": t.progress_log, "predicted_days": t.predicted_days} for t in manager.get_active_tasks()]
    completed = [{"name": t.name, "start_date": t.start_date, "complexity": t.complexity, "last_update": t.last_update, "end_date": t.end_date, "progress_log": t.progress_log, "days_taken": t.days_taken, "predicted_days": t.predicted_days} for t in manager.get_completed_tasks()]
    
    return {
        "active": active,
        "completed": completed,
    }

@app.post("/tasks")
def add_task(req: AddTaskRequest, manager: TaskManager = Depends(get_task_manager)):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Task name is required")
    if not (1 <= req.complexity <= 10):
        raise HTTPException(status_code=400, detail="Complexity must be between 1 and 10")

    predicted_days = predictor.predict(complexity=req.complexity)

    try:
        task = manager.add_task(
            name=req.name.strip(),
            complexity=req.complexity,
            predicted_days=predicted_days,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    return {"name": task.name, "complexity": task.complexity, "predicted_days": task.predicted_days}

@app.post("/tasks/{task_name}/logs")
def log_task_progress(task_name: str, req: ProgressLogRequest, manager: TaskManager = Depends(get_task_manager)):
    if not req.note.strip():
        raise HTTPException(status_code=400, detail="Progress note is required")

    try:
        task = manager.log_progress(task_name, req.note.strip(), req.log_date)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {"name": task.name, "last_update": task.last_update}

@app.post("/tasks/{task_name}/complete")
def complete_task(task_name: str, background_tasks: BackgroundTasks, manager: TaskManager = Depends(get_task_manager)):
    try:
        completed_task = manager.complete_task(task_name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    background_tasks.add_task(background_train_model)
    
    return {"name": completed_task.name, "days_taken": completed_task.days_taken}

@app.post("/tasks/{task_name}/reopen")
def reopen_task(task_name: str, manager: TaskManager = Depends(get_task_manager)):
    try:
        task = manager.reopen_task(task_name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {"name": task.name}

@app.post("/predict")
def predict_duration(req: PredictRequest):
    if not (1 <= req.complexity <= 10):
        raise HTTPException(status_code=400, detail="Complexity must be between 1 and 10")

    start_date = None
    if req.start_date:
        try:
            start_date = date.fromisoformat(req.start_date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="start_date must be YYYY-MM-DD")

    days = predictor.predict(complexity=req.complexity, start_date=start_date)
    return {"predicted_days": days}

@app.post("/report")
def generate_report(req: ReportRequest):
    raw_tasks = [task.model_dump() for task in req.completed_tasks]
    if len(raw_tasks) == 0:
        raise HTTPException(status_code=400, detail="No completed tasks provided")
        
    report_data = generate_productivity_report(completed_tasks=raw_tasks)
    return report_data
