import express from 'express';
import cors from 'cors';
import { taskRoutes } from './routes/tasks';
import { noteRoutes } from './routes/notes';
import { healthRoutes } from './routes/health';

export function startApiServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.use('/api', taskRoutes);
  app.use('/api', noteRoutes);
  app.use('/api', healthRoutes);

  const PORT = 3001;
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`[API] Internal server running on http://127.0.0.1:${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[API] Port ${PORT} is already in use. Another instance may be running.`);
      console.error('[API] Please close the other instance or run: taskkill /F /IM electron.exe');
    } else {
      console.error('[API] Server error:', err.message);
    }
  });
}
