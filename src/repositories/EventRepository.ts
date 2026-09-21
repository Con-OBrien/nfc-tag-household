import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { TaskEventEntity } from '../entities/TaskEvent';
import { TaskEvent } from '../types';
import { randomUUID } from 'crypto';
import { ValidationError, ForbiddenError } from '../types';

/**
 * EventRepository - Data access layer for immutable event audit trail
 * Enforces read-only pattern: events can only be created, never updated or deleted
 * Implements household isolation and efficient date-based querying
 */
export class EventRepository {
  private repository: Repository<TaskEventEntity>;

  constructor() {
    this.repository = AppDataSource.getRepository(TaskEventEntity);
  }

  /**
   * Log a new event to the audit trail
   * Events are immutable - this method only supports INSERT operations
   * Enforces household isolation and validates all required fields
   * @param event - TaskEvent data to log (eventId will be generated)
   * @returns Promise that resolves when event is persisted
   * @throws ValidationError if required fields missing or invalid
   * @throws Error if attempt is made to update an existing event
   */
  async logEvent(event: Omit<TaskEvent, 'eventId'>): Promise<TaskEvent> {
    // Validate all required fields
    if (!event.userId || !event.taskId || !event.householdId || !event.action) {
      throw new ValidationError(
        'userId, taskId, householdId, and action are required fields for event logging'
      );
    }

    if (!['execute', 'acknowledge', 'undo', 'comment'].includes(event.action)) {
      throw new ValidationError(
        `Invalid action "${event.action}". Must be one of: execute, acknowledge, undo, comment`
      );
    }

    if (!event.timestamp) {
      throw new ValidationError('timestamp is required for event logging');
    }

    // Ensure timestamp is recent (within last 24 hours) to catch anomalies
    const currentTime = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    if (Math.abs(currentTime - event.timestamp) > dayInMs) {
      throw new ValidationError(
        `Event timestamp must be within 24 hours of current time. Provided: ${event.timestamp}, Current: ${currentTime}`
      );
    }

    // Create new event entity with generated UUID
    const newEventEntity = this.repository.create({
      eventId: randomUUID(),
      userId: event.userId,
      taskId: event.taskId,
      householdId: event.householdId,
      action: event.action,
      timestamp: event.timestamp,
      metadata: event.metadata || {},
    });

    // Persist to database (INSERT only)
    const savedEvent = await this.repository.save(newEventEntity);

    return savedEvent.toTaskEvent();
  }

  /**
   * Retrieve event history for a specific task in reverse chronological order
   * Enforces household isolation - only returns events for the requested household
   * @param taskId - UUID of the task
   * @param householdId - UUID of the household (for isolation check)
   * @param limit - Maximum number of events to return (default: 100)
   * @returns Array of TaskEvents in reverse chronological order (newest first)
   * @throws ValidationError if taskId or householdId missing
   * @throws ForbiddenError if cross-household query detected
   */
  async getEventHistory(taskId: string, householdId: string, limit = 100): Promise<TaskEvent[]> {
    if (!taskId || !householdId) {
      throw new ValidationError('taskId and householdId are required');
    }

    if (limit < 1 || limit > 1000) {
      throw new ValidationError('limit must be between 1 and 1000');
    }

    const eventEntities = await this.repository
      .createQueryBuilder('event')
      .where('event.taskId = :taskId', { taskId })
      .andWhere('event.householdId = :householdId', { householdId })
      .orderBy('event.timestamp', 'DESC')
      .limit(limit)
      .getMany();

    return eventEntities.map((entity) => entity.toTaskEvent());
  }

  /**
   * Retrieve all events triggered by a specific user within their household
   * Returns events in reverse chronological order
   * Enforces household isolation - only returns events from the specified household
   * @param userId - UUID of the user
   * @param householdId - UUID of the household (for isolation check)
   * @param limit - Maximum number of events to return (default: 100)
   * @returns Array of TaskEvents in reverse chronological order (newest first)
   * @throws ValidationError if userId or householdId missing
   */
  async getEventsByUser(userId: string, householdId: string, limit = 100): Promise<TaskEvent[]> {
    if (!userId || !householdId) {
      throw new ValidationError('userId and householdId are required');
    }

    if (limit < 1 || limit > 1000) {
      throw new ValidationError('limit must be between 1 and 1000');
    }

    const eventEntities = await this.repository
      .createQueryBuilder('event')
      .where('event.userId = :userId', { userId })
      .andWhere('event.householdId = :householdId', { householdId })
      .orderBy('event.timestamp', 'DESC')
      .limit(limit)
      .getMany();

    return eventEntities.map((entity) => entity.toTaskEvent());
  }

