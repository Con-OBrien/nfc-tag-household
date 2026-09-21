import { Router, Request, Response, NextFunction } from 'express';
import { PreferencesController } from './PreferencesController';
import { UserRepository } from '../repositories/UserRepository';
import { TaskRepository } from '../repositories/TaskRepository';
import { EventRepository } from '../repositories/EventRepository';
import { HouseholdRepository } from '../repositories/HouseholdRepository';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../types';

const router = Router();

// Initialize repositories and controller
const userRepository = new UserRepository();
const taskRepository = new TaskRepository();
const eventRepository = new EventRepository();
const householdRepository = new HouseholdRepository();
const preferencesController = new PreferencesController(
  userRepository,
  taskRepository,
  eventRepository,
  householdRepository
);

/**
 * Async error handling wrapper
 * Catches errors from async route handlers and passes to Express error middleware
 */
const asyncHandler = (
  fn: (req: AuthenticatedRequest, res: Response) => Promise<void>
) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req as AuthenticatedRequest, res)).catch(next);
};

/**
 * GET /api/users/me/notification-preferences
 * Get current user's notification preferences
 */
router.get(
  '/me/notification-preferences',
  authMiddleware,
  asyncHandler((req: AuthenticatedRequest, res: Response) =>
    preferencesController.getPreferences(req, res)
  )
);

/**
 * PATCH /api/users/me/notification-preferences
 * Update user's notification preferences
 */
router.patch(
  '/me/notification-preferences',
  authMiddleware,
  asyncHandler((req: AuthenticatedRequest, res: Response) =>
    preferencesController.updatePreferences(req, res)
  )
);

/**
 * POST /api/users/me/notification-preferences/mute-task
 * Mute notifications for a specific task
 */
router.post(
  '/me/notification-preferences/mute-task',
  authMiddleware,
  asyncHandler((req: AuthenticatedRequest, res: Response) =>
    preferencesController.muteTask(req, res)
  )
);

/**
 * DELETE /api/users/me/notification-preferences/mute-task/:taskId
 * Unmute notifications for a specific task
 */
router.delete(
  '/me/notification-preferences/mute-task/:taskId',
  authMiddleware,
  asyncHandler((req: AuthenticatedRequest, res: Response) =>
    preferencesController.unmuteTask(req, res)
  )
);

export default router;
