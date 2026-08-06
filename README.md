---
title: TaskLedger AI
emoji: 📝
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
---

# TaskLedger AI

TaskLedger AI is a Python-first task tracker that uses FastAPI, a small machine
learning model, and a Next.js dashboard.

The Python backend owns the task ledger, predictions, completion/reopen logic,
progress logs, and productivity chart generation. The frontend is a thin client
that calls those API endpoints.

## Features

- Add active tasks with a complexity score.
- Predict estimated completion time from completed task history.
- Log progress notes against active tasks.
- Complete and reopen tasks through the Python API.
- Generate a productivity report chart from completed tasks.
- Use the same Python domain logic from the API and CLI.

## Tech Stack

- Python
- FastAPI
- scikit-learn
- pandas
- Next.js
- TypeScript
- Tailwind CSS
- Recharts

## Run Locally

Install Python dependencies:

```powershell
pip install -r requirements.txt
```

Start the backend:

```powershell
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open:

- Frontend: http://localhost:3000
- API docs: http://127.0.0.1:8000/docs

## CLI

```powershell
python cli/project.py
```

## Checks

```powershell
python -m pytest -q
cd frontend
npm run lint
npm run build
```
