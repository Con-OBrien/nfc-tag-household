"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
// Start the server
(0, app_1.startServer)().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
