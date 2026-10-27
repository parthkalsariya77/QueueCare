import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { hospitalRouter } from './routes/hospitals.js';
import { appointmentRouter } from './routes/appointments.js';
import { queueRouter } from './routes/queues.js';
import { staffRouter } from './routes/staff.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Disable ETag generation to prevent 304 re-validation loops on live OPD states
app.set('etag', false);

// Middlewares
app.use(cors());
app.use(express.json());

// Disable HTTP caching for real-time OPD API routes to guarantee clean JSON payloads
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// Request logger for debugging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'QueueCare',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount modular API routers
app.use('/api/hospitals', hospitalRouter);
app.use('/api/appointments', appointmentRouter);
app.use('/api/queues', queueRouter);
app.use('/api/staff', staffRouter);

// Serve static frontend assets if built
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), err => {
    if (err) {
      // In development, Vite serves the frontend
      res.status(200).send('QueueCare API Server is running. Please access via Vite on http://localhost:5173');
    }
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`QueueCare API Server listening on http://localhost:${PORT}`);
  });
}
