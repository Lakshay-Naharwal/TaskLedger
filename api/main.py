from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import date
from typing import Optional
import os

from api.core import TaskManager
from api.ml_model import TaskDurationPredictor
from api.analytics import generate_productivity_report

app = FastAPI(title="TaskLedger AI API")

# Enable CORS so Vercel can talk to us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize and train the ML model on startup with seed data
# We look for tasks.json in the parent directory (or current directory if deployed)
DATA_FILE = os.environ.get("DATA_FILE", "../tasks.json")
if not os.path.exists(DATA_FILE) and os.path.exists("tasks.json"):
    DATA_FILE = "tasks.json"

predictor = TaskDurationPredictor(data_file=DATA_FILE)
predictor.train()

def get_task_manager():
    return TaskManager(data_file=DATA_FILE)

# Models
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
    end_date: str
    progress_log: list
    days_taken: int
    predicted_days: Optional[int] = None

class ReportRequest(BaseModel):
    completed_tasks: list[TaskItem]

@app.get("/")
def health_check():
    return {"status": "ok", "model_trained": predictor.is_trained}

@app.get("/tasks")
def list_tasks():
    manager = get_task_manager()
    return {
        "active": [task.to_dict() for task in manager.tasks["active"]],
        "completed": manager.tasks["completed"],
    }

@app.post("/tasks")
def add_task(req: AddTaskRequest):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Task name is required")
    if not (1 <= req.complexity <= 10):
        raise HTTPException(status_code=400, detail="Complexity must be between 1 and 10")

    manager = get_task_manager()
    predicted_days = predictor.predict(complexity=req.complexity)

    try:
        task = manager.add_task(
            name=req.name.strip(),
            complexity=req.complexity,
            predicted_days=predicted_days,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return task.to_dict()

@app.post("/tasks/{task_name}/logs")
def log_task_progress(task_name: str, req: ProgressLogRequest):
    if not req.note.strip():
        raise HTTPException(status_code=400, detail="Progress note is required")

    manager = get_task_manager()
    try:
        task = manager.log_progress(task_name, req.note.strip(), req.log_date)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return task.to_dict()

@app.post("/tasks/{task_name}/complete")
def complete_task(task_name: str):
    manager = get_task_manager()
    try:
        completed_task = manager.complete_task(task_name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    predictor.train()
    return completed_task

@app.post("/tasks/{task_name}/reopen")
def reopen_task(task_name: str):
    manager = get_task_manager()
    try:
        task = manager.reopen_task(task_name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return task.to_dict()

@app.post("/predict")
def predict_duration(req: PredictRequest):
    if not (1 <= req.complexity <= 10):
        raise HTTPException(status_code=400, detail="Complexity must be between 1 and 10")

    start_date = None
    if req.start_date:
        try:
            start_date = date.fromisoformat(req.start_date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="start_date must be YYYY-MM-DD") from exc

    days = predictor.predict(complexity=req.complexity, start_date=start_date)
    
    return {"predicted_days": days}

@app.post("/report")
def generate_report(req: ReportRequest):
    raw_tasks = [task.model_dump() for task in req.completed_tasks]
    if len(raw_tasks) == 0:
        raise HTTPException(status_code=400, detail="No completed tasks provided")
        
    img_base64 = generate_productivity_report(raw_tasks=raw_tasks, return_base64=True)
    if not img_base64:
        raise HTTPException(status_code=500, detail="Failed to generate report")
        
    return {"image_base64": img_base64}
