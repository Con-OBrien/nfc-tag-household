"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const UserController_1 = require("../controllers/UserController");
const auth_1 = require("../middleware/auth");
/**
 * User Routes
 * Implements user account management endpoints including secure deletion
 * Requirements: 18.4, 23.7
 *
 * Protected routes (require authentication):
 * - DELETE /api/users/me - Delete own account
 * - GET /api/users/me/deletion-status - Check deletion status
 * - POST /api/users/me/deletion-cancel - Cancel scheduled deletion
 */
const router = (0, express_1.Router)();
const userController = new UserController_1.UserController();
/**
 * Middleware: Require authentication for all user routes
 */
router.use(auth_1.authMiddleware);
/**
 * DELETE /api/users/me
 * Self-service account deletion endpoint
 * Securely deletes all user data with 3-pass overwrite per DOD 5220.22-M standard
 * Retains event audit trail for 90 days per compliance requirements
 *
 * Request body:
 * {
 *   password: string (for confirmation),
 *   reason?: string
 * }
 *
 * Response: 200 OK
 * {
 *   success: true,
 *   data: {
 *     message: "Account deletion initiated",
 *     deletionScheduledFor: number (timestamp of 24 hours from now)
 *   }
 * }
 *
 * Requirements: 18.4, 23.7
 */
router.delete('/users/me', (req, res, next) => {
    userController.deleteAccount(req, res, next);
});
/**
 * GET /api/users/me/deletion-status
 * Check deletion status of own account
 * Returns whether account is active, pending deletion, or already deleted
 *
 * Response: 200 OK
 * {
 *   success: true,
 *   data: {
 *     status: "active" | "pending_deletion" | "deleted",
 *     deletionScheduledFor?: number,
 *     canCancel: boolean
 *   }
 * }
 */
router.get('/users/me/deletion-status', (req, res, next) => {
    userController.getDeletionStatus(req, res, next);
});
/**
 * POST /api/users/me/deletion-cancel
 * Cancel scheduled account deletion if within grace period
 * Must be called within 24 hours of deletion request
 *
 * Response: 200 OK
 * {
 *   success: true,
 *   data: {
 *     message: "Account deletion cancelled"
 *   }
 * }
 */
router.post('/users/me/deletion-cancel', (req, res, next) => {
    userController.cancelDeletion(req, res, next);
});
exports.default = router;
