import numpy as np
from datetime import date
from sklearn.ensemble import RandomForestRegressor
from sklearn.exceptions import NotFittedError
from sqlalchemy.orm import Session
from api.models import Task

class TaskDurationPredictor:
    def __init__(self):
        # We store models per user_id. For guests, we can use a temporary model.
        self.models = {}

    def _get_model(self, user_id=None):
        if user_id not in self.models:
            self.models[user_id] = {
                "model": RandomForestRegressor(n_estimators=100, random_state=42),
                "is_trained": False
            }
        return self.models[user_id]

    def _extract_features(self, task):
        """Extracts features from a task."""
        complexity = task.complexity or 5
        
        start_date_str = task.start_date
        if start_date_str:
            try:
                start_date = date.fromisoformat(start_date_str)
                day_of_week = start_date.weekday()
            except ValueError:
                day_of_week = 0
        else:
            day_of_week = date.today().weekday()
            
        return [complexity, day_of_week]

    def train(self, db: Session, user_id: str = None):
        """Trains the model on completed tasks for a specific user."""
        query = db.query(Task).filter(Task.end_date != None)
        if user_id is not None:
            query = query.filter(Task.user_id == user_id)
            
        completed_tasks = query.all()
        user_model = self._get_model(user_id)
        
        if len(completed_tasks) < 3: # Need at least a few tasks to train
            user_model["is_trained"] = False
            return False

        X = []
        y = []
        for task in completed_tasks:
            # We need a days_taken target
            if task.days_taken is not None:
                features = self._extract_features(task)
                X.append(features)
                y.append(task.days_taken)

        if len(X) < 3:
            user_model["is_trained"] = False
            return False

        user_model["model"].fit(X, y)
        user_model["is_trained"] = True
        return True

    def train_on_data(self, completed_tasks: list, user_id: str = "guest"):
        """Trains a model directly on a list of raw task dicts (useful for guests)."""
        user_model = self._get_model(user_id)
        if len(completed_tasks) < 3:
            user_model["is_trained"] = False
            return False
            
        X = []
        y = []
        for task_dict in completed_tasks:
            days_taken = task_dict.get("days_taken")
            if days_taken is not None:
                complexity = task_dict.get("complexity", 5)
                start_date_str = task_dict.get("start_date")
                
                if start_date_str:
                    try:
                        start_date = date.fromisoformat(start_date_str)
                        day_of_week = start_date.weekday()
                    except ValueError:
                        day_of_week = 0
                else:
                    day_of_week = date.today().weekday()
                    
                X.append([complexity, day_of_week])
                y.append(days_taken)
                
        if len(X) < 3:
            user_model["is_trained"] = False
            return False
            
        user_model["model"].fit(X, y)
        user_model["is_trained"] = True
        return True

    def predict(self, complexity, start_date=None, user_id: str = None):
        """Predicts the number of days to complete a task."""
        user_model = self._get_model(user_id)
        
        if not user_model["is_trained"]:
            # Fallback heuristic if model isn't trained
            return max(1, int(complexity * 0.5))
            
        if start_date is None:
            start_date = date.today()
            
        day_of_week = start_date.weekday()
        features = np.array([[complexity, day_of_week]])
        
        try:
            prediction = user_model["model"].predict(features)[0]
            return max(0, int(round(prediction))) # Can't take negative days
        except NotFittedError:
            return max(1, int(complexity * 0.5))
