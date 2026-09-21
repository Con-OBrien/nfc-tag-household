/**
 * Database Error Handler
 * Implements connection retry logic with exponential backoff
 * Provides circuit breaker pattern for database operations
 * Handles graceful degradation when database is unavailable
 * 
 * Requirements: 13.6, 13.7, 14.2, 14.5
 */

import { CircuitBreaker } from './CircuitBreaker';

export interface DatabaseErrorHandlerConfig {
  maxRetries: number;
  retryDelayMs: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
}

export class DatabaseErrorHandler {
  private config: DatabaseErrorHandlerConfig;
  private circuitBreaker: CircuitBreaker<any>;
  private connectionAttempts: number = 0;

  constructor(config?: Partial<DatabaseErrorHandlerConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      retryDelayMs: config?.retryDelayMs ?? 1000,
      enableCircuitBreaker: config?.enableCircuitBreaker ?? true,
      circuitBreakerThreshold: config?.circuitBreakerThreshold ?? 5,
    };

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: this.config.circuitBreakerThreshold,
      failureWindow: 60, // 1 minute window
      resetTimeout: 30, // Try again after 30 seconds
    });

    console.log('[DatabaseErrorHandler] Initialized with config:', this.config);
  }

  /**
   * Executes a database operation with retry logic and circuit breaker
   * Implements exponential backoff for transient failures
   * 
   * @param operation - Async function that performs database operation
   * @param operationName - Name of operation for logging
   * @param fallback - Optional fallback function when circuit is open
   * @returns Result of operation or fallback
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'unknown',
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.config.enableCircuitBreaker) {
      // Execute through circuit breaker with retry fallback
      return this.circuitBreaker.execute(
        () => this.retryOperation(operation, operationName),
        fallback
      );
    } else {
      // Execute with retry only (no circuit breaker)
      return this.retryOperation(operation, operationName);
    }
  }

  /**
   * Executes operation with exponential backoff retry logic
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    this.connectionAttempts++;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        console.log(`[DatabaseErrorHandler] Executing '${operationName}' (attempt ${attempt + 1}/${this.config.maxRetries})`);
        const result = await operation();
        console.log(`[DatabaseErrorHandler] '${operationName}' succeeded on attempt ${attempt + 1}`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        const errorMessage = lastError.message;
        const isTransient = this.isTransientError(errorMessage);
        const isLastAttempt = attempt === this.config.maxRetries - 1;

        console.warn(
          `[DatabaseErrorHandler] '${operationName}' failed on attempt ${attempt + 1}/${this.config.maxRetries}. ` +
          `Error: ${errorMessage}. Transient: ${isTransient}.`
        );

        // Don't retry if not transient or if it's the last attempt
        if (!isTransient || isLastAttempt) {
          console.error(`[DatabaseErrorHandler] '${operationName}' failed permanently:`, lastError);
          throw lastError;
        }

        // Wait before retry with exponential backoff
        const delayMs = this.calculateBackoffDelay(attempt);
        console.log(`[DatabaseErrorHandler] Waiting ${delayMs}ms before retry...`);
        await this.sleep(delayMs);
      }
    }

    // Should not reach here, but throw last error just in case
    throw lastError || new Error(`'${operationName}' failed after ${this.config.maxRetries} attempts`);
  }

  /**
   * Determines if error is transient (can be retried) or permanent
   */
  private isTransientError(errorMessage: string): boolean {
    // List of transient error patterns
    const transientPatterns = [
      'ECONNREFUSED', // Connection refused
      'ENOTFOUND',    // DNS not found
      'ETIMEDOUT',    // Connection timeout
      'EHOSTUNREACH', // Host unreachable
      'timeout',      // Generic timeout
      'connection reset',
      'connection refused',
      'network is unreachable',
      'temporarily unavailable',
      'service unavailable',
      'database is locked',
      'too many connections',
    ];

    const lowerMessage = errorMessage.toLowerCase();
    return transientPatterns.some(pattern => lowerMessage.includes(pattern));
  }

  /**
   * Calculates exponential backoff delay
   * Formula: min(retryDelayMs * 2^attempt, 30s)
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = this.config.retryDelayMs * Math.pow(2, attempt);
    const maxDelay = 30000; // Cap at 30 seconds
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    
    // Add jitter (±10%) to prevent thundering herd
    const jitter = cappedDelay * 0.1 * (Math.random() * 2 - 1);
    return cappedDelay + jitter;
  }

  /**
   * Checks if database is currently healthy
   */
  public isHealthy(): boolean {
    return this.circuitBreaker.isHealthy();
  }

  /**
   * Gets circuit breaker state
   */
  public getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
  }

  /**
   * Gets metrics about database operations
   */
  public getMetrics() {
    return {
      circuitBreakerHealthy: this.circuitBreaker.isHealthy(),
      circuitBreakerState: this.circuitBreaker.getState(),
      circuitBreakerMetrics: this.circuitBreaker.getMetrics(),
      connectionAttempts: this.connectionAttempts,
    };
  }

  /**
   * Resets circuit breaker (for testing or manual recovery)
   */
  public resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
    console.log('[DatabaseErrorHandler] Circuit breaker reset');
  }

  /**
   * Utility sleep function
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
