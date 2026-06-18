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
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[API] Internal server running on http://127.0.0.1:${PORT}`);
  });
}
