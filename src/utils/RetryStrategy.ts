/**
 * Retry Strategy for External Services
 * Provides configurable retry logic with exponential backoff for FCM, APNs, and other external services
 * Tracks metrics and failure reasons for monitoring
 * 
 * Requirements: 14.6, 14.7, 14.8, 14.9
 */

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

export enum FailureReason {
  TIMEOUT = 'timeout',
  RATE_LIMITED = 'rate_limited',
  AUTH_ERROR = 'auth_error',
  INVALID_TOKEN = 'invalid_token',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown',
}

export interface RetryAttempt {
  attemptNumber: number;
  timestamp: number;
  error?: string;
  statusCode?: number;
}

export interface RetryMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  failureReasons: Map<FailureReason, number>;
  averageAttempts: number;
  lastAttemptTime?: number;
}

/**
 * Retry Strategy for handling external service failures
 */
export class RetryStrategy {
  private config: RetryConfig;
  private attempts: RetryAttempt[] = [];
  private metrics: Map<string, RetryMetrics> = new Map();

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxAttempts: config?.maxAttempts ?? 3,
      initialDelayMs: config?.initialDelayMs ?? 1000,
      maxDelayMs: config?.maxDelayMs ?? 30000,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
      timeoutMs: config?.timeoutMs ?? 10000,
    };
  }

  /**
   * Executes a function with retry logic and timeout
   * Implements exponential backoff for transient failures
   * 
   * @param fn - Async function to retry
   * @param serviceId - Service identifier for metrics tracking
   * @returns Result or throws error after max attempts
   */
  public async executeWithRetry<T>(
    fn: () => Promise<T>,
    serviceId: string = 'default'
  ): Promise<T> {
    const attempts: RetryAttempt[] = [];
    let lastError: Error | null = null;
    let lastFailureReason: FailureReason = FailureReason.UNKNOWN;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      const attemptRecord: RetryAttempt = {
        attemptNumber: attempt,
        timestamp: Date.now(),
      };

      try {
        console.log(`[RetryStrategy] Executing ${serviceId} (attempt ${attempt}/${this.config.maxAttempts})`);

        // Execute with timeout
        const result = await Promise.race([
          fn(),
          new Promise<T>((_, reject) =>
            setTimeout(
              () => reject(new Error('Operation timeout')),
              this.config.timeoutMs
            )
          ),
        ]);

        console.log(`[RetryStrategy] ${serviceId} succeeded on attempt ${attempt}`);
        this.recordSuccess(serviceId, attempts);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        lastFailureReason = this.classifyFailure(lastError);
        attemptRecord.error = lastError.message;
        attempts.push(attemptRecord);

        const isLastAttempt = attempt === this.config.maxAttempts;
        const shouldRetry = this.shouldRetry(lastFailureReason, isLastAttempt);

        console.warn(
          `[RetryStrategy] ${serviceId} failed on attempt ${attempt}/${this.config.maxAttempts}. ` +
          `Reason: ${lastFailureReason}. Retry: ${shouldRetry}`
        );

        if (!shouldRetry) {
          console.error(`[RetryStrategy] ${serviceId} failed permanently (${lastFailureReason})`);
          this.recordFailure(serviceId, attempts, lastFailureReason);
          throw lastError;
        }

        // Wait before retry with exponential backoff
        if (attempt < this.config.maxAttempts) {
          const delayMs = this.calculateDelay(attempt - 1);
          console.log(`[RetryStrategy] Waiting ${delayMs}ms before retry...`);
          await this.sleep(delayMs);
        }
      }
    }

    // Max attempts exceeded
    this.recordFailure(serviceId, attempts, lastFailureReason);
    throw lastError || new Error(`${serviceId} failed after ${this.config.maxAttempts} attempts`);
  }

  /**
   * Classifies failure reason from error
   */
  private classifyFailure(error: Error): FailureReason {
    const message = error.message.toLowerCase();
    const errorCode = (error as any).code;

    if (message.includes('timeout') || errorCode === 'ETIMEDOUT') {
      return FailureReason.TIMEOUT;
    }

    if (message.includes('429') || message.includes('rate limit')) {
      return FailureReason.RATE_LIMITED;
    }

    if (message.includes('401') || message.includes('unauthorized')) {
      return FailureReason.AUTH_ERROR;
    }

    if (message.includes('expired token') || message.includes('invalid token')) {
      return FailureReason.INVALID_TOKEN;
    }

    if (message.includes('503') || message.includes('service unavailable')) {
      return FailureReason.SERVICE_UNAVAILABLE;
    }

    if (
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('network') ||
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'ENOTFOUND'
    ) {
      return FailureReason.NETWORK_ERROR;
    }

    return FailureReason.UNKNOWN;
  }

  /**
   * Determines if error should be retried
   */
  private shouldRetry(reason: FailureReason, isLastAttempt: boolean): boolean {
    if (isLastAttempt) {
      return false;
    }

    // Permanent errors - don't retry
    const nonRetryableErrors = [
      FailureReason.AUTH_ERROR,
      FailureReason.INVALID_TOKEN,
    ];

    if (nonRetryableErrors.includes(reason)) {
      return false;
    }

    // Transient errors - retry
    return true;
  }

  /**
   * Calculates exponential backoff delay with jitter
   */
  private calculateDelay(attemptNumber: number): number {
    const exponentialDelay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attemptNumber);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);
    
    // Add jitter (±10%)
    const jitter = cappedDelay * 0.1 * (Math.random() * 2 - 1);
    return cappedDelay + jitter;
  }

  /**
   * Records successful retry
   */
  private recordSuccess(serviceId: string, attempts: RetryAttempt[]): void {
    const metrics = this.getOrCreateMetrics(serviceId);
    metrics.totalAttempts += attempts.length;
    metrics.successfulAttempts++;
    metrics.lastAttemptTime = Date.now();
  }

  /**
   * Records failed retry
   */
  private recordFailure(serviceId: string, attempts: RetryAttempt[], reason: FailureReason): void {
    const metrics = this.getOrCreateMetrics(serviceId);
    metrics.totalAttempts += attempts.length;
    metrics.failedAttempts++;
    metrics.lastAttemptTime = Date.now();
    
    // Track failure reason
    const count = metrics.failureReasons.get(reason) || 0;
    metrics.failureReasons.set(reason, count + 1);
  }

  /**
   * Gets or creates metrics for a service
   */
  private getOrCreateMetrics(serviceId: string): RetryMetrics {
    if (!this.metrics.has(serviceId)) {
      this.metrics.set(serviceId, {
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        failureReasons: new Map(),
        averageAttempts: 0,
      });
    }
    return this.metrics.get(serviceId)!;
  }

  /**
   * Gets metrics for a service
   */
  public getMetrics(serviceId?: string): Map<string, RetryMetrics> | RetryMetrics | undefined {
    if (serviceId) {
      const metrics = this.metrics.get(serviceId);
      if (metrics) {
        metrics.averageAttempts = 
          metrics.totalAttempts > 0 ?
            metrics.totalAttempts / (metrics.successfulAttempts + metrics.failedAttempts) :
            0;
      }
      return metrics;
    }

    // Return all metrics
    for (const [_, metrics] of this.metrics) {
      metrics.averageAttempts = 
        metrics.totalAttempts > 0 ?
          metrics.totalAttempts / (metrics.successfulAttempts + metrics.failedAttempts) :
          0;
    }

    return this.metrics;
  }

  /**
   * Clears metrics
   */
  public clearMetrics(serviceId?: string): void {
    if (serviceId) {
      this.metrics.delete(serviceId);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Utility sleep function
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets configuration
   */
  public getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Updates configuration
   */
  public setConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
