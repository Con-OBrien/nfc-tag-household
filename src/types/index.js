"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = exports.AppError = void 0;
/**
 * Error Types
 */
class AppError extends Error {
    constructor(code, statusCode, message, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, details) {
        super('VALIDATION_ERROR', 400, message, details);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends AppError {
    constructor(resource) {
        super('NOT_FOUND', 404, `${resource} not found`);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super('UNAUTHORIZED', 401, message);
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super('FORBIDDEN', 403, message);
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
