/**
 * Dead Letter Queue (DLQ) for storing and replaying failed operations
 * Implements in-memory queue for failed event writes with retry capability
 * 
 * Requirements: 13.6, 13.7, 14.2, 14.5
 */

export interface DeadLetterItem<T> {
  id: string;
  payload: T;
  timestamp: number;
  attempts: number;
  lastError?: string;
  nextRetryTime?: number;
}

export interface DLQMetrics {
  totalItems: number;
  readyForRetry: number;
  oldestItemAge: number;
  averageAttempts: number;
}

/**
 * In-memory Dead Letter Queue for handling failed database writes and other operations
 * Stores failed operations temporarily and allows for later retry
 */
export class DeadLetterQueue<T> {
  private queue: Map<string, DeadLetterItem<T>> = new Map();
  private maxQueueSize: number = 10000;
  private maxRetryAttempts: number = 10;
  private initialRetryDelayMs: number = 1000; // Start with 1 second
  private maxRetryDelayMs: number = 300000; // Cap at 5 minutes
  private itemIdCounter: number = 0;

  /**
   * Adds an item to the dead letter queue
   * 
   * @param payload - The data that failed to process
   * @param error - The error that occurred
   * @returns Item ID for tracking
   */
  public enqueue(payload: T, error?: string): string {
    if (this.queue.size >= this.maxQueueSize) {
      throw new Error(`Dead Letter Queue is full (max ${this.maxQueueSize} items)`);
    }

    const id = `dlq-${++this.itemIdCounter}-${Date.now()}`;
    const item: DeadLetterItem<T> = {
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
  public getReadyForRetry(): DeadLetterItem<T>[] {
    const now = Date.now();
    const ready: DeadLetterItem<T>[] = [];

    for (const [_, item] of this.queue) {
      if (
        item.attempts < this.maxRetryAttempts &&
        item.nextRetryTime &&
        item.nextRetryTime <= now
      ) {
        ready.push(item);
      }
    }

    return ready;
  }

  /**
   * Marks an item as successfully processed and removes it from queue
   */
  public markProcessed(itemId: string): void {
    this.queue.delete(itemId);
    console.log(`[DLQ] Item ${itemId} successfully processed and removed`);
  }

  /**
   * Marks an item as failed with updated retry time
   */
  public markFailed(itemId: string, error: string): void {
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
    } else {
      // Schedule next retry
      item.nextRetryTime = this.calculateNextRetryTime(item.attempts);
      console.warn(`[DLQ] Item ${itemId} marked as failed. Retry ${item.attempts}/${this.maxRetryAttempts} scheduled for ${new Date(item.nextRetryTime).toISOString()}`);
    }
  }

  /**
   * Manually retries an item (bypasses retry schedule)
   */
  public async retryItem(itemId: string, retryFn: (payload: T) => Promise<void>): Promise<boolean> {
    const item = this.queue.get(itemId);
    if (!item) {
      return false;
    }

    try {
      await retryFn(item.payload);
      this.markProcessed(itemId);
      return true;
    } catch (error) {
      this.markFailed(itemId, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Gets all items in the queue
   */
  public getAllItems(): DeadLetterItem<T>[] {
    return Array.from(this.queue.values());
  }

  /**
   * Gets items matching a predicate
   */
  public getItems(predicate: (item: DeadLetterItem<T>) => boolean): DeadLetterItem<T>[] {
    const results: DeadLetterItem<T>[] = [];
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
  public size(): number {
    return this.queue.size;
  }

  /**
   * Clears all items from queue
   */
  public clear(): void {
    this.queue.clear();
    console.log(`[DLQ] Queue cleared`);
  }

  /**
   * Gets metrics about the queue
   */
  public getMetrics(): DLQMetrics {
    const items = Array.from(this.queue.values());
    const readyForRetry = items.filter(i => i.nextRetryTime && i.nextRetryTime <= Date.now()).length;
    
    let oldestItemAge = 0;
    if (items.length > 0) {
      const oldestItem = items.reduce((oldest, current) =>
        current.timestamp < oldest.timestamp ? current : oldest
      );
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
  public exportState(): string {
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
  private calculateNextRetryTime(attemptNumber: number): number {
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
  public setConfig(config: {
    maxQueueSize?: number;
    maxRetryAttempts?: number;
    initialRetryDelayMs?: number;
    maxRetryDelayMs?: number;
  }): void {
    if (config.maxQueueSize) this.maxQueueSize = config.maxQueueSize;
    if (config.maxRetryAttempts) this.maxRetryAttempts = config.maxRetryAttempts;
    if (config.initialRetryDelayMs) this.initialRetryDelayMs = config.initialRetryDelayMs;
    if (config.maxRetryDelayMs) this.maxRetryDelayMs = config.maxRetryDelayMs;
  }
}
