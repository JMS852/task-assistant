import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import path from 'path';
import { initDatabase, queryAll, queryOne, execute } from './services/db';
import { startApiServer } from './api/server';
import { startPythonBackend, sendToPython, stopPythonBackend } from './services/python-bridge';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    title: '待办助手',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (e) => {
    // Minimize to tray instead of closing; only allow close when actually quitting
    if (!(app as any).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => mainWindow?.show() },
    { label: '暂停监听', type: 'checkbox', checked: false,
      click: (mi) => mainWindow?.webContents.send('toggle-monitor', !mi.checked) },
    { type: 'separator' },
    { label: '设置', click: () => { mainWindow?.show(); mainWindow?.webContents.send('navigate', 'settings'); } },
    { type: 'separator' },
    { label: '退出', click: () => { (app as any).isQuitting = true; app.quit(); } },
  ]);
  tray.setToolTip('待办助手');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

// IPC handlers
ipcMain.handle('get-tasks', () => {
  return queryAll(
    "SELECT * FROM tasks WHERE status != 'completed' ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC"
  );
});

ipcMain.handle('update-task-status', (_e, id: string, status: string) => {
  execute("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);
  return { success: true };
});

ipcMain.handle('execute-task', (_e, taskId: string, level: string) => {
  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) return { error: 'Task not found' };
  sendToPython({ action: 'execute_task', data: { ...task, level } });
  return { success: true, status: 'dispatched' };
});

ipcMain.handle('get-settings', () => {
  return queryAll('SELECT * FROM ai_config');
});

function pushConfigToPython(setting: any) {
  sendToPython({
    action: 'configure_provider',
    data: {
      provider: setting.provider,
      api_key: setting.api_key_encrypted || '',
      endpoint: setting.endpoint || '',
      enabled: setting.enabled === 1 || setting.enabled === true,
    },
  });
}

ipcMain.handle('save-settings', (_e, settings: any[]) => {
  for (const s of settings) {
    execute(
      'INSERT OR REPLACE INTO ai_config (id, provider, api_key_encrypted, endpoint, enabled) VALUES (?, ?, ?, ?, ?)',
      [s.id, s.provider, s.api_key_encrypted, s.endpoint, s.enabled ? 1 : 0]
    );
    pushConfigToPython(s);
  }
  return { success: true };
});

app.whenReady().then(async () => {
  await initDatabase();
  startApiServer();
  startPythonBackend();
  // Push saved API keys to Python once it's ready
  setTimeout(() => {
    const rows = queryAll('SELECT * FROM ai_config WHERE enabled = 1');
    for (const row of rows) pushConfigToPython(row);
  }, 1000);
  createWindow();
  createTray();
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
  stopPythonBackend();
});

app.on('window-all-closed', () => {});
app.on('activate', () => mainWindow?.show());
