import 'reflect-metadata';
import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/database';
import { AppError } from './types';
import taskRoutes from './routes/taskRoutes';
import eventRoutes from './routes/eventRoutes';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

/**
 * Middleware
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * API Routes
 */
app.use('/api', taskRoutes);
app.use('/api', eventRoutes);

app.use('/api/auth', (req: Request, res: Response) => {
  res.json({ message: 'Auth routes not yet implemented' });
});

app.use('/api/users', (req: Request, res: Response) => {
  res.json({ message: 'User routes not yet implemented' });
});

/**
 * 404 Not Found handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
    timestamp: Date.now(),
  });
});

/**
 * Global error handler
 */
app.use((err: Error | AppError, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      timestamp: Date.now(),
    });
  }

  console.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
    timestamp: Date.now(),
  });
});

/**
 * Start server
 */
export async function startServer(): Promise<void> {
  try {
    // Initialize database
    await initializeDatabase();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

export default app;
