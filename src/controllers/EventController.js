"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventController = void 0;
const EventRepository_1 = require("../repositories/EventRepository");
const UserRepository_1 = require("../repositories/UserRepository");
const HouseholdRepository_1 = require("../repositories/HouseholdRepository");
const TaskRepository_1 = require("../repositories/TaskRepository");
const EventProcessorService_1 = require("../services/EventProcessorService");
const TaskValidatorService_1 = require("../services/TaskValidatorService");
const NotificationService_1 = require("../services/NotificationService");
const NFCReaderService_1 = require("../services/NFCReaderService");
const types_1 = require("../types");
/**
 * EventController - Handles all event HTTP requests
 * Requirements: 10.4, 10.5, 10.6, 10.7, 10.8, 1.1, 2.1, 3.1, 5.1
 *
 * Manages:
 * - NFC tag scan event ingestion (POST /events/tag-scanned)
 * - Event history queries per household
 * - Single event retrieval
 * - User's personal event history
 * - Filtering by action type, date range, actor
 * - Pagination
 */
class EventController {
    constructor() {
        this.eventRepository = new EventRepository_1.EventRepository();
        this.userRepository = new UserRepository_1.UserRepository();
        const taskRepository = new TaskRepository_1.TaskRepository();
        const householdRepository = new HouseholdRepository_1.HouseholdRepository();
        this.eventProcessor = new EventProcessorService_1.EventProcessorService(this.eventRepository);
        this.taskValidator = new TaskValidatorService_1.TaskValidatorService(taskRepository, this.userRepository);
        this.notificationService = new NotificationService_1.NotificationService(this.userRepository, householdRepository, taskRepository, this.eventRepository);
        this.nfcReader = new NFCReaderService_1.NFCReaderService();
    }
    /**
     * POST /api/events/tag-scanned
     * Main NFC scan event ingestion endpoint
     *
     * Wires complete event processing pipeline:
     * 1. Parse and validate NFC tag data
     * 2. Validate tag signature (optional, if signature provided)
     * 3. Extract task/user context
     * 4. Validate task exists and is active
     * 5. Validate user has permissions
     * 6. Create and persist event
     * 7. Send notifications to household members
     * 8. Return success with event details
     *
     * Request body:
     * {
     *   tagSignature: string (optional, for signature verification),
     *   tagData: string (encoded tag data),
     *   userId: string (user who scanned the tag),
     *   householdId: string (household context),
     *   timestamp: number (milliseconds since epoch)
     * }
     *
     * Response: 200 OK on success
     * {
     *   success: true,
     *   data: {
     *     eventId: string,
     *     taskId: string,
     *     notificationsSent: number,
     *     timestamp: number
     *   },
     *   timestamp: number
     * }
     *
     * Error responses:
     * - 400: Validation error (invalid tag data, missing fields)
     * - 403: Unauthorized (user not in household, invalid signature)
     * - 404: Task not found
     * - 500: Server error (processing error)
     *
     * Requirements: 1.1, 2.1, 3.1, 5.1
     */
    async tagScanned(req, res, next) {
        try {
            // Step 1: Parse request body
            const { tagSignature, tagData, userId, householdId, timestamp } = req.body;
            // Validate required fields
            if (!tagData || typeof tagData !== 'string') {
                throw new types_1.ValidationError('tagData is required and must be a string');
            }
            if (!userId || typeof userId !== 'string') {
                throw new types_1.ValidationError('userId is required and must be a string');
            }
            if (!householdId || typeof householdId !== 'string') {
                throw new types_1.ValidationError('householdId is required and must be a string');
            }
            if (typeof timestamp !== 'number' || timestamp <= 0) {
                throw new types_1.ValidationError('timestamp is required and must be a positive number');
            }
            // Validate timestamp is not too old (more than 5 minutes)
            const fiveMinutesMs = 5 * 60 * 1000;
            if (Date.now() - timestamp > fiveMinutesMs) {
                throw new types_1.ValidationError('Tag scan is too old (must be within 5 minutes)');
            }
            // Step 2: Parse NFC tag data
            let nfcData;
            try {
                // tagData should be JSON-encoded or base64-encoded
                let decodedData;
                try {
                    decodedData = Buffer.from(tagData, 'base64').toString('utf-8');
                }
                catch {
                    decodedData = tagData; // If not base64, treat as plain string
                }
                // Try to parse as JSON
                const parsed = typeof decodedData === 'string' ? JSON.parse(decodedData) : decodedData;
                nfcData = {
                    tagId: parsed.tagId || parsed.id,
                    taskId: parsed.taskId || parsed.task_id,
                    timestamp: parsed.timestamp || timestamp,
                    signature: tagSignature || parsed.signature,
                };
                // Validate parsed data
                if (!nfcData.tagId || !nfcData.taskId) {
                    throw new types_1.ValidationError('Tag data must contain tagId and taskId');
                }
            }
            catch (e) {
                throw new types_1.ValidationError(`Failed to parse tag data: ${e instanceof Error ? e.message : String(e)}`);
            }
            // Step 3: Validate tag signature if provided
            if (tagSignature) {
                const isValidSignature = await this.nfcReader.validateTagSignature(nfcData, householdId);
                if (!isValidSignature) {
                    throw new types_1.ForbiddenError('Invalid tag signature');
                }
            }
            // Step 4: Verify user belongs to household (household isolation)
            const userInHousehold = await this.userRepository.isUserInHousehold(userId, householdId);
            if (!userInHousehold) {
                throw new types_1.ForbiddenError('User does not belong to this household');
            }
            // Step 5: Validate task and user permissions
            const validationResult = await this.taskValidator.validateTaskCanExecute(userId, nfcData.taskId, householdId);
            if (!validationResult.isValid) {
                const errorMsg = validationResult.errors.length > 0
                    ? validationResult.errors[0]
                    : 'Task validation failed';
                // Determine appropriate error code based on validation error
                if (errorMsg.includes('not found')) {
                    throw new types_1.NotFoundError('Task');
                }
                else if (errorMsg.includes('not active')) {
                    throw new types_1.ValidationError(errorMsg);
                }
                else if (errorMsg.includes('Unauthorized')) {
                    throw new types_1.ForbiddenError(errorMsg);
                }
                else {
                    throw new types_1.ValidationError(errorMsg);
                }
            }
            // Step 6: Process event (creates event and checks for duplicates)
            const event = await this.eventProcessor.processTagEvent(nfcData, userId, householdId);
            if (!event) {
                // Duplicate event detected (same user, same task within 30 seconds)
                throw new types_1.ValidationError('Duplicate scan detected (duplicate within 30 seconds)');
            }
            // Step 7: Validate event integrity
            if (!this.eventProcessor.validateEventIntegrity(event)) {
                throw new types_1.ValidationError('Event integrity validation failed');
            }
            // Step 8: Send notifications to household members
            let notificationsSent = 0;
            try {
                const householdMembers = validationResult.allowedUsers || [];
                if (householdMembers.length > 0) {
                    // Create notification payload
                    const notificationPayload = {
                        title: `Task Executed: ${validationResult.task?.name || 'Unknown Task'}`,
                        body: `${validationResult.task?.description || 'Task completed'}`,
                        data: {
                            taskId: nfcData.taskId,
                            eventId: event.eventId,
                            eventType: 'execute',
                            timestamp: event.timestamp,
                        },
                        deepLink: `/tasks/${nfcData.taskId}/events/${event.eventId}`,
                    };
                    // Send notifications to all household members except executor
                    const recipientsToNotify = householdMembers.filter((m) => m.userId !== userId);
                    if (recipientsToNotify.length > 0) {
                        const notificationResult = await this.notificationService.sendNotification(notificationPayload, recipientsToNotify, event.eventId, nfcData.taskId, householdId);
                        notificationsSent = notificationResult.delivered.length;
                    }
                }
            }
            catch (notificationError) {
                // Log notification error but don't fail the event creation
                console.error('Notification delivery error:', notificationError);
                // Still return success for the event itself
            }
            // Step 9: Return success response
            const response = {
                success: true,
                data: {
                    eventId: event.eventId,
                    taskId: nfcData.taskId,
                    notificationsSent,
                    timestamp: Date.now(),
                },
                timestamp: Date.now(),
            };
            res.status(200).json(response);
        }
        catch (error) {
            next(error);
        }
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
    async getHouseholdEvents(req, res, next) {
        try {
            // Extract user ID from authenticated request
            const userId = req.userId;
            if (!userId) {
                throw new types_1.ValidationError('User not authenticated');
            }
            // Extract householdId from URL parameters
            const householdId = req.params.householdId;
            if (!householdId) {
                throw new types_1.ValidationError('householdId is required');
            }
            // Verify user is member of household (household isolation)
            const userInHousehold = await this.userRepository.isUserInHousehold(userId, householdId);
            if (!userInHousehold) {
                throw new types_1.ForbiddenError('User is not a member of this household');
            }
            // Parse query parameters
            const actionFilter = req.query.action;
            const startDateStr = req.query.startDate;
            const endDateStr = req.query.endDate;
            const actorFilter = req.query.actor;
            const skipStr = req.query.skip || '0';
            const limitStr = req.query.limit || '50';
            // Parse and validate pagination parameters
            const skipVal = parseInt(skipStr, 10);
            const limitVal = parseInt(limitStr, 10);
            if (isNaN(skipVal) || isNaN(limitVal)) {
                throw new types_1.ValidationError('skip and limit must be valid integers');
            }
            let skip = Math.max(0, skipVal);
            let limit = Math.max(1, Math.min(100, limitVal)); // Max 100 per request
            // Parse and validate date range
            let startDate;
            let endDate;
            if (startDateStr !== undefined) {
                const startVal = parseInt(startDateStr, 10);
                if (isNaN(startVal)) {
                    throw new types_1.ValidationError('startDate must be a valid millisecond timestamp');
                }
                startDate = startVal;
            }
            if (endDateStr !== undefined) {
                const endVal = parseInt(endDateStr, 10);
                if (isNaN(endVal)) {
                    throw new types_1.ValidationError('endDate must be a valid millisecond timestamp');
                }
                endDate = endVal;
            }
            // Validate date range if both provided
            if (startDate !== undefined && endDate !== undefined && startDate > endDate) {
                throw new types_1.ValidationError('startDate must be before endDate');
            }
            // Query events from repository
            let events = [];
            // If date range filtering is requested, use that method
            if (startDate !== undefined || endDate !== undefined) {
                events = await this.eventRepository.queryEventsByDateRange(startDate || 0, endDate || Date.now(), householdId);
            }
            else {
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
            const response = {
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
        }
        catch (error) {
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
    async getEventById(req, res, next) {
        try {
            // Extract user ID from authenticated request
            const userId = req.userId;
            if (!userId) {
                throw new types_1.ValidationError('User not authenticated');
            }
            // Extract IDs from URL parameters
            const householdId = req.params.householdId;
            const eventId = req.params.eventId;
            if (!householdId || !eventId) {
                throw new types_1.ValidationError('householdId and eventId are required');
            }
            // Verify user is member of household (household isolation)
            const userInHousehold = await this.userRepository.isUserInHousehold(userId, householdId);
            if (!userInHousehold) {
                throw new types_1.ForbiddenError('User is not a member of this household');
            }
            // Get the event - we need to verify it belongs to this household
            // Get all events for household and find the one
            const events = await this.eventRepository.getHouseholdEvents(householdId, 1000);
            const event = events.find((e) => e.eventId === eventId);
            if (!event) {
                throw new types_1.NotFoundError('Event');
            }
            // Return success response
            const response = {
                success: true,
                data: event,
                timestamp: Date.now(),
            };
            res.status(200).json(response);
        }
        catch (error) {
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
    async getUserEvents(req, res, next) {
        try {
            // Extract user ID from authenticated request
            const userId = req.userId;
            if (!userId) {
                throw new types_1.ValidationError('User not authenticated');
            }
            // Parse query parameters
            const actionFilter = req.query.action;
            const startDateStr = req.query.startDate;
            const endDateStr = req.query.endDate;
            const skipStr = req.query.skip || '0';
            const limitStr = req.query.limit || '50';
            // Parse and validate pagination parameters
            const skipVal = parseInt(skipStr, 10);
            const limitVal = parseInt(limitStr, 10);
            if (isNaN(skipVal) || isNaN(limitVal)) {
                throw new types_1.ValidationError('skip and limit must be valid integers');
            }
            let skip = Math.max(0, skipVal);
            let limit = Math.max(1, Math.min(100, limitVal)); // Max 100 per request
            // Parse and validate date range
            let startDate;
            let endDate;
            if (startDateStr !== undefined) {
                const startVal = parseInt(startDateStr, 10);
                if (isNaN(startVal)) {
                    throw new types_1.ValidationError('startDate must be a valid millisecond timestamp');
                }
                startDate = startVal;
            }
            if (endDateStr !== undefined) {
                const endVal = parseInt(endDateStr, 10);
                if (isNaN(endVal)) {
                    throw new types_1.ValidationError('endDate must be a valid millisecond timestamp');
                }
                endDate = endVal;
            }
            // Validate date range if both provided
            if (startDate !== undefined && endDate !== undefined && startDate > endDate) {
                throw new types_1.ValidationError('startDate must be before endDate');
            }
            // Get user's households to aggregate events across them
            const user = await this.userRepository.findUserDetails(userId);
            if (!user) {
                throw new types_1.NotFoundError('User');
            }
            // Get all events for this user across all their households
            let events = [];
            // Get list of households user belongs to
            const userHouseholds = await this.userRepository.getUserHouseholds(userId);
            if (startDate !== undefined || endDate !== undefined) {
                // Query events across all their households with date range
                for (const household of userHouseholds) {
                    const householdEvents = await this.eventRepository.queryEventsByDateRange(startDate || 0, endDate || Date.now(), household.householdId);
                    events = events.concat(householdEvents);
                }
            }
            else {
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
            const response = {
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
        }
        catch (error) {
            next(error);
        }
    }
}
exports.EventController = EventController;
exports.default = EventController;
