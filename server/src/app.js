import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

export function createApp() {
  const app = express();

  const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
  app.use(
    cors({
      origin: allowedOrigin.split(',').map((o) => o.trim()),
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Building-Id'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );

  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: true, limit: '12mb' }));

  app.get('/api/v1/health', (req, res) => {
    res.status(200).json({
      success: true,
      brand: 'canho.com',
      slogan: 'Đẳng cấp tạo nên thương hiệu',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/v1', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp();
