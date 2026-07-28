import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { initDatabase, queryAll, queryOne, execute } from './services/db';
import { startApiServer } from './api/server';
import { startPythonBackend, sendToPython, stopPythonBackend, sendToPythonAndWait } from './services/python-bridge';
import type { Task, AIConfig, ListenerStatus, CapturedMessage, RecognitionResult, CreateTaskInput } from './types';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let monitorActive = false;
let pythonReady = false;
let updateTrayMenu: (() => void) | null = null;

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
    if (!(app as any).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function buildTrayMenu() {
  const label = monitorActive ? '暂停监听' : '启用监听';
  return Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => mainWindow?.show() },
    { label, type: 'checkbox', checked: monitorActive,
      click: (mi) => {
        if (mi.checked) {
          startCollector();
        } else {
          stopCollector();
        }
        mainWindow?.webContents.send('toggle-monitor', mi.checked);
      }
    },
    { type: 'separator' },
    { label: '设置', click: () => { mainWindow?.show(); mainWindow?.webContents.send('navigate', 'settings'); } },
    { type: 'separator' },
    { label: '退出', click: () => { (app as any).isQuitting = true; app.quit(); } },
  ]);
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  const trayInstance = new Tray(icon);
  tray = trayInstance;

  updateTrayMenu = () => {
    if (tray) {
      tray.setContextMenu(buildTrayMenu());
    }
  };

  trayInstance.setContextMenu(buildTrayMenu());
  trayInstance.setToolTip('待办助手');
  trayInstance.on('double-click', () => mainWindow?.show());
}

function startCollector() {
  monitorActive = true;
  if (pythonReady) {
    sendToPython({ action: 'start_collector' });
  }
  updateTrayMenu?.();
  console.log('[Main] Collector started');
}

function stopCollector() {
  monitorActive = false;
  if (pythonReady) {
    sendToPython({ action: 'stop_collector' });
  }
  updateTrayMenu?.();
  console.log('[Main] Collector stopped');
}

function handleNewTaskFromPython(task: Task) {
  if (!task || !task.title) return;

  const existing = queryOne(
    "SELECT id FROM tasks WHERE title = ? AND sender = ? AND source = ?",
    [task.title, task.sender || '', task.source || '']
  );
  if (existing) return;

  const id = task.id || uuidv4();
  try {
    execute(
      `INSERT INTO tasks (id, title, description, priority, source, sender, group_name, deadline, confidence, context_missing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        task.title,
        task.description || '',
        task.priority || 'medium',
        task.source || 'wechat',
        task.sender || '',
        task.group_name || null,
        task.deadline || null,
        task.confidence || 0.5,
        task.context_missing || 0,
      ]
    );
    const saved = queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
    if (saved && mainWindow) {
      mainWindow.webContents.send('new-task', saved);
      console.log('[Main] New task forwarded to renderer:', saved.title);
    }
  } catch (err) {
    console.error('[Main] Failed to insert task from Python:', err);
  }
}

function onPythonReady() {
  pythonReady = true;
  // Push saved API keys
  const rows = queryAll<AIConfig>('SELECT * FROM ai_config WHERE enabled = 1');
  for (const row of rows) pushConfigToPython(row);
  // Auto-start collector
  startCollector();
}

// IPC handlers
ipcMain.handle('get-tasks', () => {
  return queryAll(
    "SELECT * FROM tasks WHERE status != 'completed' ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC"
  );
});

ipcMain.handle('get-completed-tasks', () => {
  return queryAll(
    "SELECT * FROM tasks WHERE status = 'completed' ORDER BY updated_at DESC LIMIT 100"
  );
});

ipcMain.handle('delete-completed-tasks', () => {
  execute("DELETE FROM tasks WHERE status = 'completed'");
  return { success: true };
});

ipcMain.handle('update-task-status', (_e, id: string, status: string) => {
  execute("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);
  return { success: true };
});

ipcMain.handle('enhance-task', async (_e, taskId: string) => {
  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) return { error: 'Task not found' };
  const allTasks = queryAll('SELECT id, title, priority, status, sender FROM tasks');
  try {
    const result = await sendToPythonAndWait({
      action: 'enhance_task',
      data: { task, all_tasks: allTasks },
    }, 30000);
    return result;
  } catch (err) {
    console.error('[Main] enhance-task failed:', err);
    return { error: String(err) };
  }
});

ipcMain.handle('query-tasks', async (_e, question: string) => {
  const tasks = queryAll('SELECT * FROM tasks');
  try {
    const result = await sendToPythonAndWait({
      action: 'query',
      data: { question, tasks },
    }, 30000);
    return result;
  } catch (err) {
    console.error('[Main] query failed:', err);
    return { error: String(err) };
  }
});

ipcMain.handle('get-briefing', async () => {
  const tasks = queryAll("SELECT * FROM tasks WHERE status != 'completed'");
  const completedTasks = queryAll("SELECT * FROM tasks WHERE status = 'completed' ORDER BY updated_at DESC LIMIT 20");
  try {
    const result = await sendToPythonAndWait({
      action: 'generate_briefing',
      data: { tasks, completed_tasks: completedTasks },
    }, 30000);
    return result;
  } catch (err) {
    console.error('[Main] briefing failed:', err);
    return { error: String(err) };
  }
});

ipcMain.handle('get-settings', () => {
  return queryAll('SELECT * FROM ai_config');
});

function pushConfigToPython(setting: AIConfig) {
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

ipcMain.handle('save-settings', (_e, settings: AIConfig[]) => {
  for (const s of settings) {
    execute(
      'INSERT OR REPLACE INTO ai_config (id, provider, api_key_encrypted, endpoint, enabled) VALUES (?, ?, ?, ?, ?)',
      [s.id, s.provider, s.api_key_encrypted, s.endpoint, s.enabled ? 1 : 0]
    );
    pushConfigToPython(s);
  }
  return { success: true };
});

ipcMain.handle('create-task', (_e, data: CreateTaskInput) => {
  const id = uuidv4();
  try {
    execute(
      `INSERT INTO tasks (id, title, description, priority, source, sender, deadline, confidence, context_missing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.title, data.description || '', data.priority || 'medium', data.source || 'manual', data.sender || '', data.deadline || null, 0.9, 0]
    );
    const result = queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!result) {
      console.error('[Main] create-task: inserted but not found:', id);
      return { error: 'Failed to create task: not found after insert' };
    }
    return result;
  } catch (err) {
    console.error('[Main] create-task error:', err);
    return { error: String(err) };
  }
});

