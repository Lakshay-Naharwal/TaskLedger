'use client';

export interface Task {
  name: string;
  start_date: string;
  complexity: number;
  last_update: string;
  end_date: string | null;
  progress_log: ProgressLog[];
  days_taken?: number;
  predicted_days?: number;
}

export interface ProgressLog {
  date: string;
  note: string;
}

export interface TaskLedger {
  active: Task[];
  completed: Task[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const taskPath = (taskName: string, action: string) =>
  `${API_URL}/tasks/${encodeURIComponent(taskName)}/${action}`;

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? `Request failed with ${response.status}`);
  }

  return response.json();
}

export const getTasks = () => requestJson<TaskLedger>(`${API_URL}/tasks`);

export const addTask = (name: string, complexity: number) =>
  requestJson<Task>(`${API_URL}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ name, complexity }),
  });

export const logProgress = (taskName: string, note: string) =>
  requestJson<Task>(taskPath(taskName, 'logs'), {
    method: 'POST',
    body: JSON.stringify({ note }),
  });

export const completeTask = (taskName: string) =>
  requestJson<Task>(taskPath(taskName, 'complete'), { method: 'POST' });

export const reopenTask = (taskName: string) =>
  requestJson<Task>(taskPath(taskName, 'reopen'), { method: 'POST' });

export const predictDuration = (complexity: number) =>
  requestJson<{ predicted_days: number }>(`${API_URL}/predict`, {
    method: 'POST',
    body: JSON.stringify({ complexity }),
  });

export const generateReport = (completedTasks: Task[]) =>
  requestJson<{ image_base64: string }>(`${API_URL}/report`, {
    method: 'POST',
    body: JSON.stringify({ completed_tasks: completedTasks }),
  });
