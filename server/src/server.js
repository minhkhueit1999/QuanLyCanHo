import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { startScheduler } from './services/schedulerService.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/canho_com';

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be defined in environment variables');
  }

  await connectDB(MONGODB_URI);
  const app = createApp();
  startScheduler();

  app.listen(PORT, () => {
    console.log(`[Server] canho.com API running at http://localhost:${PORT}/api/v1`);
  });
}

bootstrap().catch((err) => {
  console.error('[Server] Startup failed:', err.message);
  process.exit(1);
});
