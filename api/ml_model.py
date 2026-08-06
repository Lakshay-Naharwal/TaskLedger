import json
import numpy as np
from datetime import date
from sklearn.ensemble import RandomForestRegressor
from sklearn.exceptions import NotFittedError

class TaskDurationPredictor:
    def __init__(self, data_file="tasks.json"):
        self.data_file = data_file
        self.model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.is_trained = False

    def _extract_features(self, task_dict):
        """Extracts features from a task dictionary."""
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
            
        return [complexity, day_of_week]

    def train(self):
        """Trains the model on completed tasks."""
        try:
            with open(self.data_file, "r") as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return False

        completed_tasks = data.get("completed", [])
        if len(completed_tasks) < 3: # Need at least a few tasks to train
            return False

        X = []
        y = []
        for task in completed_tasks:
            # We need a days_taken target
            days_taken = task.get("days_taken")
            if days_taken is not None:
                features = self._extract_features(task)
                X.append(features)
                y.append(days_taken)

        if len(X) < 3:
            return False

        self.model.fit(X, y)
        self.is_trained = True
        return True

    def predict(self, complexity, start_date=None):
        """Predicts the number of days to complete a task."""
        if not self.is_trained:
            # Fallback heuristic if model isn't trained
            return max(1, int(complexity * 0.5))
            
        if start_date is None:
            start_date = date.today()
            
        day_of_week = start_date.weekday()
        features = np.array([[complexity, day_of_week]])
        
        try:
            prediction = self.model.predict(features)[0]
            return max(0, int(round(prediction))) # Can't take negative days
        except NotFittedError:
            return max(1, int(complexity * 0.5))

if __name__ == "__main__":
    predictor = TaskDurationPredictor()
    trained = predictor.train()
    print(f"Model trained: {trained}")
    
    pred_days = predictor.predict(complexity=8)
    print(f"Predicted days for complexity 8: {pred_days}")
