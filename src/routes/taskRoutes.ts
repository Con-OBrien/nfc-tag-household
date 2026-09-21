import { Router, Request, Response, NextFunction } from 'express';
import { TaskController } from '../controllers/TaskController';

/**
 * Task Routes
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 19.1-19.6
 *
 * Endpoints:
 * - POST /api/households/:householdId/tasks - Create task
 * - PUT /api/households/:householdId/tasks/:taskId - Update task
 * - DELETE /api/households/:householdId/tasks/:taskId - Deactivate task
 * - GET /api/households/:householdId/tasks - List tasks
 * - GET /api/households/:householdId/tasks/:taskId - Get single task
 */

const router = Router();
const taskController = new TaskController();

/**
 * Middleware to authenticate user
 * Should be applied to all task routes
 * Sets req.userId from token or session
 */
const authenticateUser = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Extract userId from request (typically set by auth middleware)
    // This is a placeholder that should be replaced with actual auth middleware
    const userId = (req as any).userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
        timestamp: Date.now(),
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/households/:householdId/tasks
 * Create a new task in a household
 */
router.post(
  '/households/:householdId/tasks',
  authenticateUser,
  (req: Request, res: Response, next: NextFunction) =>
    taskController.createTask(req, res, next)
);

/**
 * PUT /api/households/:householdId/tasks/:taskId
 * Update an existing task
 */
router.put(
  '/households/:householdId/tasks/:taskId',
  authenticateUser,
  (req: Request, res: Response, next: NextFunction) =>
    taskController.updateTask(req, res, next)
);

/**
 * DELETE /api/households/:householdId/tasks/:taskId
 * Deactivate a task (soft delete, preserves events)
 */
router.delete(
  '/households/:householdId/tasks/:taskId',
  authenticateUser,
  (req: Request, res: Response, next: NextFunction) =>
    taskController.deactivateTask(req, res, next)
);

/**
 * GET /api/households/:householdId/tasks
 * List tasks in a household with optional filtering and pagination
 *
 * Query parameters:
 * - active: boolean (true/false, filter by active status)
 * - category: string (filter by category)
 * - skip: number (default 0, for pagination)
 * - limit: number (default 50, max 100, for pagination)
 */
router.get(
  '/households/:householdId/tasks',
  authenticateUser,
  (req: Request, res: Response, next: NextFunction) =>
    taskController.listTasks(req, res, next)
);

/**
 * GET /api/households/:householdId/tasks/:taskId
 * Get a single task by ID
 */
router.get(
  '/households/:householdId/tasks/:taskId',
  authenticateUser,
  (req: Request, res: Response, next: NextFunction) =>
    taskController.getTask(req, res, next)
);

export default router;
