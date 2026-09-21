"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./config/database");
const types_1 = require("./types");
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes"));
const eventRoutes_1 = __importDefault(require("./routes/eventRoutes"));
const nfcKeyRoutes_1 = __importDefault(require("./routes/nfcKeyRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
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
    app.use((req, res, next) => {
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
app.use((req, res, next) => {
    if (ENABLE_HTTPS || NODE_ENV === 'production') {
        // HSTS: enforce HTTPS for 1 year (31536000 seconds)
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    next();
});
// Middleware: Set secure cookie flags
app.use((req, res, next) => {
    // Override the res.cookie method to enforce secure flags
    const originalCookie = res.cookie.bind(res);
    res.cookie = function (name, value, options = {}) {
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
app.use((req, res, next) => {
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
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
/**
 * Health check endpoint
 */
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
/**
 * API Routes
 */
app.use('/api', taskRoutes_1.default);
app.use('/api', eventRoutes_1.default);
app.use('/api', nfcKeyRoutes_1.default);
app.use('/api', userRoutes_1.default);
app.use('/api/auth', (req, res) => {
    res.json({ message: 'Auth routes not yet implemented' });
});
app.use('/api/users', (req, res) => {
    res.json({ message: 'User routes not yet implemented' });
});
/**
 * 404 Not Found handler
 */
app.use((_req, res) => {
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
app.use((err, _req, res, _next) => {
    if (err instanceof types_1.AppError) {
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
async function startServer() {
    try {
        // Initialize database
        await (0, database_1.initializeDatabase)();
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
                const cert = fs_1.default.readFileSync(certPath, 'utf-8');
                const key = fs_1.default.readFileSync(keyPath, 'utf-8');
                const httpsOptions = {
                    cert,
                    key,
                    // Enforce TLS 1.2+
                    minVersion: 'TLSv1.2',
                };
                // Create HTTPS server
                const httpsServer = https_1.default.createServer(httpsOptions, app);
                httpsServer.listen(PORT, () => {
                    console.log(`🔒 HTTPS Server running on https://localhost:${PORT}`);
                    console.log(`Environment: ${NODE_ENV}`);
                    console.log(`TLS Certificate: ${certPath}`);
                    console.log(`TLS Key: ${keyPath}`);
                });
                // Optionally start HTTP redirect server on port 80 in production
                if (NODE_ENV === 'production') {
                    const httpApp = (0, express_1.default)();
                    httpApp.use((req, res) => {
                        res.redirect(301, `https://${req.get('host')}${req.url}`);
                    });
                    const httpServer = http_1.default.createServer(httpApp);
                    httpServer.listen(80, () => {
                        console.log(`HTTP redirect server running on http://localhost:80`);
                    });
                }
            }
            catch (error) {
                console.error('Failed to load TLS certificates:', error);
                console.warn('Falling back to HTTP...');
                startHttpServer();
            }
        }
        else {
            // Start HTTP server for development
            startHttpServer();
        }
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
/**
 * Helper function: Start HTTP server (development mode)
 */
function startHttpServer() {
    const httpServer = http_1.default.createServer(app);
    httpServer.listen(PORT, () => {
        console.log(`🌐 HTTP Server running on http://localhost:${PORT}`);
        console.log(`Environment: ${NODE_ENV}`);
    });
}
exports.default = app;
