import { Request, Response, NextFunction } from 'express';
import { EventRepository } from '../repositories/EventRepository';
import { UserRepository } from '../repositories/UserRepository';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ApiResponse,
  TaskEvent,
} from '../types';

/**
 * EventController - Handles all event history query HTTP requests
 * Requirements: 10.4, 10.5, 10.6, 10.7, 10.8
 *
 * Manages:
 * - Event history queries per household
 * - Single event retrieval
 * - User's personal event history
 * - Filtering by action type, date range, actor
 * - Pagination
 */
export class EventController {
  private eventRepository: EventRepository;
  private userRepository: UserRepository;

  constructor() {
    this.eventRepository = new EventRepository();
    this.userRepository = new UserRepository();
  }

  /**
   * GET /api/households/:householdId/events
   * List events for a household (filtered by householdId, paginated)
   *
   * Path params:
   * - householdId: UUID of household
   *
   * Query params (all optional):
   * - action: string (filter by action type: execute, acknowledge, undo, comment)
   * - startDate: number (milliseconds since epoch, for date range filtering)
   * - endDate: number (milliseconds since epoch, for date range filtering)
   * - actor: string (userId, filter by who performed the action)
   * - skip: number (default 0, for pagination)
   * - limit: number (default 50, max 100, for pagination)
   *
   * Response: 200 OK
   * {
   *   events: Array<{
   *     eventId: string,
   *     action: string,
   *     userId: string,
   *     timestamp: number,
   *     taskId: string,
   *     householdId: string,
   *     metadata?: object
   *   }>,
   *   total: number,
   *   skip: number,
   *   limit: number
   * }
   *
   * Error responses:
   * - 400: Invalid query parameters
   * - 401: Not authenticated
   * - 403: Not a member of household
   * - 404: Household doesn't exist
   *
   * Requirements: 10.4, 10.5, 10.6, 10.7, 10.8
   */
  async getHouseholdEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract user ID from authenticated request
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      // Extract householdId from URL parameters
      const householdId = req.params.householdId as string;
      if (!householdId) {
        throw new ValidationError('householdId is required');
      }

      // Verify user is member of household (household isolation)
      const userInHousehold = await this.userRepository.isUserInHousehold(userId, householdId);
      if (!userInHousehold) {
        throw new ForbiddenError('User is not a member of this household');
      }

      // Parse query parameters
      const actionFilter = req.query.action as string | undefined;
      const startDateStr = req.query.startDate as string | undefined;
      const endDateStr = req.query.endDate as string | undefined;
      const actorFilter = req.query.actor as string | undefined;
      const skipStr = (req.query.skip as string) || '0';
      const limitStr = (req.query.limit as string) || '50';

      // Parse and validate pagination parameters
      const skipVal = parseInt(skipStr, 10);
      const limitVal = parseInt(limitStr, 10);
      
      if (isNaN(skipVal) || isNaN(limitVal)) {
        throw new ValidationError('skip and limit must be valid integers');
      }

      let skip = Math.max(0, skipVal);
      let limit = Math.max(1, Math.min(100, limitVal)); // Max 100 per request

      // Parse and validate date range
      let startDate: number | undefined;
      let endDate: number | undefined;

      if (startDateStr !== undefined) {
        const startVal = parseInt(startDateStr, 10);
        if (isNaN(startVal)) {
          throw new ValidationError('startDate must be a valid millisecond timestamp');
        }
        startDate = startVal;
      }

      if (endDateStr !== undefined) {
        const endVal = parseInt(endDateStr, 10);
        if (isNaN(endVal)) {
          throw new ValidationError('endDate must be a valid millisecond timestamp');
        }
        endDate = endVal;
      }

      // Validate date range if both provided
      if (startDate !== undefined && endDate !== undefined && startDate > endDate) {
        throw new ValidationError('startDate must be before endDate');
      }

      // Query events from repository
      let events: TaskEvent[] = [];

      // If date range filtering is requested, use that method
      if (startDate !== undefined || endDate !== undefined) {
        events = await this.eventRepository.queryEventsByDateRange(
          startDate || 0,
          endDate || Date.now(),
          householdId
        );
      } else {
        // Otherwise get all events for the household
        events = await this.eventRepository.getHouseholdEvents(householdId, 1000); // Get many for filtering
      }

      // Apply filters
      if (actionFilter) {
        events = events.filter((event) => event.action === actionFilter);
      }

      if (actorFilter) {
        events = events.filter((event) => event.userId === actorFilter);
      }

      // Events are returned in reverse chronological order from repository
      // Apply pagination
      const paginatedEvents = events.slice(skip, skip + limit);

