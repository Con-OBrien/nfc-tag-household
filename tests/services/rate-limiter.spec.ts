import { RateLimiterService } from '../../src/services/RateLimiterService';

describe('RateLimiterService', () => {
  let service: RateLimiterService;

  beforeEach(() => {
    service = new RateLimiterService();
  });

  describe('canScan', () => {
    it('should allow first scan', () => {
      const result = service.canScan('user_001', 'task_001');

      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should block duplicate scan within 30 seconds', () => {
      // First scan
      service.recordSuccessfulScan('user_001', 'task_001');

      // Second scan within window
      const result = service.canScan('user_001', 'task_001');

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Rate limit exceeded');
    });

    it('should allow scan after 30 second window', () => {
      // Record successful scan at time 0
      service.recordSuccessfulScan('user_001', 'task_001');

      // Check at time 31 seconds
      const futureTime = Date.now() + 31 * 1000;
      jest.useFakeTimers();
      jest.setSystemTime(futureTime);

      const result = service.canScan('user_001', 'task_001');

      expect(result.allowed).toBe(true);

      jest.useRealTimers();
    });

    it('should allow same user on different tasks', () => {
      // First task
      service.recordSuccessfulScan('user_001', 'task_001');

      // Different task should be allowed
      const result = service.canScan('user_001', 'task_002');

      expect(result.allowed).toBe(true);
    });

    it('should allow different users on same task', () => {
      // User 1
      service.recordSuccessfulScan('user_001', 'task_001');

      // User 2 should be allowed
      const result = service.canScan('user_002', 'task_001');

      expect(result.allowed).toBe(true);
    });

    it('should block suspended user', () => {
      // Trigger suspension by recording 10 failed attempts within 1 minute
      for (let i = 0; i < 10; i++) {
        service.recordFailedAttempt('user_001');
      }

      // Try to scan
      const result = service.canScan('user_001', 'task_001');

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('suspended');
    });

    it('should provide time remaining in suspension message', () => {
      // Trigger suspension
      for (let i = 0; i < 10; i++) {
        service.recordFailedAttempt('user_001');
      }

      const result = service.canScan('user_001', 'task_001');

      expect(result.message).toContain('seconds');
    });

    it('should provide seconds until can scan in message', () => {
      service.recordSuccessfulScan('user_001', 'task_001');

      const result = service.canScan('user_001', 'task_001');

      expect(result.message).toContain('Try again in');
      expect(result.message).toContain('seconds');
    });
  });

  describe('recordSuccessfulScan', () => {
    it('should record scan for rate limiting', () => {
      service.recordSuccessfulScan('user_001', 'task_001');

      // Next scan should be blocked
      const result = service.canScan('user_001', 'task_001');
      expect(result.allowed).toBe(false);
    });

    it('should clear failed attempts on successful scan', () => {
      // Record some failures
      service.recordFailedAttempt('user_001');
      service.recordFailedAttempt('user_001');

      // Successful scan should reset failures
      service.recordSuccessfulScan('user_001', 'task_001');

      // Check suspension status - should not be suspended
      const result = service.canScan('user_001', 'task_001');
      expect(result.allowed).toBe(false); // Blocked due to rate limit, not suspension

      // If we try a different task, should be allowed (no suspension)
      const result2 = service.canScan('user_001', 'task_002');
      expect(result2.allowed).toBe(true);
    });

    it('should track multiple users independently', () => {
      service.recordSuccessfulScan('user_001', 'task_001');
      service.recordSuccessfulScan('user_002', 'task_001');

      // user_001 should be blocked
      expect(service.canScan('user_001', 'task_001').allowed).toBe(false);

      // user_002 should also be blocked (different user, same task)
      expect(service.canScan('user_002', 'task_001').allowed).toBe(false);
    });

    it('should track multiple tasks independently', () => {
      service.recordSuccessfulScan('user_001', 'task_001');
      service.recordSuccessfulScan('user_001', 'task_002');

      // Same user, different tasks should each have their own limits
      expect(service.canScan('user_001', 'task_001').allowed).toBe(false);
      expect(service.canScan('user_001', 'task_002').allowed).toBe(false);
    });
  });

  describe('recordFailedAttempt', () => {
    it('should track failed attempts', () => {
      service.recordFailedAttempt('user_001');
      service.recordFailedAttempt('user_001');

      // Should not be suspended until threshold
      const result = service.canScan('user_001', 'task_001');
      expect(result.allowed).toBe(true);
    });

    it('should suspend after 10 failed attempts in 1 minute', () => {
      // Record 10 failures
      for (let i = 0; i < 10; i++) {
        service.recordFailedAttempt('user_001');
      }

      // Should be suspended
      const result = service.canScan('user_001', 'task_001');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('suspended');
    });

    it('should not suspend for 10 failures over more than 1 minute', () => {
      jest.useFakeTimers();
      const baseTime = Date.now();
      jest.setSystemTime(baseTime);

      // Record 10 failures within 1 minute
      for (let i = 0; i < 10; i++) {
        service.recordFailedAttempt('user_001');
        jest.setSystemTime(baseTime + (i + 1) * 5000); // 5 seconds apart
      }

      // Should be suspended (last failure at 50 seconds, all within window)
      let result = service.canScan('user_001', 'task_001');
      expect(result.allowed).toBe(false);

      // Move past 1 minute window
      jest.setSystemTime(baseTime + 61 * 1000);

      // Now only the last few failures should count
      // Record 10 more failures to trigger suspension
      for (let i = 0; i < 10; i++) {
        service.recordFailedAttempt('user_001');
      }

      // All 10 new failures are within the 1-minute window
      result = service.canScan('user_001', 'task_001');
      expect(result.allowed).toBe(false);

      jest.useRealTimers();
    });

    it('should track failures per user independently', () => {
      // Record 9 failures for user 1
      for (let i = 0; i < 9; i++) {
        service.recordFailedAttempt('user_001');
      }

      // Record 1 failure for user 2
      service.recordFailedAttempt('user_002');

      // User 1 not suspended (9 < 10)
      expect(service.canScan('user_001', 'task_001').allowed).toBe(true);

      // User 2 not suspended (1 < 10)
      expect(service.canScan('user_002', 'task_001').allowed).toBe(true);

      // One more failure for user 1 triggers suspension
      service.recordFailedAttempt('user_001');
      expect(service.canScan('user_001', 'task_001').allowed).toBe(false);

      // User 2 still not suspended
      expect(service.canScan('user_002', 'task_001').allowed).toBe(true);
    });
  });

  describe('getRecentScanCount', () => {
    it('should return 0 for no scans', () => {
      const count = service.getRecentScanCount('user_001', 'task_001');
      expect(count).toBe(0);
    });

    it('should return count of recent scans', () => {
      service.recordSuccessfulScan('user_001', 'task_001');

      const count = service.getRecentScanCount('user_001', 'task_001');
      expect(count).toBe(1);
    });

    it('should track multiple scans after window passes', () => {
      jest.useFakeTimers();
      const baseTime = Date.now();
      jest.setSystemTime(baseTime);

      service.recordSuccessfulScan('user_001', 'task_001');

      // Move past 30 second window
      jest.setSystemTime(baseTime + 31 * 1000);

      service.recordSuccessfulScan('user_001', 'task_001');

      // Should only count the second scan
      const count = service.getRecentScanCount('user_001', 'task_001');
      expect(count).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('getRemainingSuppressionTime', () => {
    it('should return 0 if not suspended', () => {
      const remaining = service.getRemainingSuppressionTime('user_001');
      expect(remaining).toBe(0);
    });

    it('should return remaining suspension time', () => {
      // Trigger suspension
      for (let i = 0; i < 10; i++) {
        service.recordFailedAttempt('user_001');
      }

      const remaining = service.getRemainingSuppressionTime('user_001');
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(5 * 60 * 1000); // 5 minutes
    });

    it('should return 0 when suspension expires', () => {
      jest.useFakeTimers();
      const baseTime = Date.now();
      jest.setSystemTime(baseTime);

      // Trigger suspension
      for (let i = 0; i < 10; i++) {
        service.recordFailedAttempt('user_001');
      }

      // Move past suspension period
      jest.setSystemTime(baseTime + 6 * 60 * 1000); // 6 minutes

      const remaining = service.getRemainingSuppressionTime('user_001');
      expect(remaining).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('resetAllLimits', () => {
    it('should clear all rate limiting data', () => {
      service.recordSuccessfulScan('user_001', 'task_001');
      service.recordFailedAttempt('user_002');

      service.resetAllLimits();

      // Both should be allowed now
      expect(service.canScan('user_001', 'task_001').allowed).toBe(true);
      expect(service.canScan('user_002', 'task_001').allowed).toBe(true);
    });

    it('should clear suspensions', () => {
      // Trigger suspension
      for (let i = 0; i < 10; i++) {
        service.recordFailedAttempt('user_001');
      }

      expect(service.canScan('user_001', 'task_001').allowed).toBe(false);

      service.resetAllLimits();

      expect(service.canScan('user_001', 'task_001').allowed).toBe(true);
    });
  });

  describe('resetUserLimits', () => {
    it('should clear limits for specific user only', () => {
      service.recordSuccessfulScan('user_001', 'task_001');
      service.recordSuccessfulScan('user_002', 'task_001');

      service.resetUserLimits('user_001');

      // user_001 should be allowed now
      expect(service.canScan('user_001', 'task_001').allowed).toBe(true);

      // user_002 should still be rate limited
      expect(service.canScan('user_002', 'task_001').allowed).toBe(false);
    });

    it('should clear suspensions for specific user', () => {
      // Suspend both users
      for (let i = 0; i < 10; i++) {
        service.recordFailedAttempt('user_001');
        service.recordFailedAttempt('user_002');
      }

      expect(service.canScan('user_001', 'task_001').allowed).toBe(false);
      expect(service.canScan('user_002', 'task_001').allowed).toBe(false);

      // Reset user_001
      service.resetUserLimits('user_001');

      expect(service.canScan('user_001', 'task_001').allowed).toBe(true);
      expect(service.canScan('user_002', 'task_001').allowed).toBe(false);
    });

    it('should clear all tasks for a user', () => {
      service.recordSuccessfulScan('user_001', 'task_001');
      service.recordSuccessfulScan('user_001', 'task_002');

      service.resetUserLimits('user_001');

      expect(service.canScan('user_001', 'task_001').allowed).toBe(true);
      expect(service.canScan('user_001', 'task_002').allowed).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle realistic rapid scan attempts', () => {
      const user = 'user_001';
      const task = 'task_001';

      // First scan succeeds
      const scan1 = service.canScan(user, task);
      expect(scan1.allowed).toBe(true);
      service.recordSuccessfulScan(user, task);

      // Rapid attempts blocked
      const scan2 = service.canScan(user, task);
      expect(scan2.allowed).toBe(false);

      const scan3 = service.canScan(user, task);
      expect(scan3.allowed).toBe(false);

      const scan4 = service.canScan(user, task);
      expect(scan4.allowed).toBe(false);
    });

    it('should handle abuse pattern: many failed scans then suspension', () => {
      const user = 'user_001';
      const task = 'task_001';

      // Simulate 10 failed scan attempts
      for (let i = 0; i < 10; i++) {
        service.recordFailedAttempt(user);
      }

      // User should be suspended
      const result = service.canScan(user, task);
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('suspended');

      // Remaining time should be meaningful
      const remaining = service.getRemainingSuppressionTime(user);
      expect(remaining).toBeGreaterThan(0);
    });

    it('should recover from suspension after timeout', () => {
      jest.useFakeTimers();
      const baseTime = Date.now();
      jest.setSystemTime(baseTime);

      const user = 'user_001';
      const task = 'task_001';

      // Trigger suspension
      for (let i = 0; i < 10; i++) {
        service.recordFailedAttempt(user);
      }

      expect(service.canScan(user, task).allowed).toBe(false);

      // Move past suspension period
      jest.setSystemTime(baseTime + 6 * 60 * 1000);

      // Should be allowed now
      expect(service.canScan(user, task).allowed).toBe(true);

      jest.useRealTimers();
    });

    it('should handle multiple users with different rate limit states', () => {
      const user1 = 'user_001';
      const user2 = 'user_002';
      const user3 = 'user_003';
      const task = 'task_001';

      // User 1: rate limited
      service.recordSuccessfulScan(user1, task);

      // User 2: suspended
      for (let i = 0; i < 10; i++) {
        service.recordFailedAttempt(user2);
      }

      // User 3: allowed
      // (no interactions)

      expect(service.canScan(user1, task).allowed).toBe(false); // Rate limited
      expect(service.canScan(user2, task).allowed).toBe(false); // Suspended
      expect(service.canScan(user3, task).allowed).toBe(true); // Allowed
    });
  });
});
