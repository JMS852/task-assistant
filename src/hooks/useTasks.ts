import { useState, useEffect, useCallback } from 'react';
import { Task } from '../types';
import { useApi } from './useApi';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { fetchTasks, updateTaskStatus, createDemoTasks } = useApi();

  const refresh = useCallback(async () => {
    try {
      const data = await fetchTasks();
      setTasks(data);
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); const i = setInterval(refresh, 5000); return () => clearInterval(i); }, [refresh]);

  const completeTask = async (id: string) => {
    await updateTaskStatus(id, 'completed');
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' as const } : t));
  };

  const demo = async () => {
    const res = await createDemoTasks();
    await refresh();
    return res;
  };

  return { tasks, loading, refresh, completeTask, demo };
}