ipcMain.handle('create-demo-tasks', () => {
  const demos = [
    { title: '提交项目周报', description: '整理本周工作进展，发邮件给项目经理，抄送全组。包含本周完成的模块、遇到的问题和下周计划。', priority: 'high', source: 'demo', sender: '张经理', group_name: '技术组', deadline: new Date(Date.now() + 86400000).toISOString().slice(0, 10), confidence: 0.92, context_missing: 0 },
    { title: '修复登录页面样式错位', description: 'iOS Safari 上登录按钮与输入框重叠，需要适配 flex 布局。优先级中等，影响用户体验但不阻塞功能。', priority: 'medium', source: 'demo', sender: '李前端', group_name: '前端群', deadline: new Date(Date.now() + 259200000).toISOString().slice(0, 10), confidence: 0.85, context_missing: 0 },
    { title: '约周末聚餐', description: '老同学小聚，确定人数后订包间。需要提前两天确认餐厅。', priority: 'low', source: 'demo', sender: '老王', group_name: '同学群', deadline: null, confidence: 0.71, context_missing: 0 },
    { title: '更新服务器 SSL 证书', description: '生产环境证书还有15天过期，需要在到期前完成替换。操作步骤：申请新证书 → 验证域名 → 下载部署 → 重启 nginx。', priority: 'high', source: 'demo', sender: '运维小王', group_name: '运维群', deadline: new Date(Date.now() + 1296000000).toISOString().slice(0, 10), confidence: 0.96, context_missing: 0 },
    { title: '整理客户需求文档', description: '把上次会议讨论的功能点整理成 PRD，按优先级排序，标注技术可行性。周三前给出初稿。', priority: 'medium', source: 'demo', sender: '产品-赵姐', deadline: new Date(Date.now() + 172800000).toISOString().slice(0, 10), confidence: 0.88, context_missing: 1 },
  ];

  const count = queryOne<{c: number}>('SELECT COUNT(*) as c FROM tasks WHERE source = ?', ['demo']);
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

// Collector control IPC
ipcMain.handle('start-collector', () => {
  startCollector();
  return { success: true };
});

ipcMain.handle('stop-collector', () => {
  stopCollector();
  return { success: true };
});

ipcMain.handle('test-message', (_e, content: string, sender?: string) => {
  sendToPython({
    action: 'test_pipeline',
    content: content || '',
    sender: sender || '测试用户',
    source: 'manual',
  });
  return { success: true };
});

ipcMain.handle('get-monitor-status', () => {
  return { active: monitorActive };
});

ipcMain.handle('scan-history', (_e, maxDays?: number) => {
  console.log('[Main] scan-history IPC received, pythonReady:', pythonReady, 'maxDays:', maxDays);
  if (!pythonReady) {
    console.log('[Main] scan-history: Python NOT ready');
    return { success: false, error: 'Python backend not ready (not yet initialized)' };
  }
  console.log('[Main] scan-history: forwarding to Python');
  sendToPython({ action: 'scan_history', max_days: maxDays || 7 });
  return { success: true };
});

app.whenReady().then(async () => {
  await initDatabase();
  startApiServer();

  // Set up Python backend with ready+task+status+message callbacks
  startPythonBackend({
    onReady: () => onPythonReady(),
    onNewTask: handleNewTaskFromPython,
    onStatus: (status: ListenerStatus) => {
      if (mainWindow) {
        mainWindow.webContents.send('listener-status', status);
      }
    },
    onMessage: (msg: CapturedMessage) => {
      if (mainWindow) {
        mainWindow.webContents.send('message-captured', msg);
      }
    },
    onRecognition: (result: RecognitionResult) => {
      if (mainWindow) {
        mainWindow.webContents.send('recognition-result', result);
      }
    },
    onHistory: (event: string, data: unknown) => {
      if (mainWindow) {
        mainWindow.webContents.send(event, data);
      }
    },
  });

  createWindow();
  createTray();

  // Schedule daily briefing notification at 9:00 AM
  function scheduleDailyBriefing() {
    const now = new Date();
    const nineAM = new Date(now);
    nineAM.setHours(9, 0, 0, 0);
    if (now > nineAM) nineAM.setDate(nineAM.getDate() + 1);
    const msUntilNine = nineAM.getTime() - now.getTime();
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.webContents.send('trigger-briefing');
      }
      scheduleDailyBriefing();
    }, msUntilNine);
  }
  scheduleDailyBriefing();
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
  stopPythonBackend();
});

app.on('window-all-closed', () => {});
app.on('activate', () => mainWindow?.show());
