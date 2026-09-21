import { Request, Response, NextFunction } from 'express';
import { HouseholdController } from '../../src/controllers/HouseholdController';
import { HouseholdRepository } from '../../src/repositories/HouseholdRepository';
import { ValidationError, ForbiddenError, NotFoundError } from '../../src/types';
import { randomUUID } from 'crypto';

jest.mock('../../src/repositories/HouseholdRepository');
jest.mock('../../src/repositories/UserRepository');

/**
 * HouseholdController Unit Tests
 * Tests household creation, retrieval, initialization, and access control
 *
 * Requirements: 8.1, 8.2, 20.1, 20.2 (Household creation and initialization)
 *              6.1 (Household isolation - users can only access their own households)
 */
describe('HouseholdController', () => {
  let controller: HouseholdController;
  let mockRequest: Partial<Request>;
  let statusResponse: any;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  const userId = randomUUID();
  const householdId = randomUUID();
  const otherUserId = randomUUID();

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new HouseholdController();

    // Create response mock with chainable status method
    const jsonFn = jest.fn();
    statusResponse = { json: jsonFn };

    mockRequest = {
      body: {},
      params: {},
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnValue(statusResponse),
    };

    mockNext = jest.fn();
  });

  describe('createHousehold', () => {
    it('should create a household with valid name and authenticated user', async () => {
      const householdName = 'Test Household';
      (mockRequest as any).userId = userId;
      mockRequest.body = { name: householdName };

      const createdHousehold = {
        householdId: randomUUID(),
        name: householdName,
        createdBy: userId,
        createdAt: Date.now(),
        members: [userId],
        settings: {
          defaultNotificationSettings: { notificationsEnabled: true, channels: ['push'] },
          taskCategories: ['Pet Care', 'Household Chores', 'Cooking', 'Shopping', 'Maintenance'],
        },
      };

      (HouseholdRepository.prototype.findByCreatorAndName as jest.Mock).mockResolvedValue(null);
      (HouseholdRepository.prototype.createHousehold as jest.Mock).mockResolvedValue(
        createdHousehold
      );

      await controller.createHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(statusResponse.json).toHaveBeenCalled();

      const responseData = (statusResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeDefined();
      expect(responseData.data.name).toBe(householdName);
      expect(responseData.data.createdBy).toBe(userId);
    });

    it('should initialize default task categories', async () => {
      (mockRequest as any).userId = userId;
      mockRequest.body = { name: 'Test Household' };

      const createdHousehold = {
        householdId: randomUUID(),
        name: 'Test Household',
        createdBy: userId,
        createdAt: Date.now(),
        members: [userId],
        settings: {
          defaultNotificationSettings: { notificationsEnabled: true, channels: ['push'] },
          taskCategories: ['Pet Care', 'Household Chores', 'Cooking', 'Shopping', 'Maintenance'],
        },
      };

      (HouseholdRepository.prototype.findByCreatorAndName as jest.Mock).mockResolvedValue(null);
      (HouseholdRepository.prototype.createHousehold as jest.Mock).mockResolvedValue(
        createdHousehold
      );

      await controller.createHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const responseData = (statusResponse.json as jest.Mock).mock.calls[0][0];
      const categories = responseData.data.settings.taskCategories;

      expect(categories).toContain('Pet Care');
      expect(categories).toContain('Household Chores');
      expect(categories).toContain('Cooking');
      expect(categories).toContain('Shopping');
      expect(categories).toContain('Maintenance');
      expect(categories.length).toBeGreaterThan(0);
    });

    it('should initialize household settings', async () => {
      (mockRequest as any).userId = userId;
      mockRequest.body = { name: 'Test Household' };

      const createdHousehold = {
        householdId: randomUUID(),
        name: 'Test Household',
        createdBy: userId,
        createdAt: Date.now(),
        members: [userId],
        settings: {
          defaultNotificationSettings: { notificationsEnabled: true, channels: ['push'] },
          taskCategories: ['Pet Care', 'Household Chores'],
        },
      };

      (HouseholdRepository.prototype.findByCreatorAndName as jest.Mock).mockResolvedValue(null);
      (HouseholdRepository.prototype.createHousehold as jest.Mock).mockResolvedValue(
        createdHousehold
      );

      await controller.createHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const responseData = (statusResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseData.data.settings).toBeDefined();
      expect(responseData.data.settings.defaultNotificationSettings).toBeDefined();
    });

    it('should reject request without name', async () => {
      (mockRequest as any).userId = userId;
      mockRequest.body = {};

      await controller.createHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toContain('name is required');
    });

    it('should reject name that is too long', async () => {
      (mockRequest as any).userId = userId;
      const longName = 'a'.repeat(256);
      mockRequest.body = { name: longName };

      await controller.createHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toContain('between 1 and 255 characters');
    });

    it('should reject unauthenticated request (no userId)', async () => {
      (mockRequest as any).userId = undefined;
      mockRequest.body = { name: 'Test Household' };

      await controller.createHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toContain('not authenticated');
    });

    it('should reject duplicate household name for same creator', async () => {
      (mockRequest as any).userId = userId;
      mockRequest.body = { name: 'Duplicate Name' };

      const existingHousehold = {
        householdId: randomUUID(),
        name: 'Duplicate Name',
        createdBy: userId,
        createdAt: Date.now(),
        members: [userId],
        settings: { defaultNotificationSettings: {}, taskCategories: [] },
      };

      (HouseholdRepository.prototype.findByCreatorAndName as jest.Mock).mockResolvedValue(
        existingHousehold
      );

      await controller.createHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toContain('already exists');
    });

    it('should set creator as owner and initial member', async () => {
      (mockRequest as any).userId = userId;
      mockRequest.body = { name: 'Owner Test Household' };

      const createdHousehold = {
        householdId: randomUUID(),
        name: 'Owner Test Household',
        createdBy: userId,
        createdAt: Date.now(),
        members: [userId],
        settings: {
          defaultNotificationSettings: { notificationsEnabled: true },
          taskCategories: ['Pet Care'],
        },
      };

      (HouseholdRepository.prototype.findByCreatorAndName as jest.Mock).mockResolvedValue(null);
      (HouseholdRepository.prototype.createHousehold as jest.Mock).mockResolvedValue(
        createdHousehold
      );

      await controller.createHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const responseData = (statusResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseData.data.createdBy).toBe(userId);
      expect(responseData.data.members).toContain(userId);
    });
  });

  describe('getHousehold', () => {
    it('should retrieve household for authorized member', async () => {
      (mockRequest as any).userId = userId;
      mockRequest.params = { householdId };

      const household = {
        householdId,
        name: 'Test Household',
        createdBy: userId,
        createdAt: Date.now(),
        members: [userId],
        settings: { defaultNotificationSettings: {}, taskCategories: [] },
      };

      (HouseholdRepository.prototype.isUserInHousehold as jest.Mock).mockResolvedValue(true);
      (HouseholdRepository.prototype.getHouseholdInfo as jest.Mock).mockResolvedValue(
        household
      );

      await controller.getHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(statusResponse.json).toHaveBeenCalled();

      const responseData = (statusResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.householdId).toBe(householdId);
    });

    it('should reject unauthenticated request', async () => {
      (mockRequest as any).userId = undefined;
      mockRequest.params = { householdId };

      await controller.getHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
    });

    it('should reject request from non-member user (household isolation)', async () => {
      (mockRequest as any).userId = otherUserId;
      mockRequest.params = { householdId };

      (HouseholdRepository.prototype.isUserInHousehold as jest.Mock).mockResolvedValue(
        false
      );

      await controller.getHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.message).toContain('does not have access');
    });

    it('should reject request for non-existent household', async () => {
      (mockRequest as any).userId = userId;
      mockRequest.params = { householdId };

      (HouseholdRepository.prototype.isUserInHousehold as jest.Mock).mockResolvedValue(true);
      (HouseholdRepository.prototype.getHouseholdInfo as jest.Mock).mockResolvedValue(null);

      await controller.getHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(NotFoundError);
    });

    it('should reject request without householdId', async () => {
      (mockRequest as any).userId = userId;
      mockRequest.params = {};

      await controller.getHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(ValidationError);
    });
  });

  describe('Household Creation Edge Cases', () => {
    it('should handle name with special characters', async () => {
      (mockRequest as any).userId = userId;
      mockRequest.body = { name: "Alice & Bob's Home! @#$%" };

      const createdHousehold = {
        householdId: randomUUID(),
        name: "Alice & Bob's Home! @#$%",
        createdBy: userId,
        createdAt: Date.now(),
        members: [userId],
        settings: { defaultNotificationSettings: {}, taskCategories: [] },
      };

      (HouseholdRepository.prototype.findByCreatorAndName as jest.Mock).mockResolvedValue(null);
      (HouseholdRepository.prototype.createHousehold as jest.Mock).mockResolvedValue(
        createdHousehold
      );

      await controller.createHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      const responseData = (statusResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseData.data.name).toBe("Alice & Bob's Home! @#$%");
    });

    it('should create household with minimum valid name (1 character)', async () => {
      (mockRequest as any).userId = userId;
      mockRequest.body = { name: 'A' };

      const createdHousehold = {
        householdId: randomUUID(),
        name: 'A',
        createdBy: userId,
        createdAt: Date.now(),
        members: [userId],
        settings: { defaultNotificationSettings: {}, taskCategories: [] },
      };

      (HouseholdRepository.prototype.findByCreatorAndName as jest.Mock).mockResolvedValue(null);
      (HouseholdRepository.prototype.createHousehold as jest.Mock).mockResolvedValue(
        createdHousehold
      );

      await controller.createHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      const responseData = (statusResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseData.data.name).toBe('A');
    });

    it('should create household with maximum valid name (255 characters)', async () => {
      (mockRequest as any).userId = userId;
      const maxName = 'a'.repeat(255);
      mockRequest.body = { name: maxName };

      const createdHousehold = {
        householdId: randomUUID(),
        name: maxName,
        createdBy: userId,
        createdAt: Date.now(),
        members: [userId],
        settings: { defaultNotificationSettings: {}, taskCategories: [] },
      };

      (HouseholdRepository.prototype.findByCreatorAndName as jest.Mock).mockResolvedValue(null);
      (HouseholdRepository.prototype.createHousehold as jest.Mock).mockResolvedValue(
        createdHousehold
      );

      await controller.createHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      const responseData = (statusResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseData.data.name).toBe(maxName);
    });
  });

  describe('Household Isolation', () => {
    it('should enforce household isolation - users cannot access other households', async () => {
      (mockRequest as any).userId = userId;
      mockRequest.params = { householdId };

      (HouseholdRepository.prototype.isUserInHousehold as jest.Mock).mockResolvedValue(
        false
      );

      await controller.getHousehold(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(ForbiddenError);
    });
  });
});
