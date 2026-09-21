"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
exports.initializeDatabase = initializeDatabase;
exports.closeDatabase = closeDatabase;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'nfc_tag_db',
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development',
    entities: ['src/entities/**/*.ts'],
    migrations: ['src/migrations/**/*.ts'],
    migrationsRun: true,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
async function initializeDatabase() {
    try {
        if (!exports.AppDataSource.isInitialized) {
            await exports.AppDataSource.initialize();
            console.log('Database connected successfully');
        }
    }
    catch (error) {
        console.error('Database connection failed:', error);
        throw error;
    }
}
async function closeDatabase() {
    if (exports.AppDataSource.isInitialized) {
        await exports.AppDataSource.destroy();
        console.log('Database connection closed');
    }
}
