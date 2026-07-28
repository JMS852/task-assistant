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

  const enhanceTask = async (taskId: string): Promise<any> => {
    if (window.electronAPI?.enhanceTask) {
      return window.electronAPI.enhanceTask(taskId);
    }
    const r = await fetch(`${API_BASE}/tasks/${taskId}/enhance`, { method: 'POST' });
    return r.json();
  };

  const askQuery = async (question: string): Promise<any> => {
    if (window.electronAPI?.askQuery) {
      return window.electronAPI.askQuery(question);
    }
    const r = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    return r.json();
  };

  const getBriefing = async (): Promise<any> => {
    if (window.electronAPI?.getBriefing) {
      return window.electronAPI.getBriefing();
    }
    const r = await fetch(`${API_BASE}/briefing`);
    return r.json();
  };

  const ping = () =>
    fetch(`${API_BASE}/ping`).then(r => r.json());

  const createDemoTasks = (): Promise<{ success: boolean; count?: number; message?: string }> => {
    if (window.electronAPI?.createDemoTasks) {
      return window.electronAPI.createDemoTasks();
    }
    return fetch(`${API_BASE}/tasks/demo`, { method: 'POST' }).then(r => r.json());
  };

  const fetchCompletedTasks = (): Promise<any[]> => {
    if (window.electronAPI?.getCompletedTasks) {
      return window.electronAPI.getCompletedTasks();
    }
    return fetch(`${API_BASE}/tasks/completed`).then(r => r.json());
  };

  const deleteCompletedTasks = (): Promise<{ success: boolean }> => {
    if (window.electronAPI?.deleteCompletedTasks) {
      return window.electronAPI.deleteCompletedTasks();
    }
    return fetch(`${API_BASE}/tasks/completed`, { method: 'DELETE' }).then(r => r.json());
  };

  const createTask = async (data: {
    title: string;
    description: string;
    priority: string;
    deadline: string;
    source: string;
    sender: string;
  }): Promise<any> => {
    try {
      let result: any;
      if (window.electronAPI?.createTask) {
        result = await window.electronAPI.createTask(data);
      } else {
        console.warn('[useApi] electronAPI.createTask unavailable, falling back to REST');
        const r = await fetch(`${API_BASE}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        result = await r.json();
      }
      if (result?.error) {
        const msg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
        throw new Error(msg);
      }
      return result;
    } catch (e) {
      console.error('[useApi] createTask error:', e);
      throw e;
    }
  };

  const scanHistory = async (maxDays: number = 7): Promise<{ success: boolean; error?: string }> => {
    if (window.electronAPI?.scanHistory) {
      return window.electronAPI.scanHistory(maxDays);
    }
    return { success: false, error: 'scanHistory only available in Electron' };
  };

  return { fetchTasks, updateTaskStatus, enhanceTask, askQuery, getBriefing, ping, createDemoTasks, fetchCompletedTasks, deleteCompletedTasks, createTask, scanHistory };
}
