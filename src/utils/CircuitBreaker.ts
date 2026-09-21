/**
 * Circuit Breaker pattern implementation for fault tolerance
 * Implements: Closed -> Open -> Half-Open -> Closed state machine
 * Prevents cascading failures by failing fast when service is unavailable
 * 
 * Requirements: 14.2, 14.3, 14.4, 14.5
 */

export interface CircuitBreakerConfig {
  // Threshold for failures before opening circuit (default: 5)
  failureThreshold: number;
  // Time window for counting failures in seconds (default: 60)
  failureWindow: number;
  // Time to keep circuit open before attempting half-open in seconds (default: 30)
  resetTimeout: number;
  // Maximum number of requests allowed in half-open state (default: 1)
  halfOpenMaxAttempts: number;
}

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  state: CircuitBreakerState;
  stateChangedAt: number;
}

/**
 * Generic Circuit Breaker for protecting external service calls
 * Used for database connections, API calls, and other external dependencies
 */
export class CircuitBreaker<T> {
  private config: Required<CircuitBreakerConfig>;
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureTimestamps: number[] = [];
  private successCount: number = 0;
  private halfOpenAttempts: number = 0;
  private stateChangedAt: number = Date.now();
  private lastOpenTime: number = 0;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      failureWindow: config?.failureWindow ?? 60,
      resetTimeout: config?.resetTimeout ?? 30,
      halfOpenMaxAttempts: config?.halfOpenMaxAttempts ?? 1,
    };
  }

  /**
   * Executes a function with circuit breaker protection
   * 
   * @param fn - Async function to execute
   * @param fallback - Optional fallback function if circuit is open
   * @returns Result of function or fallback
   */
  public async execute<R>(
    fn: () => Promise<R>,
    fallback?: () => Promise<R>
  ): Promise<R> {
    if (this.state === CircuitBreakerState.OPEN) {
      // Check if we should transition to half-open
      if (Date.now() - this.lastOpenTime >= this.config.resetTimeout * 1000) {
        this.transitionToHalfOpen();
      } else {
        // Circuit is open - use fallback if available
        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit breaker is OPEN for service. Retry in ${this.getTimeUntilRetry()}ms`);
      }
    }

    // Execute the function with error handling
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Synchronous check to see if circuit is healthy
   */
  public isHealthy(): boolean {
    if (this.state === CircuitBreakerState.OPEN) {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastOpenTime >= this.config.resetTimeout * 1000) {
        this.transitionToHalfOpen();
        return this.state !== CircuitBreakerState.OPEN;
      }
      return false;
    }
    return this.state === CircuitBreakerState.CLOSED;
  }

  /**
   * Records a successful execution and transitions state if needed
   */
  private recordSuccess(): void {
    this.successCount++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Successful call in half-open state - transition to closed
      if (this.successCount >= this.config.halfOpenMaxAttempts) {
        this.transitionToClosed();
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Clear failure history on success
      this.failureTimestamps = [];
    }
  }

  /**
   * Records a failed execution and transitions state if needed
   */
  private recordFailure(): void {
    const now = Date.now();
    this.failureTimestamps.push(now);

    // Remove failures outside the failure window
    const windowStart = now - this.config.failureWindow * 1000;
    this.failureTimestamps = this.failureTimestamps.filter(t => t > windowStart);

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Failure in half-open state - reopen circuit
      this.transitionToOpen();
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Check if we've exceeded failure threshold
      if (this.failureTimestamps.length >= this.config.failureThreshold) {
        this.transitionToOpen();
      }
    }
  }

  /**
   * Transitions circuit to CLOSED state
   */
  private transitionToClosed(): void {
    if (this.state !== CircuitBreakerState.CLOSED) {
      console.log(`[CircuitBreaker] Transitioning to CLOSED state`);
      this.state = CircuitBreakerState.CLOSED;
      this.stateChangedAt = Date.now();
      this.failureTimestamps = [];
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    }
  }

  /**
   * Transitions circuit to OPEN state
   */
  private transitionToOpen(): void {
    if (this.state !== CircuitBreakerState.OPEN) {
      console.error(`[CircuitBreaker] Transitioning to OPEN state. Failures: ${this.failureTimestamps.length}`);
      this.state = CircuitBreakerState.OPEN;
      this.stateChangedAt = Date.now();
      this.lastOpenTime = this.stateChangedAt;
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    }
  }

  /**
   * Transitions circuit to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    if (this.state !== CircuitBreakerState.HALF_OPEN) {
      console.log(`[CircuitBreaker] Transitioning to HALF_OPEN state`);
      this.state = CircuitBreakerState.HALF_OPEN;
      this.stateChangedAt = Date.now();
      this.successCount = 0;
      this.halfOpenAttempts = 0;
    }
  }

  /**
   * Gets the current state of the circuit breaker
   */
  public getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Gets metrics about the circuit breaker
   */
  public getMetrics(): CircuitBreakerMetrics {
    return {
      totalRequests: this.failureTimestamps.length + this.successCount,
      failureCount: this.failureTimestamps.length,
      successCount: this.successCount,
      lastFailureTime: this.failureTimestamps.length > 0 ? this.failureTimestamps[this.failureTimestamps.length - 1] : undefined,
      lastSuccessTime: this.successCount > 0 ? this.stateChangedAt : undefined,
      state: this.state,
      stateChangedAt: this.stateChangedAt,
    };
  }

  /**
   * Gets milliseconds until circuit can be retried
   */
  public getTimeUntilRetry(): number {
    if (this.state !== CircuitBreakerState.OPEN) {
      return 0;
    }
    const resetTime = this.lastOpenTime + this.config.resetTimeout * 1000;
    return Math.max(0, resetTime - Date.now());
  }

  /**
   * Manually reset the circuit breaker (for testing or admin operations)
   */
  public reset(): void {
    console.log(`[CircuitBreaker] Manual reset initiated`);
    this.state = CircuitBreakerState.CLOSED;
    this.failureTimestamps = [];
    this.successCount = 0;
    this.halfOpenAttempts = 0;
    this.stateChangedAt = Date.now();
  }
}
