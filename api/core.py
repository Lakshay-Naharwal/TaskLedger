from datetime import date
from sqlalchemy.orm import Session
from api.models import Task as DBTask

class TaskManager:
    def __init__(self, db: Session, user_id: str = None):
        self.db = db
        self.user_id = user_id

    def get_active_tasks(self):
        query = self.db.query(DBTask).filter(DBTask.end_date == None)
        if self.user_id:
            query = query.filter(DBTask.user_id == self.user_id)
        return query.all()

    def get_completed_tasks(self):
        query = self.db.query(DBTask).filter(DBTask.end_date != None)
        if self.user_id:
            query = query.filter(DBTask.user_id == self.user_id)
        return query.all()

    def add_task(self, name: str, complexity: int = 5, predicted_days: int = None):
        query = self.db.query(DBTask).filter(DBTask.name.ilike(name), DBTask.end_date == None)
        if self.user_id:
            query = query.filter(DBTask.user_id == self.user_id)
        
        existing = query.first()
        if existing:
            raise ValueError(f"Task with name '{name}' already exists.")

        new_task = DBTask(
            name=name,
            user_id=self.user_id,
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

    def add_past_task(self, name: str, complexity: int, start_date: str, days_taken: int, predicted_days: int = None):
        query = self.db.query(DBTask).filter(DBTask.name.ilike(name))
        if self.user_id:
            query = query.filter(DBTask.user_id == self.user_id)
            
        existing = query.first()
        if existing:
            raise ValueError(f"Task with name '{name}' already exists.")

        try:
            from datetime import timedelta
            s_date = date.fromisoformat(start_date)
            end_date = s_date + timedelta(days=days_taken)
        except ValueError:
            raise ValueError("Invalid start_date format. Must be YYYY-MM-DD")

        new_task = DBTask(
            name=name,
            user_id=self.user_id,
            complexity=complexity,
            predicted_days=predicted_days,
            start_date=start_date,
            last_update=str(end_date),
            end_date=str(end_date),
            days_taken=days_taken,
            progress_log=[
                {"date": start_date, "note": "Task started (historical)"},
                {"date": str(end_date), "note": "Task completed (historical)"}
            ]
        )
        self.db.add(new_task)
        self.db.commit()
        self.db.refresh(new_task)
        return new_task

    def complete_task(self, name: str):
        query = self.db.query(DBTask).filter(DBTask.name.ilike(name), DBTask.end_date == None)
        if self.user_id:
            query = query.filter(DBTask.user_id == self.user_id)
            
        task = query.first()
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
        query = self.db.query(DBTask).filter(DBTask.name.ilike(name), DBTask.end_date != None)
        if self.user_id:
            query = query.filter(DBTask.user_id == self.user_id)
            
        task = query.first()
        if not task:
            raise ValueError(f"Task with name '{name}' not found in completed tasks.")
            
        task.end_date = None
        task.days_taken = None
        task.last_update = str(date.today())
        self.db.commit()
        self.db.refresh(task)
        return task

    def log_progress(self, name: str, note: str, log_date: str = None):
        query = self.db.query(DBTask).filter(DBTask.name.ilike(name), DBTask.end_date == None)
        if self.user_id:
            query = query.filter(DBTask.user_id == self.user_id)
            
        task = query.first()
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
