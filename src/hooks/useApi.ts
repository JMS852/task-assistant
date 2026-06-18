const API_BASE = 'http://127.0.0.1:3001/api';

export function useApi() {
  const fetchTasks = () =>
    fetch(`${API_BASE}/tasks`).then(r => r.json());

  const updateTaskStatus = (id: string, status: string) =>
    fetch(`${API_BASE}/tasks/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(r => r.json());

  const executeTask = (taskId: string, level: string) =>
    fetch(`${API_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, level }),
    }).then(r => r.json());

  const ping = () =>
    fetch(`${API_BASE}/ping`).then(r => r.json());

  const createDemoTasks = (): Promise<{ success: boolean; count?: number; message?: string }> => {
    if (window.electronAPI?.createDemoTasks) {
      return window.electronAPI.createDemoTasks();
    }
    return fetch(`${API_BASE}/tasks/demo`, { method: 'POST' }).then(r => r.json());
  };

  return { fetchTasks, updateTaskStatus, executeTask, ping, createDemoTasks };
}
