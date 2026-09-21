"use strict";
/**
 * Retry Strategy for External Services
 * Provides configurable retry logic with exponential backoff for FCM, APNs, and other external services
 * Tracks metrics and failure reasons for monitoring
 *
 * Requirements: 14.6, 14.7, 14.8, 14.9
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryStrategy = exports.FailureReason = void 0;
var FailureReason;
(function (FailureReason) {
    FailureReason["TIMEOUT"] = "timeout";
    FailureReason["RATE_LIMITED"] = "rate_limited";
    FailureReason["AUTH_ERROR"] = "auth_error";
    FailureReason["INVALID_TOKEN"] = "invalid_token";
    FailureReason["SERVICE_UNAVAILABLE"] = "service_unavailable";
    FailureReason["NETWORK_ERROR"] = "network_error";
    FailureReason["UNKNOWN"] = "unknown";
})(FailureReason || (exports.FailureReason = FailureReason = {}));
/**
 * Retry Strategy for handling external service failures
 */
class RetryStrategy {
    constructor(config) {
        this.attempts = [];
        this.metrics = new Map();
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
    async executeWithRetry(fn, serviceId = 'default') {
        const attempts = [];
        let lastError = null;
        let lastFailureReason = FailureReason.UNKNOWN;
        for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
            const attemptRecord = {
                attemptNumber: attempt,
                timestamp: Date.now(),
            };
            try {
                console.log(`[RetryStrategy] Executing ${serviceId} (attempt ${attempt}/${this.config.maxAttempts})`);
                // Execute with timeout
                const result = await Promise.race([
                    fn(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), this.config.timeoutMs)),
                ]);
                console.log(`[RetryStrategy] ${serviceId} succeeded on attempt ${attempt}`);
                this.recordSuccess(serviceId, attempts);
                return result;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                lastFailureReason = this.classifyFailure(lastError);
                attemptRecord.error = lastError.message;
                attempts.push(attemptRecord);
                const isLastAttempt = attempt === this.config.maxAttempts;
                const shouldRetry = this.shouldRetry(lastFailureReason, isLastAttempt);
                console.warn(`[RetryStrategy] ${serviceId} failed on attempt ${attempt}/${this.config.maxAttempts}. ` +
                    `Reason: ${lastFailureReason}. Retry: ${shouldRetry}`);
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
    classifyFailure(error) {
        const message = error.message.toLowerCase();
        const errorCode = error.code;
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
        if (message.includes('econnrefused') ||
            message.includes('enotfound') ||
            message.includes('network') ||
            errorCode === 'ECONNREFUSED' ||
            errorCode === 'ENOTFOUND') {
            return FailureReason.NETWORK_ERROR;
        }
        return FailureReason.UNKNOWN;
    }
    /**
     * Determines if error should be retried
     */
    shouldRetry(reason, isLastAttempt) {
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
    calculateDelay(attemptNumber) {
        const exponentialDelay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attemptNumber);
        const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);
        // Add jitter (±10%)
        const jitter = cappedDelay * 0.1 * (Math.random() * 2 - 1);
        return cappedDelay + jitter;
    }
    /**
     * Records successful retry
     */
    recordSuccess(serviceId, attempts) {
        const metrics = this.getOrCreateMetrics(serviceId);
        metrics.totalAttempts += attempts.length;
        metrics.successfulAttempts++;
        metrics.lastAttemptTime = Date.now();
    }
    /**
     * Records failed retry
     */
    recordFailure(serviceId, attempts, reason) {
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
    getOrCreateMetrics(serviceId) {
        if (!this.metrics.has(serviceId)) {
            this.metrics.set(serviceId, {
                totalAttempts: 0,
                successfulAttempts: 0,
                failedAttempts: 0,
                failureReasons: new Map(),
                averageAttempts: 0,
            });
        }
        return this.metrics.get(serviceId);
    }
    /**
     * Gets metrics for a service
     */
    getMetrics(serviceId) {
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
    clearMetrics(serviceId) {
        if (serviceId) {
            this.metrics.delete(serviceId);
        }
        else {
            this.metrics.clear();
        }
    }
    /**
     * Utility sleep function
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Gets configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Updates configuration
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
exports.RetryStrategy = RetryStrategy;