  /**
   * Query events by date range with optional household isolation
   * Enforces household isolation - must specify householdId for multi-tenant safety
   * Returns results in reverse chronological order
   * Efficient queries using indexes on (householdId, timestamp)
   * @param startTime - Start of date range (Unix milliseconds, inclusive)
   * @param endTime - End of date range (Unix milliseconds, inclusive)
   * @param householdId - UUID of the household (required for isolation)
   * @returns Array of TaskEvents matching criteria in reverse chronological order
   * @throws ValidationError if householdId missing or time range invalid
   */
  async queryEventsByDateRange(
    startTime: number,
    endTime: number,
    householdId: string
  ): Promise<TaskEvent[]> {
    if (!householdId) {
      throw new ValidationError('householdId is required for security isolation');
    }

    if (!startTime || !endTime) {
      throw new ValidationError('startTime and endTime are required');
    }

    if (startTime > endTime) {
      throw new ValidationError('startTime must be less than or equal to endTime');
    }

    // Limit query to reasonable time windows (e.g., max 90 days) to prevent resource exhaustion
    const maxWindowMs = 90 * 24 * 60 * 60 * 1000;
    if (endTime - startTime > maxWindowMs) {
      throw new ValidationError('Date range cannot exceed 90 days');
    }

    const eventEntities = await this.repository
      .createQueryBuilder('event')
      .where('event.householdId = :householdId', { householdId })
      .andWhere('event.timestamp >= :startTime', { startTime })
      .andWhere('event.timestamp <= :endTime', { endTime })
      .orderBy('event.timestamp', 'DESC')
      .getMany();

    return eventEntities.map((entity) => entity.toTaskEvent());
  }

  /**
   * Query events by action type within a household
   * Useful for filtering events by type (execute, acknowledge, undo, comment)
   * @param householdId - UUID of the household (for isolation)
   * @param action - Type of action to filter by
   * @param limit - Maximum number of events to return
   * @returns Array of TaskEvents matching criteria
   */
  async getEventsByAction(
    householdId: string,
    action: 'execute' | 'acknowledge' | 'undo' | 'comment',
    limit = 100
  ): Promise<TaskEvent[]> {
    if (!householdId) {
      throw new ValidationError('householdId is required');
    }

    if (!['execute', 'acknowledge', 'undo', 'comment'].includes(action)) {
      throw new ValidationError('Invalid action type');
    }

    const eventEntities = await this.repository
      .createQueryBuilder('event')
      .where('event.householdId = :householdId', { householdId })
      .andWhere('event.action = :action', { action })
      .orderBy('event.timestamp', 'DESC')
      .limit(limit)
      .getMany();

    return eventEntities.map((entity) => entity.toTaskEvent());
  }

  /**
   * Prevent modification of events (called by update/delete operations)
   * Events are write-once: can only be created, never updated or deleted
   * This method is called before any update/delete to enforce immutability at app level
   * @throws Error always - events cannot be modified
   */
  private preventModification(): never {
    throw new Error(
      'Cannot modify or delete task events. Events are immutable and can only be created. ' +
        'This is a fundamental audit trail requirement.'
    );
  }

  /**
   * Attempted update - always fails
   * Events are immutable; use logEvent() to create new events instead
   */
  async updateEvent(): Promise<never> {
    return this.preventModification();
  }

  /**
   * Attempted delete - always fails
   * Events are immutable and preserved for audit purposes
   */
  async deleteEvent(): Promise<never> {
    return this.preventModification();
  }

  /**
   * Count total events in a household
   * Used for statistics and monitoring
   * @param householdId - UUID of the household
   * @returns Number of events
   */
  async countEvents(householdId: string): Promise<number> {
    if (!householdId) {
      throw new ValidationError('householdId is required');
    }

    return this.repository.count({
      where: { householdId },
    });
  }

  /**
   * Get event count by action type
   * Used for analytics
   * @param householdId - UUID of the household
   * @returns Map of action type to count
   */
  async countEventsByAction(householdId: string): Promise<Map<string, number>> {
    if (!householdId) {
      throw new ValidationError('householdId is required');
    }

    const result = await this.repository
      .createQueryBuilder('event')
      .select('event.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('event.householdId = :householdId', { householdId })
      .groupBy('event.action')
      .getRawMany();

    const map = new Map<string, number>();
    for (const row of result) {
      map.set(row.action, parseInt(row.count, 10));
    }

    return map;
  }
}
