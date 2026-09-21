"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TaskController_1 = require("../../src/controllers/TaskController");
const TaskRepository_1 = require("../../src/repositories/TaskRepository");
const UserRepository_1 = require("../../src/repositories/UserRepository");
const types_1 = require("../../src/types");
const crypto_1 = require("crypto");
// Mock repositories
jest.mock('../../src/repositories/TaskRepository');
jest.mock('../../src/repositories/UserRepository');
describe('TaskController', () => {
    let controller;
    let mockTaskRepo;
    let mockUserRepo;
    let mockRequest;
    let mockResponse;
    let mockNext;
    // Test data
    const testHouseholdId = (0, crypto_1.randomUUID)();
    const testUserId = (0, crypto_1.randomUUID)();
    const testTaskId = (0, crypto_1.randomUUID)();
    const testOwnerId = (0, crypto_1.randomUUID)();
    const mockTask = {
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
        controller = new TaskController_1.TaskController();
        // Get references to mocked instances
        mockTaskRepo = TaskRepository_1.TaskRepository.mock.instances[0];
        mockUserRepo = UserRepository_1.UserRepository.mock.instances[0];
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
            };
            // Mock user is in household
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            // Mock task creation
            mockTaskRepo.createTask.mockResolvedValue(mockTask);
            await controller.createTask(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(201);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    taskId: testTaskId,
                    name: 'Feed Lenny',
                    category: 'Pet Care',
                }),
            }));
        });
        it('should reject missing required fields', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId },
                body: {
                    name: 'Feed Lenny',
                    // Missing description and category
                },
                userId: testUserId,
            };
            await controller.createTask(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.any(types_1.ValidationError));
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
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            await controller.createTask(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                code: 'VALIDATION_ERROR',
            }));
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
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            await controller.createTask(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.any(types_1.ValidationError));
        });
        it('should reject non-member from creating tasks', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId },
                body: {
                    name: 'Feed Lenny',
                    description: 'Feed Lenny dinner at 6pm',
                    category: 'Pet Care',
                },
                userId: (0, crypto_1.randomUUID)(), // Different user not in household
            };
            // Mock user is NOT in household
            mockUserRepo.isUserInHousehold.mockResolvedValue(false);
            await controller.createTask(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                code: 'FORBIDDEN',
            }));
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
            };
            await controller.createTask(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.any(types_1.ValidationError));
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
            };
            // Mock user is in household
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            // Mock find returns the existing task
            mockTaskRepo.findTaskById.mockResolvedValue(mockTask);
            // Mock update
            const updatedTask = { ...mockTask, name: 'Updated Feed Lenny' };
            mockTaskRepo.updateTask.mockResolvedValue(updatedTask);
            await controller.updateTask(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    name: 'Updated Feed Lenny',
                }),
            }));
        });
        it('should reject update by non-owner', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId, taskId: testTaskId },
                body: {
                    name: 'Updated Feed Lenny',
                },
                userId: (0, crypto_1.randomUUID)(), // Different user
            };
            // Mock user is in household
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            // Mock find returns the existing task with different owner
            mockTaskRepo.findTaskById.mockResolvedValue(mockTask);
            await controller.updateTask(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                code: 'FORBIDDEN',
                message: expect.stringContaining('owner'),
            }));
        });
        it('should validate task name on update', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId, taskId: testTaskId },
                body: {
                    name: 'a'.repeat(101), // Exceeds max length
                },
                userId: testOwnerId,
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            mockTaskRepo.findTaskById.mockResolvedValue(mockTask);
            await controller.updateTask(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.any(types_1.ValidationError));
        });
        it('should return 404 if task not found', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId, taskId: testTaskId },
                body: {
                    name: 'Updated name',
                },
                userId: testOwnerId,
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            mockTaskRepo.findTaskById.mockResolvedValue(null);
            await controller.updateTask(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                code: 'NOT_FOUND',
            }));
        });
    });
    describe('deactivateTask', () => {
        it('should deactivate task by owner', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId, taskId: testTaskId },
                userId: testOwnerId,
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            mockTaskRepo.findTaskById.mockResolvedValue(mockTask);
            mockTaskRepo.deactivateTask.mockResolvedValue(undefined);
            await controller.deactivateTask(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(204);
            expect(mockResponse.send).toHaveBeenCalled();
        });
        it('should reject deactivation by non-owner', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId, taskId: testTaskId },
                userId: (0, crypto_1.randomUUID)(), // Different user
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            mockTaskRepo.findTaskById.mockResolvedValue(mockTask);
            await controller.deactivateTask(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                code: 'FORBIDDEN',
            }));
        });
        it('should preserve events when deactivating', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId, taskId: testTaskId },
                userId: testOwnerId,
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            mockTaskRepo.findTaskById.mockResolvedValue(mockTask);
            mockTaskRepo.deactivateTask.mockResolvedValue(undefined);
            await controller.deactivateTask(mockRequest, mockResponse, mockNext);
            // Verify deactivateTask was called (which preserves events)
            expect(mockTaskRepo.deactivateTask).toHaveBeenCalledWith(testTaskId, testHouseholdId);
        });
    });
    describe('listTasks', () => {
        it('should list tasks with household isolation', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId },
                query: {},
                userId: testUserId,
            };
            const tasks = [mockTask];
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            mockTaskRepo.findTasksByHousehold.mockResolvedValue(tasks);
            await controller.listTasks(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    tasks: expect.any(Array),
                    total: 1,
                    skip: 0,
                    limit: 50,
                }),
            }));
        });
        it('should filter by active status', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId },
                query: { active: 'true' },
                userId: testUserId,
            };
            const activeTasks = [mockTask];
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            mockTaskRepo.findTasksByHousehold.mockResolvedValue(activeTasks);
            await controller.listTasks(mockRequest, mockResponse, mockNext);
            // Verify filter was passed
            expect(mockTaskRepo.findTasksByHousehold).toHaveBeenCalledWith(testHouseholdId, expect.objectContaining({ isActive: true }));
        });
        it('should filter by category', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId },
                query: { category: 'Pet Care' },
                userId: testUserId,
            };
            const categoryTasks = [mockTask];
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            mockTaskRepo.findTasksByHousehold.mockResolvedValue(categoryTasks);
            await controller.listTasks(mockRequest, mockResponse, mockNext);
            expect(mockTaskRepo.findTasksByHousehold).toHaveBeenCalledWith(testHouseholdId, expect.objectContaining({ category: 'Pet Care' }));
        });
        it('should apply pagination correctly', async () => {
            const tasks = Array.from({ length: 100 }, (_, i) => ({
                ...mockTask,
                taskId: (0, crypto_1.randomUUID)(),
                name: `Task ${i}`,
            }));
            mockRequest = {
                params: { householdId: testHouseholdId },
                query: { skip: '10', limit: '25' },
                userId: testUserId,
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            mockTaskRepo.findTasksByHousehold.mockResolvedValue(tasks);
            await controller.listTasks(mockRequest, mockResponse, mockNext);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    tasks: expect.arrayContaining(tasks.slice(10, 35)),
                    total: 100,
                    skip: 10,
                    limit: 25,
                }),
            }));
        });
        it('should enforce max limit of 100', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId },
                query: { limit: '200' },
                userId: testUserId,
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            mockTaskRepo.findTasksByHousehold.mockResolvedValue([]);
            await controller.listTasks(mockRequest, mockResponse, mockNext);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    limit: 100, // Capped at 100
                }),
            }));
        });
        it('should reject non-member from listing household tasks', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId },
                query: {},
                userId: (0, crypto_1.randomUUID)(),
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(false);
            await controller.listTasks(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                code: 'FORBIDDEN',
            }));
        });
        it('should reject invalid active parameter', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId },
                query: { active: 'maybe' },
                userId: testUserId,
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            await controller.listTasks(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.any(types_1.ValidationError));
        });
    });
    describe('getTask', () => {
        it('should get single task details', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId, taskId: testTaskId },
                userId: testUserId,
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            mockTaskRepo.findTaskById.mockResolvedValue(mockTask);
            await controller.getTask(mockRequest, mockResponse, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: mockTask,
            }));
        });
        it('should return 404 if task not found', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId, taskId: testTaskId },
                userId: testUserId,
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(true);
            mockTaskRepo.findTaskById.mockResolvedValue(null);
            await controller.getTask(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                code: 'NOT_FOUND',
            }));
        });
        it('should enforce household isolation', async () => {
            mockRequest = {
                params: { householdId: testHouseholdId, taskId: testTaskId },
                userId: (0, crypto_1.randomUUID)(),
            };
            mockUserRepo.isUserInHousehold.mockResolvedValue(false);
            await controller.getTask(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                code: 'FORBIDDEN',
            }));
        });
    });
});
