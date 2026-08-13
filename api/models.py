from sqlalchemy import Column, Integer, String, JSON
from api.database import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=True) # Nullable for guest/legacy tasks
    name = Column(String, index=True)
    start_date = Column(String)
    complexity = Column(Integer, default=5)
    last_update = Column(String)
    end_date = Column(String, nullable=True)
    progress_log = Column(JSON, default=list)
    predicted_days = Column(Integer, nullable=True)
    days_taken = Column(Integer, nullable=True)
