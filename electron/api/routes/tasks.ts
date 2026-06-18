import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../../services/db';

export const taskRoutes = Router();

taskRoutes.get('/tasks', (_req, res) => {
  const tasks = queryAll(
    "SELECT * FROM tasks WHERE status != 'completed' ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, created_at DESC"
  );
  res.json(tasks);
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
