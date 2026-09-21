"use strict";
/**
 * Dead Letter Queue (DLQ) for storing and replaying failed operations
 * Implements in-memory queue for failed event writes with retry capability
 *
 * Requirements: 13.6, 13.7, 14.2, 14.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeadLetterQueue = void 0;
/**
 * In-memory Dead Letter Queue for handling failed database writes and other operations
 * Stores failed operations temporarily and allows for later retry
 */
class DeadLetterQueue {
    constructor() {
        this.queue = new Map();
        this.maxQueueSize = 10000;
        this.maxRetryAttempts = 10;
        this.initialRetryDelayMs = 1000; // Start with 1 second
        this.maxRetryDelayMs = 300000; // Cap at 5 minutes
        this.itemIdCounter = 0;
    }
    /**
     * Adds an item to the dead letter queue
     *
     * @param payload - The data that failed to process
     * @param error - The error that occurred
     * @returns Item ID for tracking
     */
    enqueue(payload, error) {
        if (this.queue.size >= this.maxQueueSize) {
            throw new Error(`Dead Letter Queue is full (max ${this.maxQueueSize} items)`);
        }
        const id = `dlq-${++this.itemIdCounter}-${Date.now()}`;
        const item = {
            id,
            payload,
            timestamp: Date.now(),
            attempts: 0,
            lastError: error,
            nextRetryTime: this.calculateNextRetryTime(0),
        };
        this.queue.set(id, item);
        console.warn(`[DLQ] Enqueued item ${id}: ${error}`);
        return id;
    }
    /**
     * Gets items ready for retry
     * Returns items where nextRetryTime has passed
     */
    getReadyForRetry() {
        const now = Date.now();
        const ready = [];
        for (const [_, item] of this.queue) {
            if (item.attempts < this.maxRetryAttempts &&
                item.nextRetryTime &&
                item.nextRetryTime <= now) {
                ready.push(item);
            }
        }
        return ready;
    }
    /**
     * Marks an item as successfully processed and removes it from queue
     */
    markProcessed(itemId) {
        this.queue.delete(itemId);
        console.log(`[DLQ] Item ${itemId} successfully processed and removed`);
    }
    /**
     * Marks an item as failed with updated retry time
     */
    markFailed(itemId, error) {
        const item = this.queue.get(itemId);
        if (!item) {
            return;
        }
        item.attempts++;
        item.lastError = error;
        if (item.attempts >= this.maxRetryAttempts) {
            // Give up and log critical error
            console.error(`[DLQ] Item ${itemId} exceeded max retry attempts (${item.attempts}/${this.maxRetryAttempts}). Giving up.`);
            this.queue.delete(itemId);
        }
        else {
            // Schedule next retry
            item.nextRetryTime = this.calculateNextRetryTime(item.attempts);
            console.warn(`[DLQ] Item ${itemId} marked as failed. Retry ${item.attempts}/${this.maxRetryAttempts} scheduled for ${new Date(item.nextRetryTime).toISOString()}`);
        }
    }
    /**
     * Manually retries an item (bypasses retry schedule)
     */
    async retryItem(itemId, retryFn) {
        const item = this.queue.get(itemId);
        if (!item) {
            return false;
        }
        try {
            await retryFn(item.payload);
            this.markProcessed(itemId);
            return true;
        }
        catch (error) {
            this.markFailed(itemId, error instanceof Error ? error.message : String(error));
            return false;
        }
    }
    /**
     * Gets all items in the queue
     */
    getAllItems() {
        return Array.from(this.queue.values());
    }
    /**
     * Gets items matching a predicate
     */
    getItems(predicate) {
        const results = [];
        for (const [_, item] of this.queue) {
            if (predicate(item)) {
                results.push(item);
            }
        }
        return results;
    }
    /**
     * Gets queue size
     */
    size() {
        return this.queue.size;
    }
    /**
     * Clears all items from queue
     */
    clear() {
        this.queue.clear();
        console.log(`[DLQ] Queue cleared`);
    }
    /**
     * Gets metrics about the queue
     */
    getMetrics() {
        const items = Array.from(this.queue.values());
        const readyForRetry = items.filter(i => i.nextRetryTime && i.nextRetryTime <= Date.now()).length;
        let oldestItemAge = 0;
        if (items.length > 0) {
            const oldestItem = items.reduce((oldest, current) => current.timestamp < oldest.timestamp ? current : oldest);
            oldestItemAge = Date.now() - oldestItem.timestamp;
        }
        const averageAttempts = items.length > 0 ?
            items.reduce((sum, item) => sum + item.attempts, 0) / items.length :
            0;
        return {
            totalItems: items.length,
            readyForRetry,
            oldestItemAge,
            averageAttempts,
        };
    }
    /**
     * Exports queue state for monitoring/debugging
     */
    exportState() {
        const metrics = this.getMetrics();
        const items = Array.from(this.queue.values()).map(item => ({
            id: item.id,
            attempts: item.attempts,
            lastError: item.lastError,
            age: Date.now() - item.timestamp,
            nextRetryIn: item.nextRetryTime ? Math.max(0, item.nextRetryTime - Date.now()) : 0,
        }));
        return JSON.stringify({
            metrics,
            items,
            timestamp: new Date().toISOString(),
        }, null, 2);
    }
    /**
     * Calculates next retry time using exponential backoff
     * Formula: min(initialDelay * 2^attempt, maxDelay)
     */
    calculateNextRetryTime(attemptNumber) {
        const exponentialDelay = this.initialRetryDelayMs * Math.pow(2, attemptNumber);
        const cappedDelay = Math.min(exponentialDelay, this.maxRetryDelayMs);
        // Add jitter (±10%) to prevent thundering herd
        const jitter = cappedDelay * 0.1 * (Math.random() * 2 - 1);
        const finalDelay = cappedDelay + jitter;
        return Date.now() + finalDelay;
    }
    /**
     * Sets configuration for retry behavior
     */
    setConfig(config) {
        if (config.maxQueueSize)
            this.maxQueueSize = config.maxQueueSize;
        if (config.maxRetryAttempts)
            this.maxRetryAttempts = config.maxRetryAttempts;
        if (config.initialRetryDelayMs)
            this.initialRetryDelayMs = config.initialRetryDelayMs;
        if (config.maxRetryDelayMs)
            this.maxRetryDelayMs = config.maxRetryDelayMs;
    }
}
exports.DeadLetterQueue = DeadLetterQueue;
