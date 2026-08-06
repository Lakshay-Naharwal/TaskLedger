from datetime import date
from sqlalchemy.orm import Session
from api.models import Task as DBTask

class TaskManager:
    def __init__(self, db: Session):
        self.db = db

    def get_active_tasks(self):
        return self.db.query(DBTask).filter(DBTask.end_date == None).all()

    def get_completed_tasks(self):
        return self.db.query(DBTask).filter(DBTask.end_date != None).all()

    def add_task(self, name: str, complexity: int = 5, predicted_days: int = None):
        existing = self.db.query(DBTask).filter(DBTask.name.ilike(name), DBTask.end_date == None).first()
        if existing:
            raise ValueError(f"Task with name '{name}' already exists.")

        new_task = DBTask(
            name=name,
            complexity=complexity,
            predicted_days=predicted_days,
            start_date=str(date.today()),
            last_update=str(date.today()),
            progress_log=[]
        )
        self.db.add(new_task)
        self.db.commit()
        self.db.refresh(new_task)
        return new_task

    def complete_task(self, name: str):
        task = self.db.query(DBTask).filter(DBTask.name.ilike(name), DBTask.end_date == None).first()
        if not task:
            raise ValueError(f"Task with name '{name}' not found in active tasks.")
        
        task.end_date = str(date.today())
        task.last_update = task.end_date
        
        try:
            start = date.fromisoformat(task.start_date)
            end = date.fromisoformat(task.end_date)
            task.days_taken = (end - start).days
        except ValueError:
            task.days_taken = 0
            
        self.db.commit()
        self.db.refresh(task)
        return task

    def reopen_task(self, name: str):
        task = self.db.query(DBTask).filter(DBTask.name.ilike(name), DBTask.end_date != None).first()
        if not task:
            raise ValueError(f"Task with name '{name}' not found in completed tasks.")
            
        task.end_date = None
        task.days_taken = None
        task.last_update = str(date.today())
        self.db.commit()
        self.db.refresh(task)
        return task

    def log_progress(self, name: str, note: str, log_date: str = None):
        task = self.db.query(DBTask).filter(DBTask.name.ilike(name), DBTask.end_date == None).first()
        if not task:
            raise ValueError(f"Task with name '{name}' not found in active tasks.")
            
        if not log_date:
            log_date = str(date.today())
            
        new_log = {"date": log_date, "note": note}
        
        if not task.progress_log:
            task.progress_log = []
            
        current_logs = list(task.progress_log)
        current_logs.append(new_log)
        task.progress_log = current_logs
        
        task.last_update = log_date
        self.db.commit()
        self.db.refresh(task)
        return task
