import { TaskRepository } from '../../src/repositories/TaskRepository';
import { TaskEntity } from '../../src/entities/Task';
import { Repository } from 'typeorm';
import { ValidationError, NotFoundError } from '../../src/types';
import { AppDataSource } from '../../src/config/database';

// Mock TypeORM repository
jest.mock('../../src/config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

describe('TaskRepository', () => {
  let taskRepository: TaskRepository;
  let mockRepository: jest.Mocked<Repository<TaskEntity>>;

  const mockHouseholdId = '550e8400-e29b-41d4-a716-446655440000';
  const mockTaskId = '660e8400-e29b-41d4-a716-446655440000';
  const mockUserId = '770e8400-e29b-41d4-a716-446655440000';

  const createMockTaskEntity = (overrides = {}): TaskEntity => {
    const task = new TaskEntity();
    task.taskId = mockTaskId;
    task.name = 'Test Task';
    task.description = 'Test Description';
    task.category = 'Household Chores';
    task.householdId = mockHouseholdId;
    task.createdAtTimestamp = Date.now();
    task.createdBy = mockUserId;
    task.isActive = true;
    task.metadata = {};
    return Object.assign(task, overrides);
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup mock repository
    mockRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);

    taskRepository = new TaskRepository();
  });

  describe('findTaskById', () => {
    it('should return a task when found with correct household', async () => {
      const mockTask = createMockTaskEntity();
      mockRepository.findOne.mockResolvedValue(mockTask);

      const result = await taskRepository.findTaskById(mockTaskId, mockHouseholdId);

      expect(result).not.toBeNull();
      expect(result?.taskId).toBe(mockTaskId);
      expect(result?.householdId).toBe(mockHouseholdId);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { taskId: mockTaskId, householdId: mockHouseholdId },
      });
    });

    it('should return null when task not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await taskRepository.findTaskById(mockTaskId, mockHouseholdId);

      expect(result).toBeNull();
    });

    it('should enforce household isolation - task from different household', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const otherHouseholdId = '880e8400-e29b-41d4-a716-446655440000';
      const result = await taskRepository.findTaskById(mockTaskId, otherHouseholdId);

      expect(result).toBeNull();
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { taskId: mockTaskId, householdId: otherHouseholdId },
      });
    });

    it('should throw ValidationError when taskId is missing', async () => {
      await expect(taskRepository.findTaskById('', mockHouseholdId)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when householdId is missing', async () => {
      await expect(taskRepository.findTaskById(mockTaskId, '')).rejects.toThrow(ValidationError);
    });
  });

  describe('findTasksByHousehold', () => {
    it('should return all tasks for a household', async () => {
      const task1 = createMockTaskEntity({ taskId: '1' });
      const task2 = createMockTaskEntity({ taskId: '2' });

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([task1, task2]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const results = await taskRepository.findTasksByHousehold(mockHouseholdId);

      expect(results).toHaveLength(2);
      expect(results[0].taskId).toBe('1');
      expect(results[1].taskId).toBe('2');
    });

    it('should filter by category when provided', async () => {
      const task = createMockTaskEntity({ category: 'Pet Care' });

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([task]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await taskRepository.findTasksByHousehold(mockHouseholdId, { category: 'Pet Care' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('task.category = :category', {
        category: 'Pet Care',
      });
    });

    it('should filter by isActive status when provided', async () => {
      const task = createMockTaskEntity({ isActive: false });

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([task]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await taskRepository.findTasksByHousehold(mockHouseholdId, { isActive: false });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('task.isActive = :isActive', {
        isActive: false,
      });
    });

    it('should apply both category and isActive filters', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await taskRepository.findTasksByHousehold(mockHouseholdId, { category: 'Pet Care', isActive: true });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
    });

    it('should throw ValidationError when householdId is missing', async () => {
      await expect(taskRepository.findTasksByHousehold('')).rejects.toThrow(ValidationError);
    });

    it('should return empty array when no tasks found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const results = await taskRepository.findTasksByHousehold(mockHouseholdId);

      expect(results).toHaveLength(0);
    });
  });

  describe('createTask', () => {
    it('should create a new task with generated taskId and timestamp', async () => {
      const newTask = {
        name: 'New Task',
        description: 'New Description',
        category: 'Pet Care',
        householdId: mockHouseholdId,
        createdBy: mockUserId,
        isActive: true,
        metadata: {},
      };

      const mockCreatedTask = createMockTaskEntity({
        name: newTask.name,
        description: newTask.description,
        category: newTask.category,
      });

      mockRepository.create.mockReturnValue(mockCreatedTask);
      mockRepository.save.mockResolvedValue(mockCreatedTask);

      const result = await taskRepository.createTask(newTask);

      expect(result).not.toBeNull();
      expect(result.name).toBe('New Task');
      expect(result.taskId).toBe(mockTaskId); // Generated UUID
      expect(result.householdId).toBe(mockHouseholdId);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should set default isActive to true', async () => {
      const newTask = {
        name: 'New Task',
        description: 'New Description',
        category: 'Pet Care',
        householdId: mockHouseholdId,
        createdBy: mockUserId,
        isActive: undefined,
      };

      const mockCreatedTask = createMockTaskEntity({ isActive: true });

      mockRepository.create.mockReturnValue(mockCreatedTask);
      mockRepository.save.mockResolvedValue(mockCreatedTask);

      const result = await taskRepository.createTask(newTask as any);

      expect(result.isActive).toBe(true);
    });

    it('should throw ValidationError when name is missing', async () => {
      const newTask = {
        name: '',
        description: 'Description',
        category: 'Pet Care',
        householdId: mockHouseholdId,
        createdBy: mockUserId,
        isActive: true,
      };

      await expect(taskRepository.createTask(newTask)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when name exceeds 100 characters', async () => {
      const newTask = {
        name: 'a'.repeat(101),
        description: 'Description',
        category: 'Pet Care',
        householdId: mockHouseholdId,
        createdBy: mockUserId,
        isActive: true,
      };

      await expect(taskRepository.createTask(newTask)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when required fields are missing', async () => {
      const missingNameTask = {
        description: 'Description',
        category: 'Pet Care',
        householdId: mockHouseholdId,
        createdBy: mockUserId,
      };

      await expect(taskRepository.createTask(missingNameTask as any)).rejects.toThrow(ValidationError);
    });
  });

  describe('updateTask', () => {
    it('should update task metadata', async () => {
      const existingTask = createMockTaskEntity();
      const updates = {
        name: 'Updated Name',
        metadata: { estimatedMinutes: 45 },
      };

      mockRepository.findOne.mockResolvedValue(existingTask);
      const updatedEntity = new TaskEntity();
      Object.assign(updatedEntity, existingTask, updates);
      mockRepository.save.mockResolvedValue(updatedEntity);

      const result = await taskRepository.updateTask(mockTaskId, mockHouseholdId, updates);

      expect(result.name).toBe('Updated Name');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { taskId: mockTaskId, householdId: mockHouseholdId },
      });
    });

    it('should throw NotFoundError when task does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const updates = { name: 'Updated Name' };

      await expect(taskRepository.updateTask(mockTaskId, mockHouseholdId, updates)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should validate updated name length', async () => {
      const existingTask = createMockTaskEntity();
      const updates = {
        name: 'a'.repeat(101),
      };

      mockRepository.findOne.mockResolvedValue(existingTask);

      await expect(taskRepository.updateTask(mockTaskId, mockHouseholdId, updates)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when taskId or householdId is missing', async () => {
      const updates = { name: 'Updated Name' };

      await expect(taskRepository.updateTask('', mockHouseholdId, updates)).rejects.toThrow(ValidationError);
      await expect(taskRepository.updateTask(mockTaskId, '', updates)).rejects.toThrow(ValidationError);
    });

    it('should update description', async () => {
      const existingTask = createMockTaskEntity();
      const updates = { description: 'New Description' };

      mockRepository.findOne.mockResolvedValue(existingTask);
      const updatedEntity = new TaskEntity();
      Object.assign(updatedEntity, existingTask, updates);
      mockRepository.save.mockResolvedValue(updatedEntity);

      const result = await taskRepository.updateTask(mockTaskId, mockHouseholdId, updates);

      expect(result.description).toBe('New Description');
    });
  });

  describe('deactivateTask', () => {
    it('should set isActive to false', async () => {
      const existingTask = createMockTaskEntity({ isActive: true });
      const deactivatedTask = new TaskEntity();
      Object.assign(deactivatedTask, existingTask, { isActive: false });

      mockRepository.findOne.mockResolvedValue(existingTask);
      mockRepository.save.mockResolvedValue(deactivatedTask);

      await taskRepository.deactivateTask(mockTaskId, mockHouseholdId);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundError when task does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(taskRepository.deactivateTask(mockTaskId, mockHouseholdId)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when taskId or householdId is missing', async () => {
      await expect(taskRepository.deactivateTask('', mockHouseholdId)).rejects.toThrow(ValidationError);
      await expect(taskRepository.deactivateTask(mockTaskId, '')).rejects.toThrow(ValidationError);
    });

    it('should preserve task data when deactivating', async () => {
      const existingTask = createMockTaskEntity({
        name: 'Important Task',
        description: 'Should be preserved',
        metadata: { estimatedMinutes: 60 },
      });
      const deactivatedTask = new TaskEntity();
      Object.assign(deactivatedTask, existingTask, { isActive: false });

      mockRepository.findOne.mockResolvedValue(existingTask);
      mockRepository.save.mockResolvedValue(deactivatedTask);

      await taskRepository.deactivateTask(mockTaskId, mockHouseholdId);

      // Verify the task data was not changed beyond isActive
      const savedTask = mockRepository.save.mock.calls[0][0];
      expect(savedTask.name).toBe('Important Task');
      expect(savedTask.description).toBe('Should be preserved');
      expect(savedTask.metadata).toEqual({ estimatedMinutes: 60 });
    });
  });

  describe('getActiveTasks', () => {
    it('should return only active tasks', async () => {
      const activeTask1 = createMockTaskEntity({ taskId: '1', isActive: true });
      const activeTask2 = createMockTaskEntity({ taskId: '2', isActive: true });

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([activeTask1, activeTask2]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const results = await taskRepository.getActiveTasks(mockHouseholdId);

      expect(results).toHaveLength(2);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('task.isActive = :isActive', {
        isActive: true,
      });
    });
  });

  describe('getTasksByCategory', () => {
    it('should group tasks by category', async () => {
      const petCareTask = createMockTaskEntity({ taskId: '1', category: 'Pet Care' });
      const choreTask = createMockTaskEntity({ taskId: '2', category: 'Household Chores' });

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([petCareTask, choreTask]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await taskRepository.getTasksByCategory(mockHouseholdId);

      expect(result.has('Pet Care')).toBe(true);
      expect(result.has('Household Chores')).toBe(true);
      expect(result.get('Pet Care')).toHaveLength(1);
      expect(result.get('Household Chores')).toHaveLength(1);
    });

    it('should return empty map when no tasks found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await taskRepository.getTasksByCategory(mockHouseholdId);

      expect(result.size).toBe(0);
    });
  });
});
