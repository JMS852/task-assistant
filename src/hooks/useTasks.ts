import { useState, useEffect, useCallback } from 'react';
import { Task } from '../types';
import { useApi } from './useApi';

interface CapturedMsg {
  sender: string;
  content: string;
  source: string;
  captured_at: string;
  isTask?: boolean;
  confidence?: number;
  rationale?: string;
}

interface ListenerStatus {
  state: string;
  windows_found: number;
  messages_captured: number;
  error?: string;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [monitorActive, setMonitorActive] = useState(false);
  const [listenerStatus, setListenerStatus] = useState<ListenerStatus | null>(null);
  const [capturedMsgs, setCapturedMsgs] = useState<CapturedMsg[]>([]);
  const { fetchTasks, updateTaskStatus, createDemoTasks, fetchCompletedTasks, deleteCompletedTasks, createTask } = useApi();

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

  const refreshCompleted = useCallback(async () => {
    try {
      const data = await fetchCompletedTasks();
      setCompletedTasks(data);
    } catch (e) {
      console.error('Failed to fetch completed tasks:', e);
    }
  }, []);

  // Listen for new tasks from the Python collector
  useEffect(() => {
    if (!window.electronAPI?.onNewTask) return;
    const unsub = window.electronAPI.onNewTask((task: Task) => {
      setTasks(prev => {
        if (prev.some(t => t.id === task.id)) return prev;
        return [task, ...prev];
      });
    });
    return () => { if (unsub) unsub(); };
  }, []);

  // Listen for monitor toggle events
  useEffect(() => {
    if (!window.electronAPI?.onToggleMonitor) return;
    const unsub = window.electronAPI.onToggleMonitor((active: boolean) => {
      setMonitorActive(active);
    });
    return () => { if (unsub) unsub(); };
  }, []);

  // Listen for listener status updates
  useEffect(() => {
    if (!window.electronAPI?.onListenerStatus) return;
    const unsub = window.electronAPI.onListenerStatus((status: ListenerStatus) => {
      setListenerStatus(status);
    });
    return () => { if (unsub) unsub(); };
  }, []);

  // Listen for raw captured messages
  useEffect(() => {
    if (!window.electronAPI?.onMessageCaptured) return;
    const unsub = window.electronAPI.onMessageCaptured((msg: CapturedMsg) => {
      setCapturedMsgs(prev => [msg, ...prev].slice(0, 50));
    });
    return () => { if (unsub) unsub(); };
  }, []);

  // Listen for recognition results - update matching captured message
  useEffect(() => {
    if (!window.electronAPI?.onRecognitionResult) return;
    const unsub = window.electronAPI.onRecognitionResult((result: any) => {
      setCapturedMsgs(prev => prev.map(m => {
        if (m.content === result.content || m.content.startsWith(result.content?.slice(0, 20))) {
          return { ...m, isTask: result.is_task, confidence: result.confidence, rationale: result.rationale };
        }
        return m;
      }));
    });
    return () => { if (unsub) unsub(); };
  }, []);

  // Check initial monitor status
  useEffect(() => {
    if (window.electronAPI?.getMonitorStatus) {
      window.electronAPI.getMonitorStatus().then((s: any) => setMonitorActive(s.active));
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

  const clearCompleted = async () => {
    await deleteCompletedTasks();
    setCompletedTasks([]);
  };

  const addTask = async (data: {
    title: string;
    description: string;
    priority: string;
    deadline: string;
    source: string;
    sender: string;
  }) => {
    try {
      const newTask = await createTask(data);
      if (newTask && newTask.id) {
        setTasks(prev => [newTask, ...prev]);
      } else {
        console.error('[addTask] createTask returned no id:', newTask);
      }
      return newTask;
    } catch (e) {
      console.error('[addTask] Failed:', e);
      throw e;
    }
  };

  const toggleMonitor = async () => {
    if (monitorActive) {
      await window.electronAPI?.stopCollector();
      setMonitorActive(false);
    } else {
      await window.electronAPI?.startCollector();
      setMonitorActive(true);
    }
  };

  const statusTooltip = listenerStatus
    ? `状态: ${listenerStatus.state} | 窗口: ${listenerStatus.windows_found} | 已捕获: ${listenerStatus.messages_captured}${listenerStatus.error ? ` | 错误: ${listenerStatus.error}` : ''}`
    : '';

  return { tasks, completedTasks, loading, monitorActive, listenerStatus, statusTooltip, capturedMsgs, refresh, refreshCompleted, completeTask, demo, clearCompleted, addTask, toggleMonitor };
}
