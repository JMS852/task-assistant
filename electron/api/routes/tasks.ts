import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../../services/db';
import { sendToPythonAndWait } from '../../services/python-bridge';

export const taskRoutes = Router();

taskRoutes.get('/tasks', (_req, res) => {
  const tasks = queryAll(
    "SELECT * FROM tasks WHERE status != 'completed' ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC"
  );
  res.json(tasks);
});

taskRoutes.get('/tasks/completed', (_req, res) => {
  const tasks = queryAll(
    "SELECT * FROM tasks WHERE status = 'completed' ORDER BY updated_at DESC LIMIT 100"
  );
  res.json(tasks);
});

taskRoutes.delete('/tasks/completed', (_req, res) => {
  execute("DELETE FROM tasks WHERE status = 'completed'");
  res.json({ success: true });
});

taskRoutes.get('/tasks/:id', (req, res) => {
  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(task);
});

taskRoutes.patch('/tasks/:id/status', (req, res) => {
  const { status } = req.body;
  execute("UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, req.params.id]);
  res.json({ success: true });
});

taskRoutes.post('/tasks', (req, res) => {
  const { title, description, priority, source, sender, group_name, deadline, confidence, context_missing } = req.body;
  const id = uuidv4();
  execute(
    `INSERT INTO tasks (id, title, description, priority, source, sender, group_name, deadline, confidence, context_missing)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title || '', description || '', priority || 'medium', source || 'manual', sender || '', group_name || null, deadline || null, confidence || 0.9, context_missing ? 1 : 0]
  );
  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
  res.status(201).json(task);
});

// Task enhancement
taskRoutes.post('/tasks/:id/enhance', async (req, res) => {
  const task = queryOne('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) return res.status(404).json({ error: 'Not found' });
  const allTasks = queryAll('SELECT id, title, priority, status, sender FROM tasks');
  try {
    const result = await sendToPythonAndWait({
      action: 'enhance_task',
      data: { task, all_tasks: allTasks },
    }, 30000);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// Smart query
taskRoutes.post('/query', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'question required' });
  const tasks = queryAll('SELECT * FROM tasks');
  try {
    const result = await sendToPythonAndWait({
      action: 'query',
      data: { question, tasks },
    }, 30000);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// Daily briefing
taskRoutes.get('/briefing', async (_req, res) => {
  const tasks = queryAll("SELECT * FROM tasks WHERE status != 'completed'");
  const completedTasks = queryAll("SELECT * FROM tasks WHERE status = 'completed' ORDER BY updated_at DESC LIMIT 20");
  try {
    const result = await sendToPythonAndWait({
      action: 'generate_briefing',
      data: { tasks, completed_tasks: completedTasks },
    }, 30000);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

// Demo data endpoint
taskRoutes.post('/tasks/demo', (_req, res) => {
  const { v4: uuid } = require('uuid');
  const { queryOne, execute } = require('../../services/db');
  const demos = [
    { title: '提交项目周报', description: '整理本周工作进展，发邮件给项目经理，抄送全组。包含本周完成的模块、遇到的问题和下周计划。', priority: 'high', source: 'demo', sender: '张经理', group_name: '技术组', deadline: new Date(Date.now() + 86400000).toISOString().slice(0, 10), confidence: 0.92 },
    { title: '修复登录页面样式错位', description: 'iOS Safari 上登录按钮与输入框重叠，需要适配 flex 布局。优先级中等，影响用户体验但不阻塞功能。', priority: 'medium', source: 'demo', sender: '李前端', group_name: '前端群', deadline: new Date(Date.now() + 259200000).toISOString().slice(0, 10), confidence: 0.85 },
    { title: '约周末聚餐', description: '老同学小聚，确定人数后订包间。需要提前两天确认餐厅。', priority: 'low', source: 'demo', sender: '老王', group_name: '同学群', deadline: null, confidence: 0.71 },
    { title: '更新服务器 SSL 证书', description: '生产环境证书还有15天过期，需要在到期前完成替换。操作步骤：申请新证书 → 验证域名 → 下载部署 → 重启 nginx。', priority: 'high', source: 'demo', sender: '运维小王', group_name: '运维群', deadline: new Date(Date.now() + 1296000000).toISOString().slice(0, 10), confidence: 0.96 },
    { title: '整理客户需求文档', description: '把上次会议讨论的功能点整理成 PRD，按优先级排序，标注技术可行性。周三前给出初稿。', priority: 'medium', source: 'demo', sender: '产品-赵姐', deadline: new Date(Date.now() + 172800000).toISOString().slice(0, 10), confidence: 0.88 },
  ];
  const existing = queryOne('SELECT COUNT(*) as c FROM tasks WHERE source = ?', ['demo']);
  if (existing && existing.c > 0) return res.json({ success: false, message: 'Demo tasks already exist' });
  for (const d of demos) {
    execute(
      `INSERT INTO tasks (id, title, description, priority, source, sender, group_name, deadline, confidence, context_missing, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [uuid(), d.title, d.description, d.priority, d.source, d.sender, d.group_name || null, d.deadline, d.confidence, 0]
    );
  }
  res.json({ success: true, count: demos.length });
});