      // Return response with pagination info
      const response: ApiResponse<{
        events: TaskEvent[];
        total: number;
        skip: number;
        limit: number;
      }> = {
        success: true,
        data: {
          events: paginatedEvents,
          total: events.length,
          skip,
          limit,
        },
        timestamp: Date.now(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/households/:householdId/events/:eventId
   * Retrieve single event
   *
   * Path params:
   * - householdId: UUID of household
   * - eventId: UUID of event
   *
   * Response: 200 OK
   * {
   *   eventId: string,
   *   action: string,
   *   userId: string,
   *   timestamp: number,
   *   taskId: string,
   *   householdId: string,
   *   metadata?: object
   * }
   *
   * Error responses:
   * - 401: Not authenticated
   * - 403: Not a member of household
   * - 404: Event or household doesn't exist
   *
   * Requirements: 10.4, 10.5
   */
  async getEventById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract user ID from authenticated request
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      // Extract IDs from URL parameters
      const householdId = req.params.householdId as string;
      const eventId = req.params.eventId as string;

      if (!householdId || !eventId) {
        throw new ValidationError('householdId and eventId are required');
      }

      // Verify user is member of household (household isolation)
      const userInHousehold = await this.userRepository.isUserInHousehold(userId, householdId);
      if (!userInHousehold) {
        throw new ForbiddenError('User is not a member of this household');
      }

      // Get the event - we need to verify it belongs to this household
      // Get all events for household and find the one
      const events = await this.eventRepository.getHouseholdEvents(householdId, 1000);
      const event = events.find((e) => e.eventId === eventId);

      if (!event) {
        throw new NotFoundError('Event');
      }

      // Return success response
      const response: ApiResponse<TaskEvent> = {
        success: true,
        data: event,
        timestamp: Date.now(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/me/events
   * List events for current user (user's own event history)
   *
   * Query params (all optional):
   * - action: string (filter by action type)
   * - startDate: number (milliseconds since epoch, for date range filtering)
   * - endDate: number (milliseconds since epoch, for date range filtering)
   * - skip: number (default 0, for pagination)
   * - limit: number (default 50, max 100, for pagination)
   *
   * Response: 200 OK
   * {
   *   events: Array<{
   *     eventId: string,
   *     action: string,
   *     userId: string,
   *     timestamp: number,
   *     taskId: string,
   *     householdId: string,
   *     metadata?: object
   *   }>,
   *   total: number,
   *   skip: number,
   *   limit: number
   * }
   *
   * Error responses:
   * - 400: Invalid query parameters
   * - 401: Not authenticated
   *
   * Requirements: 10.6, 10.7, 10.8
   */
  async getUserEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract user ID from authenticated request
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      // Parse query parameters
      const actionFilter = req.query.action as string | undefined;
      const startDateStr = req.query.startDate as string | undefined;
      const endDateStr = req.query.endDate as string | undefined;
      const skipStr = (req.query.skip as string) || '0';
      const limitStr = (req.query.limit as string) || '50';

      // Parse and validate pagination parameters
      const skipVal = parseInt(skipStr, 10);
      const limitVal = parseInt(limitStr, 10);
      
      if (isNaN(skipVal) || isNaN(limitVal)) {
        throw new ValidationError('skip and limit must be valid integers');
      }

      let skip = Math.max(0, skipVal);
      let limit = Math.max(1, Math.min(100, limitVal)); // Max 100 per request

      // Parse and validate date range
      let startDate: number | undefined;
      let endDate: number | undefined;

      if (startDateStr !== undefined) {
        const startVal = parseInt(startDateStr, 10);
        if (isNaN(startVal)) {
          throw new ValidationError('startDate must be a valid millisecond timestamp');
        }
        startDate = startVal;
      }

      if (endDateStr !== undefined) {
        const endVal = parseInt(endDateStr, 10);
        if (isNaN(endVal)) {
          throw new ValidationError('endDate must be a valid millisecond timestamp');
        }
        endDate = endVal;
      }

      // Validate date range if both provided
      if (startDate !== undefined && endDate !== undefined && startDate > endDate) {
        throw new ValidationError('startDate must be before endDate');
      }

      // Get user's households to aggregate events across them
      const user = await this.userRepository.findUserDetails(userId);
      if (!user) {
        throw new NotFoundError('User');
      }

      // Get all events for this user across all their households
      let events: TaskEvent[] = [];

      // Get list of households user belongs to
      const userHouseholds = await this.userRepository.getUserHouseholds(userId);

      if (startDate !== undefined || endDate !== undefined) {
        // Query events across all their households with date range
        for (const household of userHouseholds) {
          const householdEvents = await this.eventRepository.queryEventsByDateRange(
            startDate || 0,
            endDate || Date.now(),
            household.householdId
          );
          events = events.concat(householdEvents);
        }
      } else {
        // Get all user events across households
        for (const household of userHouseholds) {
          const householdEvents = await this.eventRepository.getEventsByUser(userId, household.householdId, 10000);
          events = events.concat(householdEvents);
        }
      }

      // Apply filters
      if (actionFilter) {
        events = events.filter((event) => event.action === actionFilter);
      }

      // Sort by timestamp descending (reverse chronological)
      events.sort((a, b) => b.timestamp - a.timestamp);

      // Apply pagination
      const paginatedEvents = events.slice(skip, skip + limit);

      // Return response with pagination info
      const response: ApiResponse<{
        events: TaskEvent[];
        total: number;
        skip: number;
        limit: number;
      }> = {
        success: true,
        data: {
          events: paginatedEvents,
          total: events.length,
          skip,
          limit,
        },
        timestamp: Date.now(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default EventController;
