"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventProcessorService = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * EventProcessorService - Converts NFC scan events to structured task events
 * Handles duplicate detection, event enrichment, and audit trail logging
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 1.4
 */
class EventProcessorService {
    constructor(eventRepository) {
        this.deduplicationWindow = new Map(); // key: userId:taskId, value: timestamp
        this.eventRepository = eventRepository;
    }
    /**
     * Generates a unique event ID
     */
    generateEventId() {
        return 'evt_' + crypto_1.default.randomBytes(12).toString('hex');
    }
    /**
     * Processes an NFC tag scan event and converts it to a structured task event
     * Handles deduplication and event persistence
     *
     * @param nfcData - The NFC tag data from the scan
     * @param userId - The user ID of the person who scanned
     * @param householdId - The household ID context
     * @returns The created task event or null if duplicate
     *
     * Requirements: 2.1, 2.2, 2.3, 2.5, 1.4
     */
    async processTagEvent(nfcData, userId, householdId) {
        // Check for duplicate scan within deduplication window
        const isDuplicate = this.isDuplicateScan(userId, nfcData.taskId, nfcData.timestamp);
        if (isDuplicate) {
            return null;
        }
        try {
            // Create task event structure
            const event = this.createTaskEvent(nfcData, userId, householdId);
            // Log event to audit trail (persist exactly once)
            await this.eventRepository.logEvent(event);
            // Record deduplication marker
            this.recordScan(userId, nfcData.taskId, nfcData.timestamp);
            return event;
        }
        catch (error) {
            // If event persistence fails, log error and don't record deduplication
            console.error('Failed to persist event:', error);
            throw error;
        }
    }
    /**
     * Enriches a task event with user context
     * Adds user, household, and permission information
     *
     * @param event - The task event to enrich
     * @param enrichmentData - Additional context data
     * @returns The enriched task event
     *
     * Requirements: 2.2
     */
    enrichEventWithUserContext(event, enrichmentData) {
        return {
            ...event,
            userId: enrichmentData.userId,
            householdId: enrichmentData.householdId,
        };
    }
    /**
     * Validates event integrity before processing
     * Ensures event has all required fields and is properly formed
     *
     * @param event - The task event to validate
     * @returns true if event is valid, false otherwise
     *
     * Requirements: 2.3
     */
    validateEventIntegrity(event) {
        // Check all required fields exist
        if (!event.eventId || !event.userId || !event.taskId || !event.householdId) {
            return false;
        }
        // Check action is valid
        const validActions = ['execute', 'acknowledge', 'undo', 'comment'];
        if (!validActions.includes(event.action)) {
            return false;
        }
        // Check timestamp is valid and recent
        if (!Number.isFinite(event.timestamp) || event.timestamp <= 0) {
            return false;
        }
        // Timestamp should not be in the future
        if (event.timestamp > Date.now()) {
            return false;
        }
        // All string fields should be non-empty
        if (typeof event.eventId !== 'string' || event.eventId.trim().length === 0) {
            return false;
        }
        if (typeof event.userId !== 'string' || event.userId.trim().length === 0) {
            return false;
        }
        if (typeof event.taskId !== 'string' || event.taskId.trim().length === 0) {
            return false;
        }
        if (typeof event.householdId !== 'string' || event.householdId.trim().length === 0) {
            return false;
        }
        return true;
    }
    /**
     * Retrieves recent events for a task to check for duplicates
     * Optimizes for performance by checking in-memory cache first
     *
     * @param taskId - The task ID
     * @param userId - The user ID
     * @returns Recent events for this task/user combination
     *
     * Requirements: 1.4
     */
    async getRecentEventsForTask(taskId, userId, householdId) {
        try {
            // Get events from repository
            const recentEvents = await this.eventRepository.getEventsByUser(userId, householdId);
            // Filter to only events for this specific task from the past 30 seconds
            const thirtySecondsAgo = Date.now() - 30 * 1000;
            return recentEvents.filter((event) => event.taskId === taskId &&
                event.userId === userId &&
                event.timestamp >= thirtySecondsAgo);
        }
        catch (error) {
            console.error('Failed to retrieve recent events:', error);
            return [];
        }
    }
    /**
     * Clears old deduplication entries to prevent memory leaks
     * Should be called periodically (e.g., every 5 minutes)
     *
     * Requirements: General memory management
     */
    cleanupOldDeduplicationEntries() {
        const oneMinuteAgo = Date.now() - 60 * 1000;
        const toDelete = [];
        this.deduplicationWindow.forEach((timestamp, key) => {
            if (timestamp < oneMinuteAgo) {
                toDelete.push(key);
            }
        });
        toDelete.forEach((key) => {
            this.deduplicationWindow.delete(key);
        });
    }
    /**
     * Creates a new task event from NFC tag data
     *
     * @param nfcData - The NFC tag data
     * @param userId - The user ID who scanned
     * @param householdId - The household ID
     * @returns New task event
     */
    createTaskEvent(nfcData, userId, householdId) {
        return {
            eventId: this.generateEventId(),
            userId,
            taskId: nfcData.taskId,
            householdId,
            action: 'execute',
            timestamp: nfcData.timestamp,
            metadata: {
                deviceType: 'nfc-reader',
                tagId: nfcData.tagId,
            },
        };
    }
    /**
     * Checks if a scan is a duplicate based on time window
     * Looks for identical userId:taskId within 30 seconds
     *
     * @param userId - The user ID
     * @param taskId - The task ID
     * @param timestamp - The scan timestamp
     * @returns true if this is a duplicate scan, false otherwise
     *
     * Requirements: 1.4
     */
    isDuplicateScan(userId, taskId, timestamp) {
        const key = `${userId}:${taskId}`;
        const lastScanTime = this.deduplicationWindow.get(key);
        if (!lastScanTime) {
            return false;
        }
        // Check if within 30-second window
        const thirtySecondsInMs = 30 * 1000;
        return timestamp - lastScanTime < thirtySecondsInMs;
    }
    /**
     * Records a scan for deduplication tracking
     *
     * @param userId - The user ID
     * @param taskId - The task ID
     * @param timestamp - The scan timestamp
     */
    recordScan(userId, taskId, timestamp) {
        const key = `${userId}:${taskId}`;
        this.deduplicationWindow.set(key, timestamp);
    }
}
exports.EventProcessorService = EventProcessorService;
