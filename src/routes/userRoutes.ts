import { Router, Request, Response, NextFunction } from 'express';
import { UserController } from '../controllers/UserController';
import { authMiddleware } from '../middleware/auth';

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

const router = Router();
const userController = new UserController();

/**
 * Middleware: Require authentication for all user routes
 */
router.use(authMiddleware);

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
router.delete('/users/me', (req: Request, res: Response, next: NextFunction) => {
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
router.get(
  '/users/me/deletion-status',
  (req: Request, res: Response, next: NextFunction) => {
    userController.getDeletionStatus(req, res, next);
  }
);

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
router.post(
  '/users/me/deletion-cancel',
  (req: Request, res: Response, next: NextFunction) => {
    userController.cancelDeletion(req, res, next);
  }
);

export default router;
