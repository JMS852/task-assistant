import { contextBridge, ipcRenderer } from 'electron';
import type { CreateTaskInput, AIConfig } from './types';

contextBridge.exposeInMainWorld('electronAPI', {
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  updateTaskStatus: (id: string, status: string) => ipcRenderer.invoke('update-task-status', id, status),
  enhanceTask: (taskId: string) => ipcRenderer.invoke('enhance-task', taskId),
  askQuery: (question: string) => ipcRenderer.invoke('query-tasks', question),
  getBriefing: () => ipcRenderer.invoke('get-briefing'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: AIConfig[]) => ipcRenderer.invoke('save-settings', settings),
  createTask: (data: CreateTaskInput) => ipcRenderer.invoke('create-task', data),
  createDemoTasks: () => ipcRenderer.invoke('create-demo-tasks'),
  getCompletedTasks: () => ipcRenderer.invoke('get-completed-tasks'),
  deleteCompletedTasks: () => ipcRenderer.invoke('delete-completed-tasks'),
  startCollector: () => ipcRenderer.invoke('start-collector'),
  stopCollector: () => ipcRenderer.invoke('stop-collector'),
  testMessage: (content: string, sender?: string) => ipcRenderer.invoke('test-message', content, sender),
  getMonitorStatus: () => ipcRenderer.invoke('get-monitor-status'),
  onToggleMonitor: (cb: (active: boolean) => void) => {
    ipcRenderer.on('toggle-monitor', (_, v) => cb(v));
    return () => ipcRenderer.removeAllListeners('toggle-monitor');
  },
  onNavigate: (cb: (page: string) => void) => {
    ipcRenderer.on('navigate', (_, v) => cb(v));
    return () => ipcRenderer.removeAllListeners('navigate');
  },
  onNewTask: (cb: (task: Record<string, unknown>) => void) => {
    ipcRenderer.on('new-task', (_, t) => cb(t));
    return () => ipcRenderer.removeAllListeners('new-task');
  },
  onMessageCaptured: (cb: (msg: Record<string, unknown>) => void) => {
    ipcRenderer.on('message-captured', (_, m) => cb(m));
    return () => ipcRenderer.removeAllListeners('message-captured');
  },
  onListenerStatus: (cb: (status: Record<string, unknown>) => void) => {
    ipcRenderer.on('listener-status', (_, s) => cb(s));
    return () => ipcRenderer.removeAllListeners('listener-status');
  },
  onRecognitionResult: (cb: (result: Record<string, unknown>) => void) => {
    ipcRenderer.on('recognition-result', (_, r) => cb(r));
    return () => ipcRenderer.removeAllListeners('recognition-result');
  },
  scanHistory: (maxDays?: number) => ipcRenderer.invoke('scan-history', maxDays),
  onHistoryScanEvent: (cb: (event: string, data: unknown) => void) => {
    const events = ['history_scan_started', 'history_scan_progress', 'history_scan_collected', 'history_scan_complete', 'history_scan_log'];
    events.forEach(ev => ipcRenderer.on(ev, (_, data) => cb(ev, data)));
    return () => events.forEach(ev => ipcRenderer.removeAllListeners(ev));
  },
  onTriggerBriefing: (cb: () => void) => {
    ipcRenderer.on('trigger-briefing', () => cb());
    return () => ipcRenderer.removeAllListeners('trigger-briefing');
  },
});
