"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.extractToken = extractToken;
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const types_1 = require("../types");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';
/**
 * Generate JWT token
 */
function generateToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRE,
    });
}
/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded;
    }
    catch (error) {
        throw new types_1.UnauthorizedError('Invalid or expired token');
    }
}
/**
 * Extract token from Authorization header
 */
function extractToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new types_1.UnauthorizedError('Missing or invalid Authorization header');
    }
    return authHeader.slice(7);
}
/**
 * Hash password using bcrypt
 */
async function hashPassword(password) {
    const salt = await bcryptjs_1.default.genSalt(10);
    return bcryptjs_1.default.hash(password, salt);
}
/**
 * Compare password with hash
 */
async function comparePassword(password, hash) {
    return bcryptjs_1.default.compare(password, hash);
}
