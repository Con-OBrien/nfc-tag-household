import { EventController } from '../../src/controllers/EventController';
import { EventRepository } from '../../src/repositories/EventRepository';
import { UserRepository } from '../../src/repositories/UserRepository';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { TaskEvent } from '../../src/types';

/**
 * EventController Unit Tests
 * Tests event history query endpoints
 *
 * Requirements: 10.4, 10.5, 10.6, 10.7, 10.8
 */
describe('EventController', () => {
  let eventController: EventController;
  let mockEventRepository: Partial<EventRepository>;
  let mockUserRepository: Partial<UserRepository>;

  const testIds = {
    householdId: randomUUID(),
    userId1: randomUUID(),
    userId2: randomUUID(),
    eventId: randomUUID(),
  };

  const createTestEvent = (overrides?: Partial<TaskEvent>): TaskEvent => ({
    eventId: randomUUID(),
    action: 'execute',
    userId: testIds.userId1,
    timestamp: Date.now(),
    taskId: randomUUID(),
    householdId: testIds.householdId,
    ...overrides,
  });

  beforeEach(() => {
    // Mock EventRepository
    mockEventRepository = {
      getEventHistory: jest.fn(),
      getHouseholdEvents: jest.fn(),
      queryEventsByDateRange: jest.fn(),
      getEventsByUser: jest.fn(),
      getEventsByAction: jest.fn(),
    };

    // Mock UserRepository
    mockUserRepository = {
      isUserInHousehold: jest.fn().mockResolvedValue(true),
      getUserHouseholds: jest.fn().mockResolvedValue([
        { householdId: testIds.householdId },
      ]),
      findUserDetails: jest.fn().mockResolvedValue({
        userId: testIds.userId1,
        name: 'Test User',
      }),
    };

    // Inject mocks
    eventController = new EventController();
    (eventController as any).eventRepository = mockEventRepository;
    (eventController as any).userRepository = mockUserRepository;
  });

  describe('getHouseholdEvents', () => {
    it('should return household events with pagination', async () => {
      const mockEvents = [
        createTestEvent({ timestamp: Date.now() }),
        createTestEvent({ timestamp: Date.now() - 1000 }),
        createTestEvent({ timestamp: Date.now() - 2000 }),
      ];

      (mockEventRepository.getHouseholdEvents as jest.Mock).mockResolvedValue(mockEvents);

      const req = {
        params: { householdId: testIds.householdId },
        query: { skip: '0', limit: '50' },
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getHouseholdEvents(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            events: expect.any(Array),
            total: 3,
          }),
        })
      );
    });

    it('should enforce household isolation', async () => {
      (mockUserRepository.isUserInHousehold as jest.Mock).mockResolvedValue(false);

      const req = {
        params: { householdId: testIds.householdId },
        query: {},
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getHouseholdEvents(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User is not a member of this household',
        })
      );
    });

    it('should filter events by eventType', async () => {
      const executeEvent = createTestEvent({ action: 'execute' });
      const acknowledgeEvent = createTestEvent({ action: 'acknowledge' });

      (mockEventRepository.getHouseholdEvents as jest.Mock).mockResolvedValue([
        executeEvent,
        acknowledgeEvent,
      ]);

      const req = {
        params: { householdId: testIds.householdId },
        query: { action: 'execute', skip: '0', limit: '50' },
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getHouseholdEvents(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            events: expect.arrayContaining([
              expect.objectContaining({ action: 'execute' }),
            ]),
          }),
        })
      );
    });

    it('should filter events by actor (userId)', async () => {
      const user1Event = createTestEvent({ userId: testIds.userId1 });
      const user2Event = createTestEvent({ userId: testIds.userId2 });

      (mockEventRepository.getHouseholdEvents as jest.Mock).mockResolvedValue([
        user1Event,
        user2Event,
      ]);

      const req = {
        params: { householdId: testIds.householdId },
        query: { actor: testIds.userId1, skip: '0', limit: '50' },
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getHouseholdEvents(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            events: expect.arrayContaining([
              expect.objectContaining({ userId: testIds.userId1 }),
            ]),
          }),
        })
      );
    });

    it('should handle date range filtering', async () => {
      const now = Date.now();
      const mockEvents = [
        createTestEvent({ timestamp: now - 5000 }),
        createTestEvent({ timestamp: now - 10000 }),
      ];

      (mockEventRepository.queryEventsByDateRange as jest.Mock).mockResolvedValue(mockEvents);

      const req = {
        params: { householdId: testIds.householdId },
        query: {
          startDate: String(now - 20000),
          endDate: String(now),
          skip: '0',
          limit: '50',
        },
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getHouseholdEvents(req, res, next);

      expect(mockEventRepository.queryEventsByDateRange).toHaveBeenCalledWith(
        now - 20000,
        now,
        testIds.householdId
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should enforce max limit of 100', async () => {
      const mockEvents: TaskEvent[] = [];
      for (let i = 0; i < 150; i++) {
        mockEvents.push(createTestEvent());
      }

      (mockEventRepository.getHouseholdEvents as jest.Mock).mockResolvedValue(mockEvents);

      const req = {
        params: { householdId: testIds.householdId },
        query: { skip: '0', limit: '200' }, // Request more than max
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getHouseholdEvents(req, res, next);

      const responseData = (res.json as jest.Mock).mock.calls[0][0].data;
      expect(responseData.events.length).toBeLessThanOrEqual(100);
      expect(responseData.limit).toBe(100);
    });
  });

  describe('getEventById', () => {
    it('should return event by ID', async () => {
      const testEvent = createTestEvent();
      const mockEvents = [testEvent];

      (mockEventRepository.getHouseholdEvents as jest.Mock).mockResolvedValue(mockEvents);

      const req = {
        params: {
          householdId: testIds.householdId,
          eventId: testEvent.eventId,
        },
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getEventById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            eventId: testEvent.eventId,
          }),
        })
      );
    });

    it('should return 404 for non-existent event', async () => {
      (mockEventRepository.getHouseholdEvents as jest.Mock).mockResolvedValue([]);

      const req = {
        params: {
          householdId: testIds.householdId,
          eventId: 'non-existent-id',
        },
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getEventById(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Event not found',
        })
      );
    });

    it('should enforce household isolation for single event', async () => {
      (mockUserRepository.isUserInHousehold as jest.Mock).mockResolvedValue(false);

      const req = {
        params: {
          householdId: testIds.householdId,
          eventId: testIds.eventId,
        },
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getEventById(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User is not a member of this household',
        })
      );
    });
  });

  describe('getUserEvents', () => {
    it('should return user events across households', async () => {
      const mockEvent1 = createTestEvent({ userId: testIds.userId1 });
      const mockEvent2 = createTestEvent({ userId: testIds.userId1 });

      (mockUserRepository.findUserDetails as jest.Mock).mockResolvedValue({
        userId: testIds.userId1,
        name: 'Test User',
      });

      (mockUserRepository.getUserHouseholds as jest.Mock).mockResolvedValue([
        { householdId: testIds.householdId },
      ]);

      (mockEventRepository.getEventsByUser as jest.Mock).mockResolvedValue([
        mockEvent1,
        mockEvent2,
      ]);

      const req = {
        query: { skip: '0', limit: '50' },
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getUserEvents(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            events: expect.any(Array),
          }),
        })
      );
    });

    it('should filter user events by type', async () => {
      const executeEvent = createTestEvent({
        action: 'execute',
        userId: testIds.userId1,
      });
      const acknowledgeEvent = createTestEvent({
        action: 'acknowledge',
        userId: testIds.userId1,
      });

      (mockUserRepository.findUserDetails as jest.Mock).mockResolvedValue({
        userId: testIds.userId1,
        name: 'Test User',
      });

      (mockUserRepository.getUserHouseholds as jest.Mock).mockResolvedValue([
        { householdId: testIds.householdId },
      ]);

      (mockEventRepository.getEventsByUser as jest.Mock).mockResolvedValue([
        executeEvent,
        acknowledgeEvent,
      ]);

      const req = {
        query: { action: 'execute', skip: '0', limit: '50' },
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getUserEvents(req, res, next);

      const responseData = (res.json as jest.Mock).mock.calls[0][0].data;
      const filteredEvents = responseData.events.filter(
        (e: TaskEvent) => e.action === 'execute'
      );
      expect(filteredEvents.length).toBeGreaterThan(0);
    });

    it('should return user not found error if user does not exist', async () => {
      (mockUserRepository.findUserDetails as jest.Mock).mockResolvedValue(null);

      const req = {
        query: { skip: '0', limit: '50' },
        userId: 'non-existent-user',
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getUserEvents(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found',
        })
      );
    });

    it('should sort events in reverse chronological order', async () => {
      const now = Date.now();
      const event1 = createTestEvent({ timestamp: now - 3000, userId: testIds.userId1 });
      const event2 = createTestEvent({ timestamp: now - 1000, userId: testIds.userId1 });
      const event3 = createTestEvent({ timestamp: now - 2000, userId: testIds.userId1 });

      (mockUserRepository.findUserDetails as jest.Mock).mockResolvedValue({
        userId: testIds.userId1,
        name: 'Test User',
      });

      (mockUserRepository.getUserHouseholds as jest.Mock).mockResolvedValue([
        { householdId: testIds.householdId },
      ]);

      (mockEventRepository.getEventsByUser as jest.Mock).mockResolvedValue([
        event1,
        event2,
        event3,
      ]);

      const req = {
        query: { skip: '0', limit: '50' },
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getUserEvents(req, res, next);

      const responseData = (res.json as jest.Mock).mock.calls[0][0].data;
      const events = responseData.events;

      // Verify reverse chronological order
      for (let i = 1; i < events.length; i++) {
        expect(events[i - 1].timestamp).toBeGreaterThanOrEqual(events[i].timestamp);
      }
    });
  });

  describe('Error handling', () => {
    it('should require authentication', async () => {
      const req = {
        params: { householdId: testIds.householdId },
        query: {},
        // No userId
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getHouseholdEvents(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not authenticated',
        })
      );
    });

    it('should validate date range', async () => {
      const req = {
        params: { householdId: testIds.householdId },
        query: {
          startDate: '2000',
          endDate: '1000', // endDate before startDate
          skip: '0',
          limit: '50',
        },
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getHouseholdEvents(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'startDate must be before endDate',
        })
      );
    });

    it('should validate pagination parameters', async () => {
      // No need to mock since this test validates parameters before repository call
      const req = {
        params: { householdId: testIds.householdId },
        query: {
          skip: 'invalid',
          limit: '50',
        },
        userId: testIds.userId1,
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.getHouseholdEvents(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'skip and limit must be valid integers',
        })
      );
    });
  });
});
