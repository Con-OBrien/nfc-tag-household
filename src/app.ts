import 'reflect-metadata';
import express, { Express, Request, Response, NextFunction } from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/database';
import { AppError } from './types';
import taskRoutes from './routes/taskRoutes';
import eventRoutes from './routes/eventRoutes';
import nfcKeyRoutes from './routes/nfcKeyRoutes';
import userRoutes from './routes/userRoutes';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ENABLE_HTTPS = NODE_ENV === 'production' || process.env.ENABLE_HTTPS === 'true';

/**
 * Middleware: HTTPS/TLS Security
 * Enforces HTTPS in production and sets security headers
 * Requirements: 18.1
 */

// Middleware to redirect HTTP to HTTPS in production
if (ENABLE_HTTPS && NODE_ENV === 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Check if request is via HTTP (not HTTPS)
    const isHttps = req.secure || (req.get('x-forwarded-proto') === 'https');
    if (!isHttps) {
      // Redirect to HTTPS
      return res.redirect(301, `https://${req.get('host')}${req.url}`);
    }
    next();
  });
}

// Middleware: Set strict transport security header (HSTS)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (ENABLE_HTTPS || NODE_ENV === 'production') {
    // HSTS: enforce HTTPS for 1 year (31536000 seconds)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

// Middleware: Set secure cookie flags
app.use((req: Request, res: Response, next: NextFunction) => {
  // Override the res.cookie method to enforce secure flags
  const originalCookie = res.cookie.bind(res);
  res.cookie = function (name: string, value: string, options: any = {}) {
    const secureOptions = {
      ...options,
      httpOnly: true, // Prevent JavaScript access to cookies
      secure: ENABLE_HTTPS || NODE_ENV === 'production', // Only send over HTTPS in production
      sameSite: 'strict', // CSRF protection
    };
    return originalCookie(name, value, secureOptions);
  };
  next();
});

// Middleware: Set additional security headers
app.use((req: Request, res: Response, next: NextFunction) => {
  // X-Content-Type-Options: prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options: prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection: enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content-Security-Policy: restrict resource loading
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");

  // Referrer-Policy: control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
});

/**
 * Middleware: JSON parsing and URL encoding
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
app.use('/api', nfcKeyRoutes);
app.use('/api', userRoutes);

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
 * Start server with HTTPS/TLS support
 * Requirements: 18.1
 */
export async function startServer(): Promise<void> {
  try {
    // Initialize database
    await initializeDatabase();

    // Create HTTPS server if enabled
    if (ENABLE_HTTPS) {
      const certPath = process.env.CERT_PATH;
      const keyPath = process.env.KEY_PATH;

      if (!certPath || !keyPath) {
        console.warn('HTTPS enabled but CERT_PATH or KEY_PATH not configured. Falling back to HTTP.');
        startHttpServer();
        return;
      }

      try {
        // Load TLS certificates from files
        const cert = fs.readFileSync(certPath, 'utf-8');
        const key = fs.readFileSync(keyPath, 'utf-8');

        const httpsOptions = {
          cert,
          key,
          // Enforce TLS 1.2+
          minVersion: 'TLSv1.2' as const,
        };

        // Create HTTPS server
        const httpsServer = https.createServer(httpsOptions, app);

        httpsServer.listen(PORT, () => {
          console.log(`🔒 HTTPS Server running on https://localhost:${PORT}`);
          console.log(`Environment: ${NODE_ENV}`);
          console.log(`TLS Certificate: ${certPath}`);
          console.log(`TLS Key: ${keyPath}`);
        });

        // Optionally start HTTP redirect server on port 80 in production
        if (NODE_ENV === 'production') {
          const httpApp = express();
          httpApp.use((req: Request, res: Response) => {
            res.redirect(301, `https://${req.get('host')}${req.url}`);
          });

          const httpServer = http.createServer(httpApp);
          httpServer.listen(80, () => {
            console.log(`HTTP redirect server running on http://localhost:80`);
          });
        }
      } catch (error) {
        console.error('Failed to load TLS certificates:', error);
        console.warn('Falling back to HTTP...');
        startHttpServer();
      }
    } else {
      // Start HTTP server for development
      startHttpServer();
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Helper function: Start HTTP server (development mode)
 */
function startHttpServer(): void {
  const httpServer = http.createServer(app);

  httpServer.listen(PORT, () => {
    console.log(`🌐 HTTP Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${NODE_ENV}`);
  });
}

export default app;
