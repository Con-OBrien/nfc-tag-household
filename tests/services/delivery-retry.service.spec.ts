import {
  DeliveryRetryService,
  DeliveryFailureClassification,
  DeliveryStatus,
} from '../../src/services/DeliveryRetryService';
import { EventRepository } from '../../src/repositories/EventRepository';
import { randomUUID } from 'crypto';

/**
 * DeliveryRetryService Unit Tests
 * Tests retry logic with exponential backoff, failure classification, and audit logging
 *
 * Requirements: 5.4, 5.5, 5.6, 14.3, 14.4
 */
describe('DeliveryRetryService', () => {
  let retryService: DeliveryRetryService;
  let mockEventRepository: Partial<EventRepository>;

  const testData = {
    pushToken: 'test_token_12345',
    userId: randomUUID(),
    eventId: randomUUID(),
    taskId: randomUUID(),
    householdId: randomUUID(),
  };

  beforeEach(() => {
    mockEventRepository = {
      logEvent: jest.fn().mockResolvedValue({
        eventId: randomUUID(),
        userId: testData.userId,
        taskId: testData.taskId,
        householdId: testData.householdId,
        action: 'acknowledge',
        timestamp: Date.now(),
        metadata: {},
      }),
    };

    retryService = new DeliveryRetryService(
      mockEventRepository as EventRepository
    );
  });

  describe('executeWithRetry - Success Scenarios', () => {
    it('should return delivered status on first attempt success', async () => {
      let attemptCount = 0;
      const deliveryFn = async () => {
        attemptCount++;
        return true;
      };

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.finalStatus).toBe('delivered');
      expect(result.totalAttempts).toBe(1);
      expect(attemptCount).toBe(1);
      expect(result.attempts[0].classification).toBe('success');
    });

    it('should return delivered status on subsequent attempt success', async () => {
      let attemptCount = 0;
      const deliveryFn = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Connection timeout');
        }
        return true;
      };

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.finalStatus).toBe('delivered');
      expect(result.totalAttempts).toBe(2);
      expect(attemptCount).toBe(2);
      expect(result.attempts[0].classification).toBe('temporary_failure');
      expect(result.attempts[1].classification).toBe('success');
    });

    it('should return delivered status on third attempt success', async () => {
      let attemptCount = 0;
      const deliveryFn = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Service temporarily unavailable');
        }
        return true;
      };

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.finalStatus).toBe('delivered');
      expect(result.totalAttempts).toBe(3);
      expect(attemptCount).toBe(3);
    });
  });

  describe('executeWithRetry - Failure Classification', () => {
    it('should classify token_expired error and stop retrying', async () => {
      let attemptCount = 0;
      const deliveryFn = async () => {
        attemptCount++;
        throw new Error('Invalid push token: token expired');
      };

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.finalStatus).toBe('failed');
      expect(result.totalAttempts).toBe(1); // Should stop after first attempt
      expect(attemptCount).toBe(1);
      expect(result.attempts[0].classification).toBe('token_expired');
    });

    it('should classify rate_limited error and retry', async () => {
      let attemptCount = 0;
      const deliveryFn = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Rate limit exceeded: too many requests');
        }
        return true;
      };

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.finalStatus).toBe('delivered');
      expect(result.totalAttempts).toBe(2);
      expect(result.attempts[0].classification).toBe('rate_limited');
      expect(result.attempts[1].classification).toBe('success');
    });

    it('should classify service_unavailable error and retry', async () => {
      let attemptCount = 0;
      const deliveryFn = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Service temporarily unavailable');
        }
        return true;
      };

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.finalStatus).toBe('delivered');
      expect(result.attempts[0].classification).toBe('service_unavailable');
    });

    it('should classify temporary_failure for connection errors', async () => {
      let attemptCount = 0;
      const deliveryFn = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Connection timeout');
        }
        return true;
      };

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.attempts[0].classification).toBe('temporary_failure');
    });

    it('should classify permanent_failure error and stop retrying', async () => {
      let attemptCount = 0;
      const deliveryFn = async () => {
        attemptCount++;
        throw new Error('Unauthorized: invalid credentials');
      };

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.finalStatus).toBe('failed');
      expect(result.totalAttempts).toBe(1); // Should stop after first attempt
      expect(attemptCount).toBe(1);
      expect(result.attempts[0].classification).toBe('permanent_failure');
    });

    it('should handle non-Error exceptions and classify as temporary_failure', async () => {
      const deliveryFn = async () => {
        throw 'String error, not Error object';
      };

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.finalStatus).toBe('failed');
      expect(result.attempts[0].classification).toBe('temporary_failure');
    });
  });

  describe('executeWithRetry - Exponential Backoff', () => {
    it('should have correct backoff delays configured', () => {
      const delays = retryService.getBackoffDelays();
      expect(delays).toEqual([1000, 2000, 4000]); // 1s, 2s, 4s
    });

    it('should respect exponential backoff timing between retries', async () => {
      const timings: number[] = [];
      let attemptCount = 0;
      const deliveryFn = async () => {
        timings.push(Date.now());
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return true;
      };

      const startTime = Date.now();
      await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      const totalTime = Date.now() - startTime;

      // Should have taken at least 1s + 2s = 3s
      expect(totalTime).toBeGreaterThanOrEqual(2900); // Allow some margin

      // Verify three attempts were made
      expect(timings.length).toBe(3);

      // Verify delays between attempts (with some tolerance for execution time)
      const delay1 = timings[1] - timings[0];
      const delay2 = timings[2] - timings[1];

      expect(delay1).toBeGreaterThanOrEqual(900); // ~1000ms with margin
      expect(delay2).toBeGreaterThanOrEqual(1900); // ~2000ms with margin
    });
  });

  describe('executeWithRetry - Max Attempts Enforcement', () => {
    it('should enforce max 3 attempts by default', async () => {
      let attemptCount = 0;
      const deliveryFn = async () => {
        attemptCount++;
        throw new Error('Temporary failure');
      };

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.totalAttempts).toBe(3);
      expect(attemptCount).toBe(3);
      expect(result.finalStatus).toBe('failed');
    });

    it('should support custom max attempts', async () => {
      let attemptCount = 0;
      const deliveryFn = async () => {
        attemptCount++;
        throw new Error('Temporary failure');
      };

      retryService.setMaxAttempts(2);

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.totalAttempts).toBe(2);
      expect(attemptCount).toBe(2);
    });
  });

  describe('executeWithRetry - Audit Logging', () => {
    it('should log delivery status to audit trail on success', async () => {
      const deliveryFn = async () => true;

      await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(mockEventRepository.logEvent).toHaveBeenCalled();
      const loggedEvent = (mockEventRepository.logEvent as jest.Mock).mock
        .calls[0][0];

      expect(loggedEvent.userId).toBe(testData.userId);
      expect(loggedEvent.taskId).toBe(testData.taskId);
      expect(loggedEvent.householdId).toBe(testData.householdId);
      expect(loggedEvent.metadata.linkedEventId).toBe(testData.eventId);
      expect(loggedEvent.metadata.deliveryStatus).toBe('delivered');
      expect(loggedEvent.metadata.totalAttempts).toBe(1);
    });

    it('should log delivery status to audit trail on failure', async () => {
      let attemptCount = 0;
      const deliveryFn = async () => {
        attemptCount++;
        throw new Error('Unauthorized: invalid credentials'); // Permanent failure
      };

      await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(mockEventRepository.logEvent).toHaveBeenCalled();
      const loggedEvent = (mockEventRepository.logEvent as jest.Mock).mock
        .calls[0][0];

      expect(loggedEvent.metadata.deliveryStatus).toBe('failed');
      expect(loggedEvent.metadata.totalAttempts).toBe(1); // Should stop after first attempt for permanent failure
    });

    it('should include all attempts in audit log metadata', async () => {
      let attemptCount = 0;
      const deliveryFn = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return true;
      };

      await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      const loggedEvent = (mockEventRepository.logEvent as jest.Mock).mock
        .calls[0][0];

      expect(loggedEvent.metadata.attempts).toHaveLength(2);
      expect(loggedEvent.metadata.attempts[0].attemptNumber).toBe(1);
      expect(loggedEvent.metadata.attempts[0].classification).toBe(
        'temporary_failure'
      );
      expect(loggedEvent.metadata.attempts[1].attemptNumber).toBe(2);
      expect(loggedEvent.metadata.attempts[1].classification).toBe('success');
    });

    it('should mask push token in audit log for security', async () => {
      const deliveryFn = async () => true;

      await retryService.executeWithRetry(
        deliveryFn,
        'very_long_test_token_12345678',
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      const loggedEvent = (mockEventRepository.logEvent as jest.Mock).mock
        .calls[0][0];

      const maskedToken = loggedEvent.metadata.deliveryToken;
      expect(maskedToken).not.toContain('very_long_test_token_12345');
      expect(maskedToken).toMatch(/^\w+\.\.\.\w+$/); // Should be format: xxxxx...xxxx
    });
  });

  describe('executeWithRetry - Edge Cases', () => {
    it('should handle delivery function returning false', async () => {
      const deliveryFn = async () => false;

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.finalStatus).toBe('failed');
      expect(result.totalAttempts).toBe(3); // Should retry all 3 times
      expect(result.attempts[0].classification).toBe('temporary_failure');
    });

    it('should include error message in attempt records', async () => {
      const errorMessage = 'Connection refused: ECONNREFUSED';
      const deliveryFn = async () => {
        throw new Error(errorMessage);
      };

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.attempts[0].errorMessage).toBe(errorMessage);
    });

    it('should include lastError in delivery status on failure', async () => {
      const errorMessage = 'Service unavailable';
      const deliveryFn = async () => {
        throw new Error(errorMessage);
      };

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      expect(result.lastError).toBe(errorMessage);
    });

    it('should handle audit log errors gracefully', async () => {
      const auditError = new Error('Database connection failed');
      mockEventRepository.logEvent = jest
        .fn()
        .mockRejectedValueOnce(auditError);

      const deliveryFn = async () => true;

      const result = await retryService.executeWithRetry(
        deliveryFn,
        testData.pushToken,
        testData.userId,
        testData.eventId,
        testData.taskId,
        testData.householdId
      );

      // Delivery should still succeed even if audit logging fails
      expect(result.finalStatus).toBe('delivered');
      expect(mockEventRepository.logEvent).toHaveBeenCalled();
    });
  });

  describe('executeWithRetry - Configuration Methods', () => {
    it('should allow setting custom max attempts', () => {
      retryService.setMaxAttempts(5);
      expect(retryService.getMaxAttempts()).toBe(5);
    });

    it('should validate max attempts range', () => {
      expect(() => retryService.setMaxAttempts(0)).toThrow();
      expect(() => retryService.setMaxAttempts(11)).toThrow();
      expect(() => retryService.setMaxAttempts(1)).not.toThrow();
      expect(() => retryService.setMaxAttempts(10)).not.toThrow();
    });

    it('should allow setting custom backoff delays', () => {
      const customDelays = [500, 1000, 2000];
      retryService.setBackoffDelays(customDelays);
      expect(retryService.getBackoffDelays()).toEqual(customDelays);
    });

    it('should validate backoff delays', () => {
      expect(() => retryService.setBackoffDelays([])).toThrow();
      expect(() => retryService.setBackoffDelays([-100])).toThrow();
      expect(() => retryService.setBackoffDelays([0, 500, 1000])).not.toThrow();
    });

    it('should return copy of backoff delays to prevent external mutation', () => {
      const delays1 = retryService.getBackoffDelays();
      const delays2 = retryService.getBackoffDelays();

      delays1[0] = 9999;

      expect(delays2[0]).toBe(1000); // Should not be mutated
    });
  });

  describe('Error Classification Logic', () => {
    const testCases: Array<[string, DeliveryFailureClassification]> = [
      ['Invalid push token: token expired', 'token_expired'],
      ['Token not found in database', 'token_expired'],
      ['Rate limit exceeded', 'rate_limited'],
      ['Request throttled due to quota', 'rate_limited'],
      ['Service temporarily unavailable', 'service_unavailable'],
      ['HTTP 503 Service Unavailable', 'service_unavailable'],
      ['Connection timeout', 'temporary_failure'],
      ['ECONNREFUSED connection refused', 'temporary_failure'],
      ['ENOTFOUND getaddrinfo', 'temporary_failure'],
      ['Unauthorized: invalid credentials', 'permanent_failure'],
      ['HTTP 403 Forbidden', 'permanent_failure'],
      ['Bad request: 400', 'permanent_failure'],
    ];

    testCases.forEach(([errorMsg, expectedClassification]) => {
      it(`should classify "${errorMsg}" as ${expectedClassification}`, async () => {
        let attemptCount = 0;
        const deliveryFn = async () => {
          attemptCount++;
          if (attemptCount === 1) {
            throw new Error(errorMsg);
          }
          return true;
        };

        const result = await retryService.executeWithRetry(
          deliveryFn,
          testData.pushToken,
          testData.userId,
          testData.eventId,
          testData.taskId,
          testData.householdId
        );

        expect(result.attempts[0].classification).toBe(expectedClassification);
      });
    });
  });
});
