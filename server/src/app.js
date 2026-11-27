import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import { connectDB } from './config/db.js';
import { AppError, errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

function collectAllowedOrigins() {
  const origins = new Set();
  const configured = (process.env.CLIENT_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  for (const origin of configured) {
    origins.add(origin);
  }

  for (const vercelHost of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (vercelHost) {
      origins.add(`https://${String(vercelHost).trim()}`);
    }
  }

  if (origins.size === 0) {
    origins.add('http://localhost:5173');
  }

  return origins;
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  const BASE_CORS_OPTIONS = {
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Building-Id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  };

  const staticAllowedOrigins = collectAllowedOrigins();
  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      if (!origin || staticAllowedOrigins.has(origin)) {
        return callback(null, { ...BASE_CORS_OPTIONS, origin: true });
      }

      // Allow same-origin requests routed through Vercel Services or Vite proxy
      try {
        const originHost = new URL(origin).host;
        const requestHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
          .split(',')[0]
          .trim();
        if (requestHost && originHost === requestHost) {
          return callback(null, { ...BASE_CORS_OPTIONS, origin: true });
        }
      } catch {
        // Ignore invalid Origin headers
      }

      return callback(null, { ...BASE_CORS_OPTIONS, origin: Array.from(staticAllowedOrigins) });
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

  // Lazily ensure MongoDB connection & required runtime config for serverless environments
  app.use('/api/v1', async (req, res, next) => {
    try {
      if (!process.env.JWT_SECRET) {
        throw new AppError('JWT_SECRET chưa được cấu hình trên máy chủ', 500);
      }
      await connectDB(process.env.MONGODB_URI);
      next();
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/v1', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp();
