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
    
    # Auto-seed if the database is completely empty (useful for fresh remote deployments)
    if db.query(models.Task).count() == 0:
        from datetime import datetime, timedelta
        import random
        
        today = datetime.now()
        
        # Seed active tasks
        active_tasks = [
            ("Research AI integrations", 7),
            ("Design new landing page", 5),
            ("Fix navigation bug", 3),
            ("Write API documentation", 6),
            ("Optimize database queries", 8),
            ("Update dependencies", 2)
        ]
        
        for name, complexity in active_tasks:
            predicted = predictor.predict(complexity=complexity) if predictor.is_trained else complexity * 2
            task = models.Task(
                name=name,
                complexity=complexity,
                predicted_days=predicted,
                start_date=today.strftime('%Y-%m-%d'),
                last_update=today.strftime('%Y-%m-%d'),
                progress_log=[{"date": today.strftime('%Y-%m-%d'), "note": "Task initialized via auto-seed."}]
            )
            db.add(task)
            
        # Seed completed tasks
        completed_tasks = [
            ("Setup initial repository", 4),
            ("Configure CI/CD pipeline", 6),
            ("Create user personas", 3),
            ("Draft Q3 roadmap", 5),
            ("Implement OAuth login", 8)
        ]
        
        for name, complexity in completed_tasks:
            predicted = predictor.predict(complexity=complexity) if predictor.is_trained else complexity * 2
            
            if random.random() < 0.8:
                days_taken = max(1, predicted + random.randint(-1, 1))
            else:
                days_taken = max(1, predicted + random.randint(2, 4))
                
            start_date = (today - timedelta(days=days_taken)).strftime('%Y-%m-%d')
            end_date = today.strftime('%Y-%m-%d')
            
            task = models.Task(
                name=name,
                complexity=complexity,
                predicted_days=predicted,
                start_date=start_date,
                last_update=end_date,
                end_date=end_date,
                days_taken=days_taken,
                progress_log=[
                    {"date": start_date, "note": "Started working on task."},
                    {"date": end_date, "note": "Task completed successfully."}
                ]
            )
            db.add(task)
            
        db.commit()
        print("Auto-seeded database with dummy data!")

    # For auto-seeding, we just train the generic "None" model
    predictor.train(db, user_id=None)

import jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
from cryptography.x509 import load_pem_x509_certificate
from cryptography.hazmat.backends import default_backend

# Authentication setup
security = HTTPBearer()

CLERK_ISSUER = os.environ.get("CLERK_ISSUER") # e.g. https://clerk.your-domain.com

# Cache for JWKS
jwks_cache = {}

def get_clerk_public_key(kid: str):
    if kid in jwks_cache:
        return jwks_cache[kid]
    
    if not CLERK_ISSUER:
        return None
        
    try:
        jwks_url = f"{CLERK_ISSUER}/.well-known/jwks.json"
        response = httpx.get(jwks_url)
        response.raise_for_status()
        jwks = response.json()
        
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                # Need to construct PEM from JWK, but PyJWT can decode JWK directly with jwt.algorithms.RSAAlgorithm.from_jwk
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                jwks_cache[kid] = public_key
                return public_key
    except Exception as e:
        print(f"Error fetching JWKS: {e}")
    return None

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        unverified_headers = jwt.get_unverified_header(token)
        kid = unverified_headers.get("kid")
        if not kid:
            raise HTTPException(status_code=401, detail="Invalid token headers")
            
        public_key = get_clerk_public_key(kid)
        if not public_key:
            # Fallback for development if public key fails to fetch but we know it's missing config
            if not CLERK_ISSUER:
                print("WARNING: CLERK_ISSUER not set. Bypassing auth for dev.")
                # Extract user_id without verification (INSECURE - for dev only until keys are set)
                unverified_claims = jwt.decode(token, options={"verify_signature": False})
                return unverified_claims.get("sub")
                
            raise HTTPException(status_code=401, detail="Unable to resolve public key")
            
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER
        )
        return payload.get("sub")
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid authentication token: {str(e)}")

def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not credentials:
        return None
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None

def get_task_manager(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    return TaskManager(db, user_id=user_id)

def background_train_model(user_id: str = None):
    db = next(get_db())
    predictor.train(db, user_id=user_id)

class PredictRequest(BaseModel):
    complexity: int
    start_date: Optional[str] = None
    guest_completed_tasks: Optional[list] = None

class AddTaskRequest(BaseModel):
    name: str
    complexity: int = 5

class PastTaskRequest(BaseModel):
    name: str
    complexity: int
    start_date: str
    days_taken: int

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

    predicted_days = predictor.predict(complexity=req.complexity, user_id=manager.user_id)

    try:
        task = manager.add_task(
            name=req.name.strip(),
            complexity=req.complexity,
            predicted_days=predicted_days,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    return {"name": task.name, "complexity": task.complexity, "predicted_days": task.predicted_days}

@app.post("/tasks/past")
def add_past_task(req: PastTaskRequest, background_tasks: BackgroundTasks, manager: TaskManager = Depends(get_task_manager)):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Task name is required")
    if not (1 <= req.complexity <= 10):
        raise HTTPException(status_code=400, detail="Complexity must be between 1 and 10")
    if req.days_taken < 0:
        raise HTTPException(status_code=400, detail="Days taken cannot be negative")

    predicted_days = predictor.predict(complexity=req.complexity, user_id=manager.user_id)

    try:
        task = manager.add_past_task(
            name=req.name.strip(),
            complexity=req.complexity,
            start_date=req.start_date,
            days_taken=req.days_taken,
            predicted_days=predicted_days,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    background_tasks.add_task(background_train_model, manager.user_id)
    return {"name": task.name, "days_taken": task.days_taken}

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

    background_tasks.add_task(background_train_model, manager.user_id)
    
    return {"name": completed_task.name, "days_taken": completed_task.days_taken}

@app.post("/tasks/{task_name}/reopen")
def reopen_task(task_name: str, manager: TaskManager = Depends(get_task_manager)):
    try:
        task = manager.reopen_task(task_name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {"name": task.name}

@app.post("/predict")
def predict_duration(req: PredictRequest, user_id: str = Depends(get_current_user_optional)):
    if not (1 <= req.complexity <= 10):
        raise HTTPException(status_code=400, detail="Complexity must be between 1 and 10")

    start_date = None
    if req.start_date:
        try:
            start_date = date.fromisoformat(req.start_date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="start_date must be YYYY-MM-DD")

    if req.guest_completed_tasks and len(req.guest_completed_tasks) > 0:
        # Train a temporary model for the guest
        guest_id = "temp_guest"
        predictor.train_on_data(req.guest_completed_tasks, user_id=guest_id)
        days = predictor.predict(complexity=req.complexity, start_date=start_date, user_id=guest_id)
    else:
        # Use the authenticated user's model, or fallback to generic (None)
        days = predictor.predict(complexity=req.complexity, start_date=start_date, user_id=user_id)
        
    return {"predicted_days": days}

@app.post("/report")
def generate_report(req: ReportRequest):
    raw_tasks = [task.model_dump() for task in req.completed_tasks]
    if len(raw_tasks) == 0:
        raise HTTPException(status_code=400, detail="No completed tasks provided")
        
    report_data = generate_productivity_report(completed_tasks=raw_tasks)
    return report_data
