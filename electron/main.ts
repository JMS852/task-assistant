import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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

ipcMain.handle('create-demo-tasks', () => {
  const demos = [
    { title: '提交项目周报', description: '整理本周工作进展，发邮件给项目经理，抄送全组。包含本周完成的模块、遇到的问题和下周计划。', priority: 'high', source: 'wechat', sender: '张经理', group_name: '技术组', deadline: new Date(Date.now() + 86400000).toISOString().slice(0, 10), confidence: 0.92, context_missing: 0 },
    { title: '修复登录页面样式错位', description: 'iOS Safari 上登录按钮与输入框重叠，需要适配 flex 布局。优先级中等，影响用户体验但不阻塞功能。', priority: 'medium', source: 'qq', sender: '李前端', group_name: '前端群', deadline: new Date(Date.now() + 259200000).toISOString().slice(0, 10), confidence: 0.85, context_missing: 0 },
    { title: '约周末聚餐', description: '老同学小聚，确定人数后订包间。需要提前两天确认餐厅。', priority: 'low', source: 'wechat', sender: '老王', group_name: '同学群', deadline: null, confidence: 0.71, context_missing: 0 },
    { title: '更新服务器 SSL 证书', description: '生产环境证书还有15天过期，需要在到期前完成替换。操作步骤：申请新证书 → 验证域名 → 下载部署 → 重启 nginx。', priority: 'high', source: 'wechat', sender: '运维小王', group_name: '运维群', deadline: new Date(Date.now() + 1296000000).toISOString().slice(0, 10), confidence: 0.96, context_missing: 0 },
    { title: '整理客户需求文档', description: '把上次会议讨论的功能点整理成 PRD，按优先级排序，标注技术可行性。周三前给出初稿。', priority: 'medium', source: 'qq', sender: '产品-赵姐', deadline: new Date(Date.now() + 172800000).toISOString().slice(0, 10), confidence: 0.88, context_missing: 1 },
  ];

  const count = queryOne('SELECT COUNT(*) as c FROM tasks WHERE source = ?', ['manual']);
  if (count && count.c > 0) return { success: false, message: 'Demo tasks already exist' };

  for (const d of demos) {
    execute(
      `INSERT INTO tasks (id, title, description, priority, source, sender, group_name, deadline, confidence, context_missing, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [uuidv4(), d.title, d.description, d.priority, d.source, d.sender, d.group_name || null, d.deadline, d.confidence, d.context_missing]
    );
  }
  return { success: true, count: demos.length };
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
