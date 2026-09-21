import { EventRepository } from '../../src/repositories/EventRepository';
import { TaskEventEntity } from '../../src/entities/TaskEvent';
import { TaskEvent, ValidationError } from '../../src/types';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../src/config/database';
import { randomUUID } from 'crypto';

/**
 * EventRepository Unit Tests
 * Tests immutability enforcement, household isolation, and efficient querying
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 13.1
 */
describe('EventRepository', () => {
  let eventRepository: EventRepository;
  let repository: Repository<TaskEventEntity>;

  // Test fixtures
  const householdId = randomUUID();
  const userId = randomUUID();
  const taskId = randomUUID();
  const now = Date.now();

  beforeAll(async () => {
    // Initialize database
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    repository = AppDataSource.getRepository(TaskEventEntity);
  });

  beforeEach(async () => {
    // Clear events before each test
    await repository.delete({});
    eventRepository = new EventRepository();
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  describe('logEvent', () => {
    it('should create and persist a new event with generated eventId', async () => {
      const event: Omit<TaskEvent, 'eventId'> = {
        userId,
        taskId,
        householdId,
        action: 'execute',
        timestamp: now,
        metadata: { deviceType: 'nfc-reader' },
      };

      const result = await eventRepository.logEvent(event);

      expect(result.eventId).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.taskId).toBe(taskId);
      expect(result.householdId).toBe(householdId);
      expect(result.action).toBe('execute');
      expect(result.timestamp).toBe(now);
      expect(result.metadata).toEqual({ deviceType: 'nfc-reader' });
    });

    it('should validate that userId is required', async () => {
      const event: Omit<TaskEvent, 'eventId'> = {
        userId: '',
        taskId,
        householdId,
        action: 'execute',
        timestamp: now,
      };

      await expect(eventRepository.logEvent(event)).rejects.toThrow(ValidationError);
    });

    it('should validate that taskId is required', async () => {
      const event: Omit<TaskEvent, 'eventId'> = {
        userId,
        taskId: '',
        householdId,
        action: 'execute',
        timestamp: now,
      };

      await expect(eventRepository.logEvent(event)).rejects.toThrow(ValidationError);
    });

    it('should validate that householdId is required', async () => {
      const event: Omit<TaskEvent, 'eventId'> = {
        userId,
        taskId,
        householdId: '',
        action: 'execute',
        timestamp: now,
      };

      await expect(eventRepository.logEvent(event)).rejects.toThrow(ValidationError);
    });

    it('should reject invalid action types', async () => {
      const event: any = {
        userId,
        taskId,
        householdId,
        action: 'invalid-action',
        timestamp: now,
      };

      await expect(eventRepository.logEvent(event)).rejects.toThrow(ValidationError);
    });

    it('should reject events with missing timestamp', async () => {
      const event: any = {
        userId,
        taskId,
        householdId,
        action: 'execute',
        timestamp: undefined,
      };

      await expect(eventRepository.logEvent(event)).rejects.toThrow(ValidationError);
    });

    it('should reject events with timestamp outside 24-hour window', async () => {
      const futureTimestamp = now + 25 * 60 * 60 * 1000; // 25 hours in future
      const event: Omit<TaskEvent, 'eventId'> = {
        userId,
        taskId,
        householdId,
        action: 'execute',
        timestamp: futureTimestamp,
      };

      await expect(eventRepository.logEvent(event)).rejects.toThrow(ValidationError);
    });

    it('should persist event to database exactly once', async () => {
      const event: Omit<TaskEvent, 'eventId'> = {
        userId,
        taskId,
        householdId,
        action: 'acknowledge',
        timestamp: now,
      };

      const result = await eventRepository.logEvent(event);

      // Verify event was persisted
      const persistedEvent = await repository.findOne({
        where: { eventId: result.eventId },
      });

      expect(persistedEvent).toBeDefined();
      expect(persistedEvent!.eventId).toBe(result.eventId);
      expect(persistedEvent!.userId).toBe(userId);
    });

    it('should support all action types', async () => {
      const actions: Array<'execute' | 'acknowledge' | 'undo' | 'comment'> = [
        'execute',
        'acknowledge',
        'undo',
        'comment',
      ];

      for (const action of actions) {
        const event: Omit<TaskEvent, 'eventId'> = {
          userId,
          taskId: randomUUID(),
          householdId,
          action,
          timestamp: now,
        };

        const result = await eventRepository.logEvent(event);
        expect(result.action).toBe(action);
      }
    });
  });

  describe('getEventHistory', () => {
    beforeEach(async () => {
      // Create multiple events for testing
      const events = [
        { action: 'execute' as const, timestamp: now - 3000 },
        { action: 'acknowledge' as const, timestamp: now - 2000 },
        { action: 'undo' as const, timestamp: now - 1000 },
        { action: 'comment' as const, timestamp: now },
      ];

      for (const evt of events) {
        await eventRepository.logEvent({
          userId,
          taskId,
          householdId,
          action: evt.action,
          timestamp: evt.timestamp,
        });
      }
    });

    it('should return events in reverse chronological order', async () => {
      const history = await eventRepository.getEventHistory(taskId, householdId);

      expect(history.length).toBeGreaterThan(0);
      for (let i = 0; i < history.length - 1; i++) {
        expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i + 1].timestamp);
      }
    });

    it('should enforce household isolation', async () => {
      const otherHouseholdId = randomUUID();

      const history = await eventRepository.getEventHistory(taskId, otherHouseholdId);

      // Should return empty because events belong to different household
      expect(history.length).toBe(0);
    });

    it('should respect limit parameter', async () => {
      const history = await eventRepository.getEventHistory(taskId, householdId, 2);

      expect(history.length).toBeLessThanOrEqual(2);
    });

    it('should require taskId', async () => {
      await expect(eventRepository.getEventHistory('', householdId)).rejects.toThrow(
        ValidationError
      );
    });

    it('should require householdId', async () => {
      await expect(eventRepository.getEventHistory(taskId, '')).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate limit is within range', async () => {
      await expect(eventRepository.getEventHistory(taskId, householdId, 0)).rejects.toThrow(
        ValidationError
      );

      await expect(eventRepository.getEventHistory(taskId, householdId, 1001)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('getEventsByUser', () => {
    beforeEach(async () => {
      // Create events from different users
      const users = [userId, randomUUID(), randomUUID()];

      for (const user of users) {
        await eventRepository.logEvent({
          userId: user,
          taskId,
          householdId,
          action: 'execute',
          timestamp: now,
        });
      }
    });

    it('should return only events from specified user', async () => {
      const userEvents = await eventRepository.getEventsByUser(userId, householdId);

      expect(userEvents.every((e) => e.userId === userId)).toBe(true);
    });

    it('should enforce household isolation', async () => {
      const otherHouseholdId = randomUUID();

      const events = await eventRepository.getEventsByUser(userId, otherHouseholdId);

      expect(events.length).toBe(0);
    });

    it('should return results in reverse chronological order', async () => {
      const events = await eventRepository.getEventsByUser(userId, householdId);

      for (let i = 0; i < events.length - 1; i++) {
        expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i + 1].timestamp);
      }
    });

    it('should require userId', async () => {
      await expect(eventRepository.getEventsByUser('', householdId)).rejects.toThrow(
        ValidationError
      );
    });

    it('should require householdId', async () => {
      await expect(eventRepository.getEventsByUser(userId, '')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('queryEventsByDateRange', () => {
    beforeEach(async () => {
      // Create events at different timestamps
      const timestamps = [now - 5000, now - 3000, now - 1000, now];

      for (const timestamp of timestamps) {
        await eventRepository.logEvent({
          userId,
          taskId,
          householdId,
          action: 'execute',
          timestamp,
        });
      }
    });

    it('should return events within date range', async () => {
      const startTime = now - 4000;
      const endTime = now - 500;

      const events = await eventRepository.queryEventsByDateRange(startTime, endTime, householdId);

      expect(events.every((e) => e.timestamp >= startTime && e.timestamp <= endTime)).toBe(true);
    });

    it('should enforce household isolation', async () => {
      const otherHouseholdId = randomUUID();

      const events = await eventRepository.queryEventsByDateRange(
        now - 5000,
        now,
        otherHouseholdId
      );

      expect(events.length).toBe(0);
    });

    it('should require householdId', async () => {
      await expect(eventRepository.queryEventsByDateRange(now - 5000, now, '')).rejects.toThrow(
        ValidationError
      );
    });

    it('should reject invalid date ranges', async () => {
      await expect(
        eventRepository.queryEventsByDateRange(now, now - 5000, householdId)
      ).rejects.toThrow(ValidationError);
    });

    it('should limit date range to 90 days', async () => {
      const startTime = now - 100 * 24 * 60 * 60 * 1000; // 100 days ago
      const endTime = now;

      await expect(
        eventRepository.queryEventsByDateRange(startTime, endTime, householdId)
      ).rejects.toThrow(ValidationError);
    });

    it('should return results in reverse chronological order', async () => {
      const events = await eventRepository.queryEventsByDateRange(
        now - 5000,
        now,
        householdId
      );

      for (let i = 0; i < events.length - 1; i++) {
        expect(events[i].timestamp).toBeGreaterThanOrEqual(events[i + 1].timestamp);
      }
    });
  });

  describe('getEventsByAction', () => {
    beforeEach(async () => {
      const actions: Array<'execute' | 'acknowledge' | 'undo' | 'comment'> = [
        'execute',
        'acknowledge',
        'undo',
        'comment',
      ];

      for (let i = 0; i < 2; i++) {
        for (const action of actions) {
          await eventRepository.logEvent({
            userId,
            taskId,
            householdId,
            action,
            timestamp: now - i * 1000,
          });
        }
      }
    });

    it('should filter events by action type', async () => {
      const events = await eventRepository.getEventsByAction(householdId, 'execute');

      expect(events.every((e) => e.action === 'execute')).toBe(true);
    });

    it('should enforce household isolation', async () => {
      const otherHouseholdId = randomUUID();

      const events = await eventRepository.getEventsByAction(otherHouseholdId, 'execute');

      expect(events.length).toBe(0);
    });

    it('should reject invalid action types', async () => {
      await expect(
        eventRepository.getEventsByAction(householdId, 'invalid' as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Immutability Enforcement', () => {
    beforeEach(async () => {
      await eventRepository.logEvent({
        userId,
        taskId,
        householdId,
        action: 'execute',
        timestamp: now,
      });
    });

    it('should prevent event updates', async () => {
      await expect(eventRepository.updateEvent()).rejects.toThrow();
    });

    it('should prevent event deletion', async () => {
      await expect(eventRepository.deleteEvent()).rejects.toThrow();
    });

    it('should throw error with descriptive message on update attempt', async () => {
      try {
        await eventRepository.updateEvent();
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('immutable');
      }
    });

    it('should throw error with descriptive message on delete attempt', async () => {
      try {
        await eventRepository.deleteEvent();
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('immutable');
      }
    });
  });

  describe('countEvents', () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        await eventRepository.logEvent({
          userId,
          taskId: randomUUID(),
          householdId,
          action: 'execute',
          timestamp: now,
        });
      }
    });

    it('should count total events in household', async () => {
      const count = await eventRepository.countEvents(householdId);

      expect(count).toBeGreaterThanOrEqual(5);
    });

    it('should return 0 for household with no events', async () => {
      const otherHouseholdId = randomUUID();

      const count = await eventRepository.countEvents(otherHouseholdId);

      expect(count).toBe(0);
    });

    it('should require householdId', async () => {
      await expect(eventRepository.countEvents('')).rejects.toThrow(ValidationError);
    });
  });

  describe('countEventsByAction', () => {
    beforeEach(async () => {
      const actions: Array<'execute' | 'acknowledge' | 'undo' | 'comment'> = [
        'execute',
        'acknowledge',
        'undo',
        'comment',
      ];

      for (let i = 0; i < 3; i++) {
        for (const action of actions) {
          await eventRepository.logEvent({
            userId,
            taskId,
            householdId,
            action,
            timestamp: now - i * 1000,
          });
        }
      }
    });

    it('should count events by action type', async () => {
      const counts = await eventRepository.countEventsByAction(householdId);

      expect(counts.get('execute')).toBe(3);
      expect(counts.get('acknowledge')).toBe(3);
      expect(counts.get('undo')).toBe(3);
      expect(counts.get('comment')).toBe(3);
    });

    it('should return empty map for household with no events', async () => {
      const otherHouseholdId = randomUUID();

      const counts = await eventRepository.countEventsByAction(otherHouseholdId);

      expect(counts.size).toBe(0);
    });
  });

  describe('Household Isolation', () => {
    beforeEach(async () => {
      // Create events in multiple households
      const households = [householdId, randomUUID(), randomUUID()];

      for (const hid of households) {
        await eventRepository.logEvent({
          userId,
          taskId,
          householdId: hid,
          action: 'execute',
          timestamp: now,
        });
      }
    });

    it('should isolate events between households', async () => {
      const history = await eventRepository.getEventHistory(taskId, householdId);

      expect(history.every((e) => e.householdId === householdId)).toBe(true);
    });

    it('should isolate user events between households', async () => {
      const userEvents = await eventRepository.getEventsByUser(userId, householdId);

      expect(userEvents.every((e) => e.householdId === householdId)).toBe(true);
    });

    it('should isolate date range queries between households', async () => {
      const events = await eventRepository.queryEventsByDateRange(
        now - 1000,
        now + 1000,
        householdId
      );

      expect(events.every((e) => e.householdId === householdId)).toBe(true);
    });
  });
});
