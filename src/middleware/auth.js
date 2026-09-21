"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const types_1 = require("../types");
function authMiddleware(req, res, next) {
    // For testing/demo: extract from headers
    // In production: validate JWT token from Authorization header
    const userId = req.headers['x-user-id'];
    const householdId = req.headers['x-household-id'];
    if (!userId || !householdId) {
        throw new types_1.UnauthorizedError('Missing required authentication headers: x-user-id and x-household-id');
    }
    req.userId = userId;
    req.householdId = householdId;
    next();
}
