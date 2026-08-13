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

export interface ReportData {
  complexity_data: { complexity: number; days_taken: number }[];
  day_data: { day: string; count: number }[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const taskPath = (taskName: string, action: string) =>
  `${API_URL}/tasks/${encodeURIComponent(taskName)}/${action}`;

// Local storage keys
const GUEST_ACTIVE_TASKS = 'taskledger_guest_active';
const GUEST_COMPLETED_TASKS = 'taskledger_guest_completed';

export const createTaskApi = (getToken: () => Promise<string | null>, isGuest: boolean) => {
  const getHeaders = async () => {
    const token = await getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const requestJson = async <T>(url: string, options?: RequestInit): Promise<T> => {
    const headers = await getHeaders();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.detail ?? `Request failed with ${response.status}`);
    }

    return response.json();
  };

  const getLocalTasks = (): TaskLedger => {
    if (typeof window === 'undefined') return { active: [], completed: [] };
    
    let active = JSON.parse(localStorage.getItem(GUEST_ACTIVE_TASKS) || 'null');
    let completed = JSON.parse(localStorage.getItem(GUEST_COMPLETED_TASKS) || 'null');
    
    // Seed dummy data if guest store is completely empty
    if (!active && !completed) {
      const today = new Date();
      const past = new Date(today);
      past.setDate(past.getDate() - 3);
      
      const todayStr = today.toISOString().split('T')[0];
      const pastStr = past.toISOString().split('T')[0];

      active = [
        { name: "Explore App Features", complexity: 3, start_date: todayStr, last_update: todayStr, end_date: null, progress_log: [] },
        { name: "Plan my week", complexity: 6, start_date: todayStr, last_update: todayStr, end_date: null, progress_log: [] }
      ];
      completed = [
        { name: "Create an account or use guest mode", complexity: 1, start_date: pastStr, last_update: todayStr, end_date: todayStr, days_taken: 3, progress_log: [] },
        { name: "Review basic tutorial", complexity: 2, start_date: pastStr, last_update: todayStr, end_date: todayStr, days_taken: 1, progress_log: [] },
        { name: "Set up workspace", complexity: 4, start_date: pastStr, last_update: todayStr, end_date: todayStr, days_taken: 2, progress_log: [] }
      ];
      
      localStorage.setItem(GUEST_ACTIVE_TASKS, JSON.stringify(active));
      localStorage.setItem(GUEST_COMPLETED_TASKS, JSON.stringify(completed));
    }
    
    return { active: active || [], completed: completed || [] };
  };

  const saveLocalTasks = (data: TaskLedger) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(GUEST_ACTIVE_TASKS, JSON.stringify(data.active));
    localStorage.setItem(GUEST_COMPLETED_TASKS, JSON.stringify(data.completed));
  };

  return {
    getTasks: async (): Promise<TaskLedger> => {
      if (isGuest) return getLocalTasks();
      return requestJson<TaskLedger>(`${API_URL}/tasks`);
    },

    addTask: async (name: string, complexity: number): Promise<Task> => {
      if (isGuest) {
        const data = getLocalTasks();
        if (data.active.some(t => t.name === name) || data.completed.some(t => t.name === name)) {
          throw new Error("Task already exists");
        }
        const today = new Date().toISOString().split('T')[0];
        const newTask: Task = {
          name,
          complexity,
          start_date: today,
          last_update: today,
          end_date: null,
          progress_log: []
        };
        data.active.push(newTask);
        saveLocalTasks(data);
        return newTask;
      }
      return requestJson<Task>(`${API_URL}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ name, complexity }),
      });
    },

    addPastTask: async (name: string, complexity: number, start_date: string, days_taken: number): Promise<Task> => {
      if (isGuest) {
        const data = getLocalTasks();
        if (data.active.some(t => t.name === name) || data.completed.some(t => t.name === name)) {
          throw new Error("Task already exists");
        }
        const start = new Date(start_date);
        const end = new Date(start);
        end.setDate(end.getDate() + days_taken);
        const endStr = end.toISOString().split('T')[0];
        
        const newTask: Task = {
          name,
          complexity,
          start_date,
          last_update: endStr,
          end_date: endStr,
          days_taken,
          progress_log: []
        };
        data.completed.push(newTask);
        saveLocalTasks(data);
        return newTask;
      }
      return requestJson<Task>(`${API_URL}/tasks/past`, {
        method: 'POST',
        body: JSON.stringify({ name, complexity, start_date, days_taken }),
      });
    },

    logProgress: async (taskName: string, note: string): Promise<Task> => {
      if (isGuest) {
        const data = getLocalTasks();
        const task = data.active.find(t => t.name === taskName);
        if (!task) throw new Error("Task not found");
        const today = new Date().toISOString().split('T')[0];
        task.progress_log.push({ date: today, note });
        task.last_update = today;
        saveLocalTasks(data);
        return task;
      }
      return requestJson<Task>(taskPath(taskName, 'logs'), {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
    },

    completeTask: async (taskName: string): Promise<Task> => {
      if (isGuest) {
        const data = getLocalTasks();
        const taskIndex = data.active.findIndex(t => t.name === taskName);
        if (taskIndex === -1) throw new Error("Task not found");
        const task = data.active.splice(taskIndex, 1)[0];
        
        const today = new Date().toISOString().split('T')[0];
        task.end_date = today;
        task.last_update = today;
        
        const start = new Date(task.start_date);
        const end = new Date(today);
        task.days_taken = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        
        data.completed.push(task);
        saveLocalTasks(data);
        return task;
      }
      return requestJson<Task>(taskPath(taskName, 'complete'), { method: 'POST' });
    },

    reopenTask: async (taskName: string): Promise<Task> => {
      if (isGuest) {
        const data = getLocalTasks();
        const taskIndex = data.completed.findIndex(t => t.name === taskName);
        if (taskIndex === -1) throw new Error("Task not found");
        const task = data.completed.splice(taskIndex, 1)[0];
        
        task.end_date = null;
        task.days_taken = undefined;
        task.last_update = new Date().toISOString().split('T')[0];
        
        data.active.push(task);
        saveLocalTasks(data);
        return task;
      }
      return requestJson<Task>(taskPath(taskName, 'reopen'), { method: 'POST' });
    },

    predictDuration: async (complexity: number): Promise<{ predicted_days: number }> => {
      let body: any = { complexity };
      if (isGuest) {
        const data = getLocalTasks();
        body.guest_completed_tasks = data.completed;
      }
      return requestJson<{ predicted_days: number }>(`${API_URL}/predict`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    generateReport: async (completedTasks: Task[]): Promise<ReportData> => {
      return requestJson<ReportData>(`${API_URL}/report`, {
        method: 'POST',
        body: JSON.stringify({ completed_tasks: completedTasks }),
      });
    }
  };
};
