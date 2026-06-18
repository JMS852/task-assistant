import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../../services/db';

export const noteRoutes = Router();

noteRoutes.get('/notes', (_req, res) => {
  const notes = queryAll('SELECT * FROM notes ORDER BY updated_at DESC');
  res.json(notes);
});

noteRoutes.post('/notes', (req, res) => {
  const id = uuidv4();
  const { title, content, linked_task_id } = req.body;
  execute('INSERT INTO notes (id, title, content, linked_task_id) VALUES (?, ?, ?, ?)',
    [id, title || '', content || '', linked_task_id || null]);
  res.json({ id, success: true });
});

noteRoutes.put('/notes/:id', (req, res) => {
  const { title, content, linked_task_id } = req.body;
  execute("UPDATE notes SET title = ?, content = ?, linked_task_id = ?, updated_at = datetime('now') WHERE id = ?",
    [title, content, linked_task_id, req.params.id]);
  res.json({ success: true });
});

noteRoutes.delete('/notes/:id', (req, res) => {
  execute('DELETE FROM notes WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});
