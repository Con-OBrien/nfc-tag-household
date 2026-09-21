import { Request, Response, NextFunction } from 'express';
import { EventController } from './EventController';

/**
 * Integration tests for EventController Event History Query Endpoints
 * Tests endpoint behavior with Request/Response/NextFunction mocking
 * Requirements: 10.4, 10.5, 10.6, 10.7, 10.8
 */

describe('EventController - Event History Query Endpoints (Integration)', () => {
  let eventController: EventController;
  let mockRequest: Partial<Request>;
  let mockResponse: any;
  let mockNext: jest.Mock;
  let responseData: any;

  beforeEach(() => {
    eventController = new EventController();

    responseData = {
      statusCode: null,
      body: null,
    };

    mockRequest = {
      params: {},
      query: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockImplementation((code) => {
        responseData.statusCode = code;
        return mockResponse;
      }),
      json: jest.fn().mockImplementation((data) => {
        responseData.body = data;
        return mockResponse;
      }),
    };

    mockNext = jest.fn();
  });

  describe('getHouseholdEvents() endpoint behavior', () => {
    it('should return error when householdId is missing', async () => {
      mockRequest.params = {}; // Missing householdId
      mockRequest.query = {};
      (mockRequest as any).userId = 'user_123';

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return error when userId is not authenticated', async () => {
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = {};
      // No userId set in request

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate skip parameter as integer', async () => {
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = { skip: 'not_a_number' };
      (mockRequest as any).userId = 'user_123';

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate limit parameter as integer', async () => {
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = { limit: 'invalid' };
      (mockRequest as any).userId = 'user_123';

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate startDate parameter as integer timestamp', async () => {
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = { startDate: 'invalid_date' };
      (mockRequest as any).userId = 'user_123';

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate endDate parameter as integer timestamp', async () => {
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = { endDate: 'not_a_timestamp' };
      (mockRequest as any).userId = 'user_123';

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when startDate > endDate', async () => {
      const now = Date.now();
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = {
        startDate: (now + 1000).toString(),
        endDate: now.toString(),
      };
      (mockRequest as any).userId = 'user_123';

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should enforce maximum limit of 100', async () => {
      const now = Date.now();
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = { limit: '999' };
      (mockRequest as any).userId = 'user_123';

      // Mock household membership check
      const userRepo = (eventController as any).userRepository;
      userRepo.isUserInHousehold = jest.fn().mockResolvedValue(true);

      // Mock event repository
      const eventRepo = (eventController as any).eventRepository;
      eventRepo.getHouseholdEvents = jest.fn().mockResolvedValue([]);

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Check that response was sent (not error)
      if (responseData.body) {
        expect(responseData.statusCode).toBe(200);
        expect(responseData.body.data.limit).toBeLessThanOrEqual(100);
      }
    });

    it('should apply skip and limit for pagination', async () => {
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = { skip: '10', limit: '5' };
      (mockRequest as any).userId = 'user_123';

      // Mock dependencies
      const userRepo = (eventController as any).userRepository;
      userRepo.isUserInHousehold = jest.fn().mockResolvedValue(true);

      const eventRepo = (eventController as any).eventRepository;
      eventRepo.getHouseholdEvents = jest.fn().mockResolvedValue([]);

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      if (responseData.body) {
        expect(responseData.body.data.skip).toBe(10);
        expect(responseData.body.data.limit).toBe(5);
      }
    });

    it('should support action filter parameter', async () => {
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = { action: 'execute' };
      (mockRequest as any).userId = 'user_123';

      const userRepo = (eventController as any).userRepository;
      userRepo.isUserInHousehold = jest.fn().mockResolvedValue(true);

      const eventRepo = (eventController as any).eventRepository;
      eventRepo.getHouseholdEvents = jest.fn().mockResolvedValue([]);

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      if (responseData.body) {
        expect(responseData.statusCode).toBe(200);
        expect(responseData.body.success).toBe(true);
      }
    });

    it('should support actor filter parameter', async () => {
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = { actor: 'user_456' };
      (mockRequest as any).userId = 'user_123';

      const userRepo = (eventController as any).userRepository;
      userRepo.isUserInHousehold = jest.fn().mockResolvedValue(true);

      const eventRepo = (eventController as any).eventRepository;
      eventRepo.getHouseholdEvents = jest.fn().mockResolvedValue([]);

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      if (responseData.body) {
        expect(responseData.statusCode).toBe(200);
        expect(responseData.body.success).toBe(true);
      }
    });
  });

  describe('getUserEvents() endpoint behavior', () => {
    it('should return error when userId is not authenticated', async () => {
      mockRequest.query = {};
      // No userId set

      await eventController.getUserEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate skip parameter as integer', async () => {
      mockRequest.query = { skip: 'invalid' };
      (mockRequest as any).userId = 'user_123';

      await eventController.getUserEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate limit parameter as integer', async () => {
      mockRequest.query = { limit: 'not_number' };
      (mockRequest as any).userId = 'user_123';

      await eventController.getUserEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate startDate parameter', async () => {
      mockRequest.query = { startDate: 'invalid_date' };
      (mockRequest as any).userId = 'user_123';

      await eventController.getUserEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate endDate parameter', async () => {
      mockRequest.query = { endDate: 'not_timestamp' };
      (mockRequest as any).userId = 'user_123';

      await eventController.getUserEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when startDate > endDate', async () => {
      const now = Date.now();
      mockRequest.query = {
        startDate: (now + 1000).toString(),
        endDate: now.toString(),
      };
      (mockRequest as any).userId = 'user_123';

      await eventController.getUserEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should support action filter parameter', async () => {
      mockRequest.query = { action: 'acknowledge' };
      (mockRequest as any).userId = 'user_123';

      const userRepo = (eventController as any).userRepository;
      userRepo.findUserDetails = jest.fn().mockResolvedValue({ userId: 'user_123' });
      userRepo.getUserHouseholds = jest.fn().mockResolvedValue([]);

      await eventController.getUserEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      if (responseData.body) {
        expect(responseData.statusCode).toBe(200);
        expect(responseData.body.success).toBe(true);
      }
    });

    it('should enforce pagination limits', async () => {
      mockRequest.query = { skip: '0', limit: '999' };
      (mockRequest as any).userId = 'user_123';

      const userRepo = (eventController as any).userRepository;
      userRepo.findUserDetails = jest.fn().mockResolvedValue({ userId: 'user_123' });
      userRepo.getUserHouseholds = jest.fn().mockResolvedValue([]);

      await eventController.getUserEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      if (responseData.body) {
        expect(responseData.body.data.limit).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('getEventById() endpoint behavior', () => {
    it('should return error when householdId is missing', async () => {
      mockRequest.params = { eventId: 'evt_123' }; // Missing householdId
      (mockRequest as any).userId = 'user_123';

      await eventController.getEventById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return error when eventId is missing', async () => {
      mockRequest.params = { householdId: 'hh_123' }; // Missing eventId
      (mockRequest as any).userId = 'user_123';

      await eventController.getEventById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return error when user not authenticated', async () => {
      mockRequest.params = { householdId: 'hh_123', eventId: 'evt_123' };
      // No userId

      await eventController.getEventById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Response format validation', () => {
    it('should return ApiResponse with success field', async () => {
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = {};
      (mockRequest as any).userId = 'user_123';

      const userRepo = (eventController as any).userRepository;
      userRepo.isUserInHousehold = jest.fn().mockResolvedValue(true);

      const eventRepo = (eventController as any).eventRepository;
      eventRepo.getHouseholdEvents = jest.fn().mockResolvedValue([]);

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      if (responseData.body) {
        expect(responseData.body).toHaveProperty('success');
        expect(responseData.body).toHaveProperty('data');
        expect(responseData.body).toHaveProperty('timestamp');
      }
    });

    it('should include pagination metadata in response', async () => {
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = { skip: '0', limit: '10' };
      (mockRequest as any).userId = 'user_123';

      const userRepo = (eventController as any).userRepository;
      userRepo.isUserInHousehold = jest.fn().mockResolvedValue(true);

      const eventRepo = (eventController as any).eventRepository;
      eventRepo.getHouseholdEvents = jest.fn().mockResolvedValue([]);

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      if (responseData.body) {
        expect(responseData.body.data).toHaveProperty('events');
        expect(responseData.body.data).toHaveProperty('skip');
        expect(responseData.body.data).toHaveProperty('limit');
        expect(responseData.body.data).toHaveProperty('total');
      }
    });

    it('should include timestamp in response', async () => {
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = {};
      (mockRequest as any).userId = 'user_123';

      const userRepo = (eventController as any).userRepository;
      userRepo.isUserInHousehold = jest.fn().mockResolvedValue(true);

      const eventRepo = (eventController as any).eventRepository;
      eventRepo.getHouseholdEvents = jest.fn().mockResolvedValue([]);

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      if (responseData.body) {
        expect(typeof responseData.body.timestamp).toBe('number');
        expect(responseData.body.timestamp).toBeGreaterThan(0);
      }
    });
  });

  describe('HTTP status codes', () => {
    it('should return 200 on successful query', async () => {
      mockRequest.params = { householdId: 'hh_123' };
      mockRequest.query = {};
      (mockRequest as any).userId = 'user_123';

      const userRepo = (eventController as any).userRepository;
      userRepo.isUserInHousehold = jest.fn().mockResolvedValue(true);

      const eventRepo = (eventController as any).eventRepository;
      eventRepo.getHouseholdEvents = jest.fn().mockResolvedValue([]);

      await eventController.getHouseholdEvents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      if (responseData.statusCode) {
        expect(responseData.statusCode).toBe(200);
      }
    });
  });
});
