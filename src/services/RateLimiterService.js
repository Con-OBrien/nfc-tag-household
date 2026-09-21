"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiterService = void 0;
/**
 * RateLimiterService - Prevents abuse through rate limiting
 * Enforces 1 scan per task per user per 30 seconds
 * Temporarily suspends users with repeated violations
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6
 */
class RateLimiterService {
    constructor() {
        // Rate limit: one scan per 30 seconds for same task
        this.RATE_LIMIT_WINDOW_MS = 30 * 1000; // 30 seconds
        // Suspension: after 10 failed attempts within 1 minute, suspend for 5 minutes
        this.FAILED_ATTEMPTS_THRESHOLD = 10;
        this.FAILED_ATTEMPTS_WINDOW_MS = 60 * 1000; // 1 minute
        this.SUSPENSION_DURATION_MS = 5 * 60 * 1000; // 5 minutes
        // Track scan attempts per user/task
        this.scanAttempts = new Map(); // key: userId:taskId, value: array of timestamps
        // Track failed scans per user
        this.failedAttempts = new Map(); // key: userId, value: array of timestamps
        // Track suspended users
        this.suspendedUsers = new Map(); // key: userId, value: suspension end timestamp
    }
    /**
     * Checks if a user can perform a scan for a given task
     * Enforces rate limiting and suspension checks
     *
     * @param userId - The user ID attempting the scan
     * @param taskId - The task ID being scanned
     * @returns Object with allowed flag and message
     *
     * Requirements: 17.1, 17.3, 17.4
     */
    canScan(userId, taskId) {
        const now = Date.now();
        // Check if user is suspended
        const suspensionEnd = this.suspendedUsers.get(userId);
        if (suspensionEnd && suspensionEnd > now) {
            const remainingMs = suspensionEnd - now;
            const remainingSecs = Math.ceil(remainingMs / 1000);
            return {
                allowed: false,
                message: `Scan suspended for ${remainingSecs} seconds due to repeated violations`,
            };
        }
        // Check rate limit for this specific task
        const scanKey = `${userId}:${taskId}`;
        const recentScans = this.getScanAttemptsInWindow(scanKey, now);
        if (recentScans.length > 0) {
            const timeSinceLastScan = now - recentScans[recentScans.length - 1];
            const secondsUntilCanScan = Math.ceil((this.RATE_LIMIT_WINDOW_MS - timeSinceLastScan) / 1000);
            return {
                allowed: false,
                message: `Rate limit exceeded. Try again in ${secondsUntilCanScan} seconds`,
            };
        }
        return { allowed: true };
    }
    /**
     * Records a successful scan attempt
     * Cleans up failure count if scan succeeded
     *
     * @param userId - The user ID
     * @param taskId - The task ID
     *
     * Requirements: 17.1
     */
    recordSuccessfulScan(userId, taskId) {
        const now = Date.now();
        const scanKey = `${userId}:${taskId}`;
        // Record the scan attempt
        if (!this.scanAttempts.has(scanKey)) {
            this.scanAttempts.set(scanKey, []);
        }
        this.scanAttempts.get(scanKey).push(now);
        // Clean up old attempts
        this.cleanupOldScanAttempts(scanKey, now);
        // Reset failed attempts counter on successful scan
        this.failedAttempts.delete(userId);
        // Remove suspension if expired
        this.cleanupExpiredSuspensions(now);
    }
    /**
     * Records a failed scan attempt
     * Tracks violations and triggers suspension if threshold exceeded
     *
     * @param userId - The user ID
     *
     * Requirements: 17.2, 17.3, 17.4, 17.5
     */
    recordFailedAttempt(userId) {
        const now = Date.now();
        // Track failed attempt
        if (!this.failedAttempts.has(userId)) {
            this.failedAttempts.set(userId, []);
        }
        this.failedAttempts.get(userId).push(now);
        // Check if threshold exceeded
        const recentFailures = this.getFailedAttemptsInWindow(userId, now);
        if (recentFailures.length >= this.FAILED_ATTEMPTS_THRESHOLD) {
            // Suspend user
            const suspensionEnd = now + this.SUSPENSION_DURATION_MS;
            this.suspendedUsers.set(userId, suspensionEnd);
            // Log violation
            console.warn(`User ${userId} suspended due to ${recentFailures.length} failed attempts within 1 minute`);
        }
        // Clean up old attempts
        this.cleanupOldFailedAttempts(userId, now);
    }
    /**
     * Gets the number of scan attempts for a user/task in the rate limit window
     *
     * @param userId - The user ID
     * @param taskId - The task ID
     * @returns Number of recent scan attempts
     *
     * Requirements: 17.1
     */
    getRecentScanCount(userId, taskId) {
        const now = Date.now();
        const scanKey = `${userId}:${taskId}`;
        return this.getScanAttemptsInWindow(scanKey, now).length;
    }
    /**
     * Gets remaining suspension time for a user
     *
     * @param userId - The user ID
     * @returns Remaining suspension time in milliseconds, or 0 if not suspended
     *
     * Requirements: 17.3, 17.5
     */
    getRemainingSuppressionTime(userId) {
        const now = Date.now();
        const suspensionEnd = this.suspendedUsers.get(userId);
        if (!suspensionEnd || suspensionEnd <= now) {
            return 0;
        }
        return suspensionEnd - now;
    }
    /**
     * Clears all rate limiting data for testing purposes
     * Should not be called in production
     */
    resetAllLimits() {
        this.scanAttempts.clear();
        this.failedAttempts.clear();
        this.suspendedUsers.clear();
    }
    /**
     * Clears rate limiting data for a specific user
     * Used for administrative purposes or when user is removed
     *
     * @param userId - The user ID
     */
    resetUserLimits(userId) {
        // Clear all scan attempts for this user
        const keysToDelete = [];
        this.scanAttempts.forEach((_, key) => {
            if (key.startsWith(`${userId}:`)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach((key) => this.scanAttempts.delete(key));
        // Clear failed attempts
        this.failedAttempts.delete(userId);
        // Clear suspension
        this.suspendedUsers.delete(userId);
    }
    /**
     * Gets all scan attempts for a user/task within the rate limit window
     *
     * @param scanKey - The key (userId:taskId)
     * @param now - Current timestamp
     * @returns Array of scan attempt timestamps
     */
    getScanAttemptsInWindow(scanKey, now) {
        const attempts = this.scanAttempts.get(scanKey) || [];
        const windowStart = now - this.RATE_LIMIT_WINDOW_MS;
        return attempts.filter((timestamp) => timestamp > windowStart);
    }
    /**
     * Gets all failed attempts for a user within the failure tracking window
     *
     * @param userId - The user ID
     * @param now - Current timestamp
     * @returns Array of failed attempt timestamps
     */
    getFailedAttemptsInWindow(userId, now) {
        const attempts = this.failedAttempts.get(userId) || [];
        const windowStart = now - this.FAILED_ATTEMPTS_WINDOW_MS;
        return attempts.filter((timestamp) => timestamp > windowStart);
    }
    /**
     * Removes old scan attempts outside the rate limit window
     * Prevents unbounded memory growth
     *
     * @param scanKey - The key (userId:taskId)
     * @param now - Current timestamp
     */
    cleanupOldScanAttempts(scanKey, now) {
        const attempts = this.scanAttempts.get(scanKey);
        if (!attempts)
            return;
        const windowStart = now - this.RATE_LIMIT_WINDOW_MS;
        const recentAttempts = attempts.filter((timestamp) => timestamp > windowStart);
        if (recentAttempts.length === 0) {
            this.scanAttempts.delete(scanKey);
        }
        else if (recentAttempts.length < attempts.length) {
            this.scanAttempts.set(scanKey, recentAttempts);
        }
    }
    /**
     * Removes old failed attempts outside the tracking window
     * Prevents unbounded memory growth
     *
     * @param userId - The user ID
     * @param now - Current timestamp
     */
    cleanupOldFailedAttempts(userId, now) {
        const attempts = this.failedAttempts.get(userId);
        if (!attempts)
            return;
        const windowStart = now - this.FAILED_ATTEMPTS_WINDOW_MS;
        const recentAttempts = attempts.filter((timestamp) => timestamp > windowStart);
        if (recentAttempts.length === 0) {
            this.failedAttempts.delete(userId);
        }
        else if (recentAttempts.length < attempts.length) {
            this.failedAttempts.set(userId, recentAttempts);
        }
    }
    /**
     * Removes expired suspensions
     * Cleans up suspension records for users whose suspension time has expired
     *
     * @param now - Current timestamp
     *
     * Requirements: 17.5
     */
    cleanupExpiredSuspensions(now) {
        const usersToRemove = [];
        this.suspendedUsers.forEach((suspensionEnd, userId) => {
            if (suspensionEnd <= now) {
                usersToRemove.push(userId);
            }
        });
        usersToRemove.forEach((userId) => {
            this.suspendedUsers.delete(userId);
        });
    }
}
exports.RateLimiterService = RateLimiterService;
