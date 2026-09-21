"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./config/database");
const types_1 = require("./types");
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes"));
const eventRoutes_1 = __importDefault(require("./routes/eventRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
/**
 * Middleware
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
 * Start server
 */
async function startServer() {
    try {
        // Initialize database
        await (0, database_1.initializeDatabase)();
        // Start Express server
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
exports.default = app;
