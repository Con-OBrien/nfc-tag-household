import { Router, Request, Response, NextFunction } from 'express';
import { EventController } from '../controllers/EventController';
import { authMiddleware } from '../middleware/auth';

/**
 * Event Routes
 * Implements event history query endpoints for auditing and diagnostics
 * Requirements: 10.4, 10.5, 10.6, 10.7, 10.8
 *
 * Public routes (require authentication):
 * - GET /api/households/:householdId/events - List household events
 * - GET /api/households/:householdId/events/:eventId - Get single event
 * - GET /api/users/me/events - Get user's personal event history
 */

const router = Router();
const eventController = new EventController();

/**
 * Middleware: Require authentication for all event routes
 */
router.use(authMiddleware);

/**
 * GET /api/households/:householdId/events
 * List events for a household with filtering and pagination
 *
 * Query parameters:
 * - eventType: string (optional) - Filter by event type
 * - startDate: number (optional) - Start of date range (milliseconds)
 * - endDate: number (optional) - End of date range (milliseconds)
 * - actor: string (optional) - Filter by userId who performed action
 * - skip: number (default 0) - Pagination offset
 * - limit: number (default 50, max 100) - Pagination limit
 *
 * Success response (200 OK):
 * {
 *   success: true,
 *   data: {
 *     events: [
 *       {
 *         eventId: string,
 *         eventType: string,
 *         actor: string,
 *         timestamp: number,
 *         resource: object,
 *         changes: object
 *       }
 *     ],
 *     total: number,
 *     skip: number,
 *     limit: number
 *   },
 *   timestamp: number
 * }
 */
router.get(
  '/households/:householdId/events',
  (req: Request, res: Response, next: NextFunction) => {
    eventController.getHouseholdEvents(req, res, next);
  }
);

/**
 * GET /api/households/:householdId/events/:eventId
 * Retrieve a single event by ID
 *
 * Success response (200 OK):
 * {
 *   success: true,
 *   data: {
 *     eventId: string,
 *     eventType: string,
 *     actor: string,
 *     timestamp: number,
 *     resource: object,
 *     changes: object
 *   },
 *   timestamp: number
 * }
 */
router.get(
  '/households/:householdId/events/:eventId',
  (req: Request, res: Response, next: NextFunction) => {
    eventController.getEventById(req, res, next);
  }
);

/**
 * GET /api/users/me/events
 * List events for current user across all households
 *
 * Query parameters:
 * - eventType: string (optional) - Filter by event type
 * - startDate: number (optional) - Start of date range (milliseconds)
 * - endDate: number (optional) - End of date range (milliseconds)
 * - skip: number (default 0) - Pagination offset
 * - limit: number (default 50, max 100) - Pagination limit
 *
 * Success response (200 OK):
 * {
 *   success: true,
 *   data: {
 *     events: [
 *       {
 *         eventId: string,
 *         eventType: string,
 *         actor: string,
 *         timestamp: number,
 *         resource: object,
 *         changes: object
 *       }
 *     ],
 *     total: number,
 *     skip: number,
 *     limit: number
 *   },
 *   timestamp: number
 * }
 */
router.get('/users/me/events', (req: Request, res: Response, next: NextFunction) => {
  eventController.getUserEvents(req, res, next);
});

export default router;
