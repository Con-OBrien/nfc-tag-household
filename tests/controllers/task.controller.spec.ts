import { Request, Response, NextFunction } from 'express';
import { TaskController } from '../../src/controllers/TaskController';
import { TaskRepository } from '../../src/repositories/TaskRepository';
import { UserRepository } from '../../src/repositories/UserRepository';
import { ValidationError, ForbiddenError, NotFoundError, Task } from '../../src/types';
import { randomUUID } from 'crypto';

// Mock repositories
jest.mock('../../src/repositories/TaskRepository');
jest.mock('../../src/repositories/UserRepository');

describe('TaskController', () => {
  let controller: TaskController;
  let mockTaskRepo: any;
  let mockUserRepo: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  // Test data
  const testHouseholdId = randomUUID();
  const testUserId = randomUUID();
  const testTaskId = randomUUID();
  const testOwnerId = randomUUID();

  const mockTask: Task = {
    taskId: testTaskId,
    name: 'Feed Lenny',
    description: 'Feed Lenny dinner at 6pm',
    category: 'Pet Care',
    householdId: testHouseholdId,
    createdAt: Date.now(),
    createdBy: testOwnerId,
    isActive: true,
  };

  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();

    // Create controller - it will use the mocked repositories
    controller = new TaskController();

    // Get references to mocked instances
    mockTaskRepo = (TaskRepository as jest.MockedClass<typeof TaskRepository>).mock.instances[0];
    mockUserRepo = (UserRepository as jest.MockedClass<typeof UserRepository>).mock.instances[0];

    // Set up mock response methods
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('createTask', () => {
    it('should create a task with valid input', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId },
        body: {
          name: 'Feed Lenny',
          description: 'Feed Lenny dinner at 6pm',
          category: 'Pet Care',
        },
        userId: testUserId,
      } as any;

      // Mock user is in household
      mockUserRepo.isUserInHousehold.mockResolvedValue(true);

      // Mock task creation
      mockTaskRepo.createTask.mockResolvedValue(mockTask);

      await controller.createTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            taskId: testTaskId,
            name: 'Feed Lenny',
            category: 'Pet Care',
          }),
        })
      );
    });

    it('should reject missing required fields', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId },
        body: {
          name: 'Feed Lenny',
          // Missing description and category
        },
        userId: testUserId,
      } as any;

      await controller.createTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
    });

    it('should reject task name exceeding max length', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId },
        body: {
          name: 'a'.repeat(101), // Exceeds 100 char limit
          description: 'Valid description',
          category: 'Pet Care',
        },
        userId: testUserId,
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);

      await controller.createTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        })
      );
    });

    it('should reject task description exceeding max length', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId },
        body: {
          name: 'Valid name',
          description: 'a'.repeat(501), // Exceeds 500 char limit
          category: 'Pet Care',
        },
        userId: testUserId,
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);

      await controller.createTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
    });

    it('should reject non-member from creating tasks', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId },
        body: {
          name: 'Feed Lenny',
          description: 'Feed Lenny dinner at 6pm',
          category: 'Pet Care',
        },
        userId: randomUUID(), // Different user not in household
      } as any;

      // Mock user is NOT in household
      mockUserRepo.isUserInHousehold.mockResolvedValue(false);

      await controller.createTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should reject unauthenticated users', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId },
        body: {
          name: 'Feed Lenny',
          description: 'Feed Lenny dinner at 6pm',
          category: 'Pet Care',
        },
        // No userId
      } as any;

      await controller.createTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
    });
  });

  describe('updateTask', () => {
    it('should update task by owner', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId, taskId: testTaskId },
        body: {
          name: 'Updated Feed Lenny',
          description: 'Updated description',
        },
        userId: testOwnerId, // Same as task creator
      } as any;

      // Mock user is in household
      mockUserRepo.isUserInHousehold.mockResolvedValue(true);

      // Mock find returns the existing task
      mockTaskRepo.findTaskById.mockResolvedValue(mockTask);

      // Mock update
      const updatedTask = { ...mockTask, name: 'Updated Feed Lenny' };
      mockTaskRepo.updateTask.mockResolvedValue(updatedTask);

      await controller.updateTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            name: 'Updated Feed Lenny',
          }),
        })
      );
    });

    it('should reject update by non-owner', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId, taskId: testTaskId },
        body: {
          name: 'Updated Feed Lenny',
        },
        userId: randomUUID(), // Different user
      } as any;

      // Mock user is in household
      mockUserRepo.isUserInHousehold.mockResolvedValue(true);

      // Mock find returns the existing task with different owner
      mockTaskRepo.findTaskById.mockResolvedValue(mockTask);

      await controller.updateTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN',
          message: expect.stringContaining('owner'),
        })
      );
    });

    it('should validate task name on update', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId, taskId: testTaskId },
        body: {
          name: 'a'.repeat(101), // Exceeds max length
        },
        userId: testOwnerId,
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);
      mockTaskRepo.findTaskById.mockResolvedValue(mockTask);

      await controller.updateTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
    });

    it('should return 404 if task not found', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId, taskId: testTaskId },
        body: {
          name: 'Updated name',
        },
        userId: testOwnerId,
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);
      mockTaskRepo.findTaskById.mockResolvedValue(null);

      await controller.updateTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NOT_FOUND',
        })
      );
    });
  });

  describe('deactivateTask', () => {
    it('should deactivate task by owner', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId, taskId: testTaskId },
        userId: testOwnerId,
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);
      mockTaskRepo.findTaskById.mockResolvedValue(mockTask);
      mockTaskRepo.deactivateTask.mockResolvedValue(undefined);

      await controller.deactivateTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should reject deactivation by non-owner', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId, taskId: testTaskId },
        userId: randomUUID(), // Different user
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);
      mockTaskRepo.findTaskById.mockResolvedValue(mockTask);

      await controller.deactivateTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should preserve events when deactivating', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId, taskId: testTaskId },
        userId: testOwnerId,
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);
      mockTaskRepo.findTaskById.mockResolvedValue(mockTask);
      mockTaskRepo.deactivateTask.mockResolvedValue(undefined);

      await controller.deactivateTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify deactivateTask was called (which preserves events)
      expect(mockTaskRepo.deactivateTask).toHaveBeenCalledWith(
        testTaskId,
        testHouseholdId
      );
    });
  });

  describe('listTasks', () => {
    it('should list tasks with household isolation', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId },
        query: {},
        userId: testUserId,
      } as any;

      const tasks = [mockTask];

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);
      mockTaskRepo.findTasksByHousehold.mockResolvedValue(tasks);

      await controller.listTasks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            tasks: expect.any(Array),
            total: 1,
            skip: 0,
            limit: 50,
          }),
        })
      );
    });

    it('should filter by active status', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId },
        query: { active: 'true' },
        userId: testUserId,
      } as any;

      const activeTasks = [mockTask];

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);
      mockTaskRepo.findTasksByHousehold.mockResolvedValue(activeTasks);

      await controller.listTasks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Verify filter was passed
      expect(mockTaskRepo.findTasksByHousehold).toHaveBeenCalledWith(
        testHouseholdId,
        expect.objectContaining({ isActive: true })
      );
    });

    it('should filter by category', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId },
        query: { category: 'Pet Care' },
        userId: testUserId,
      } as any;

      const categoryTasks = [mockTask];

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);
      mockTaskRepo.findTasksByHousehold.mockResolvedValue(categoryTasks);

      await controller.listTasks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockTaskRepo.findTasksByHousehold).toHaveBeenCalledWith(
        testHouseholdId,
        expect.objectContaining({ category: 'Pet Care' })
      );
    });

    it('should apply pagination correctly', async () => {
      const tasks = Array.from({ length: 100 }, (_, i) => ({
        ...mockTask,
        taskId: randomUUID(),
        name: `Task ${i}`,
      }));

      mockRequest = {
        params: { householdId: testHouseholdId },
        query: { skip: '10', limit: '25' },
        userId: testUserId,
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);
      mockTaskRepo.findTasksByHousehold.mockResolvedValue(tasks);

      await controller.listTasks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tasks: expect.arrayContaining(tasks.slice(10, 35)),
            total: 100,
            skip: 10,
            limit: 25,
          }),
        })
      );
    });

    it('should enforce max limit of 100', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId },
        query: { limit: '200' },
        userId: testUserId,
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);
      mockTaskRepo.findTasksByHousehold.mockResolvedValue([]);

      await controller.listTasks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            limit: 100, // Capped at 100
          }),
        })
      );
    });

    it('should reject non-member from listing household tasks', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId },
        query: {},
        userId: randomUUID(),
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(false);

      await controller.listTasks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });

    it('should reject invalid active parameter', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId },
        query: { active: 'maybe' },
        userId: testUserId,
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);

      await controller.listTasks(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
    });
  });

  describe('getTask', () => {
    it('should get single task details', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId, taskId: testTaskId },
        userId: testUserId,
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);
      mockTaskRepo.findTaskById.mockResolvedValue(mockTask);

      await controller.getTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockTask,
        })
      );
    });

    it('should return 404 if task not found', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId, taskId: testTaskId },
        userId: testUserId,
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(true);
      mockTaskRepo.findTaskById.mockResolvedValue(null);

      await controller.getTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NOT_FOUND',
        })
      );
    });

    it('should enforce household isolation', async () => {
      mockRequest = {
        params: { householdId: testHouseholdId, taskId: testTaskId },
        userId: randomUUID(),
      } as any;

      mockUserRepo.isUserInHousehold.mockResolvedValue(false);

      await controller.getTask(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN',
        })
      );
    });
  });
});
