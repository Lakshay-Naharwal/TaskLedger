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

## Persistent Deployment (Render + Neon.tech)

TaskLedger AI can be deployed entirely for free, but requires a specific setup to maintain data persistence since free tier hosting providers often use ephemeral disks that delete local SQLite files upon spin-down.

### 1. Database (Neon.tech)
1. Create a free Serverless Postgres database on [Neon.tech](https://neon.tech/).
2. Copy the provided connection string (it should look like `postgres://...`).

### 2. Backend (Render)
1. Create a new **Web Service** on [Render](https://render.com/).
2. Connect your repository.
3. Add the following Environment Variables:
   - `DATABASE_URL`: Paste your Neon.tech connection string.
   - `FRONTEND_URL`: The URL where your Next.js app will be hosted.
4. Render will automatically detect the Python environment and run `app.py` or you can explicitly run `uvicorn api.main:app --host 0.0.0.1 --port 10000`.

### 3. Frontend (Vercel or Render)
1. Deploy the `frontend/` directory to Vercel or as a Static Site on Render.
2. Ensure you set the `NEXT_PUBLIC_API_URL` environment variable to point to your deployed Render backend.
