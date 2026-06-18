import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  updateTaskStatus: (id: string, status: string) => ipcRenderer.invoke('update-task-status', id, status),
  executeTask: (taskId: string, level: string) => ipcRenderer.invoke('execute-task', taskId, level),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  createDemoTasks: () => ipcRenderer.invoke('create-demo-tasks'),
  onToggleMonitor: (cb: (active: boolean) => void) => ipcRenderer.on('toggle-monitor', (_, v) => cb(v)),
  onNavigate: (cb: (page: string) => void) => ipcRenderer.on('navigate', (_, v) => cb(v)),
  onNewTask: (cb: (task: any) => void) => ipcRenderer.on('new-task', (_, t) => cb(t)),
  onMessageCaptured: (cb: (msg: any) => void) => ipcRenderer.on('message-captured', (_, m) => cb(m)),
});
