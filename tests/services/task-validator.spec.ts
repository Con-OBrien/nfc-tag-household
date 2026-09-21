import { TaskValidatorService } from '../../src/services/TaskValidatorService';
import { TaskRepository } from '../../src/repositories/TaskRepository';
import { UserRepository } from '../../src/repositories/UserRepository';
import { Task, HouseholdUser } from '../../src/types';

describe('TaskValidatorService', () => {
  let service: TaskValidatorService;
  let mockTaskRepository: jest.Mocked<TaskRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const validTask: Task = {
    taskId: 'task_001',
    name: 'Test Task',
    description: 'A test task',
    category: 'chores',
    householdId: 'household_001',
    createdAt: Date.now(),
    createdBy: 'user_001',
    isActive: true,
  };

  const validUser: HouseholdUser = {
    userId: 'user_001',
    householdId: 'household_001',
    name: 'Test User',
    email: 'test@example.com',
    role: 'member',
    pushToken: 'token_001',
    permissions: ['task.execute'],
    preferences: {
      notificationsEnabled: true,
      mutedTasks: [],
      channels: ['push'],
    },
    createdAt: Date.now(),
  };

  const ownerUser: HouseholdUser = {
    ...validUser,
    role: 'owner',
    permissions: ['admin'],
  };

  beforeEach(() => {
    mockTaskRepository = {
      findTaskById: jest.fn().mockResolvedValue(validTask),
      findTasksByHousehold: jest.fn().mockResolvedValue([validTask]),
      createTask: jest.fn(),
      updateTask: jest.fn(),
    } as any;

    mockUserRepository = {
      findUserById: jest.fn().mockResolvedValue(validUser),
      findUsersInHousehold: jest.fn().mockResolvedValue([validUser, ownerUser]),
      updateUserPushToken: jest.fn(),
      updateUserPreferences: jest.fn(),
    } as any;

    service = new TaskValidatorService(mockTaskRepository, mockUserRepository);
  });

  describe('validateTaskCanExecute', () => {
    it('should validate user can execute task', async () => {
      const result = await service.validateTaskCanExecute(
        'user_001',
        'task_001',
        'household_001'
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.task).toEqual(validTask);
      expect(result.allowedUsers).toHaveLength(2);
    });

    it('should reject if user not found', async () => {
      mockUserRepository.findUserById.mockResolvedValueOnce(null);

      const result = await service.validateTaskCanExecute(
        'user_999',
        'task_001',
        'household_001'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User not found or does not belong to household');
    });

    it('should reject if task not found', async () => {
      mockTaskRepository.findTaskById.mockResolvedValueOnce(null);

      const result = await service.validateTaskCanExecute(
        'user_001',
        'task_999',
        'household_001'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task not found');
    });

    it('should enforce household isolation', async () => {
      const differentHouseholdTask = { ...validTask, householdId: 'household_002' };
      mockTaskRepository.findTaskById.mockResolvedValueOnce(differentHouseholdTask);

      const result = await service.validateTaskCanExecute(
        'user_001',
        'task_001',
        'household_001'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unauthorized household access');
    });

    it('should reject inactive tasks', async () => {
      const inactiveTask = { ...validTask, isActive: false };
      mockTaskRepository.findTaskById.mockResolvedValueOnce(inactiveTask);

      const result = await service.validateTaskCanExecute(
        'user_001',
        'task_001',
        'household_001'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task is not active');
    });

    it('should reject user without permission', async () => {
      const userWithoutPermission = { ...validUser, permissions: [] };
      mockUserRepository.findUserById.mockResolvedValueOnce(userWithoutPermission);

      const result = await service.validateTaskCanExecute(
        'user_001',
        'task_001',
        'household_001'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User lacks required permissions');
    });

    it('should accept owner role even without explicit permission', async () => {
      const ownerUserTyped: HouseholdUser = {
        ...validUser,
        role: 'owner',
        permissions: ['admin'],
      };
      mockUserRepository.findUserById.mockResolvedValueOnce(ownerUserTyped);

      const result = await service.validateTaskCanExecute(
        'user_001',
        'task_001',
        'household_001'
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle repository errors gracefully', async () => {
      mockTaskRepository.findTaskById.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.validateTaskCanExecute(
        'user_001',
        'task_001',
        'household_001'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Validation check failed');
    });

    it('should include all household members in allowed users', async () => {
      const additionalUser: HouseholdUser = {
        ...validUser,
        userId: 'user_002',
        name: 'Another User',
      };

      mockUserRepository.findUsersInHousehold.mockResolvedValueOnce([
        validUser,
        ownerUser,
        additionalUser,
      ]);

      const result = await service.validateTaskCanExecute(
        'user_001',
        'task_001',
        'household_001'
      );

      expect(result.allowedUsers).toHaveLength(3);
    });
  });

  describe('validateTaskExists', () => {
    it('should find existing task', async () => {
      const result = await service.validateTaskExists('task_001', 'household_001');

      expect(result).toEqual(validTask);
    });

    it('should return null if task not found', async () => {
      mockTaskRepository.findTaskById.mockResolvedValueOnce(null);

      const result = await service.validateTaskExists('task_999', 'household_001');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockTaskRepository.findTaskById.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.validateTaskExists('task_001', 'household_001');

      expect(result).toBeNull();
    });
  });

  describe('validateUserPermission', () => {
    it('should validate user has permission', async () => {
      const result = await service.validateUserPermission('user_001', 'task_001', 'household_001');

      expect(result).toBe(true);
    });

    it('should return false if user not found', async () => {
      mockUserRepository.findUserById.mockResolvedValueOnce(null);

      const result = await service.validateUserPermission('user_999', 'task_001', 'household_001');

      expect(result).toBe(false);
    });

    it('should return false if task not found', async () => {
      mockTaskRepository.findTaskById.mockResolvedValueOnce(null);

      const result = await service.validateUserPermission('user_001', 'task_999', 'household_001');

      expect(result).toBe(false);
    });

    it('should enforce household isolation for tasks', async () => {
      const differentHouseholdTask = { ...validTask, householdId: 'household_002' };
      mockTaskRepository.findTaskById.mockResolvedValueOnce(differentHouseholdTask);

      const result = await service.validateUserPermission('user_001', 'task_001', 'household_001');

      expect(result).toBe(false);
    });

    it('should enforce household isolation for users', async () => {
      const differentHouseholdUser = { ...validUser, householdId: 'household_002' };
      mockUserRepository.findUserById.mockResolvedValueOnce(differentHouseholdUser);

      const result = await service.validateUserPermission('user_001', 'task_001', 'household_001');

      expect(result).toBe(false);
    });

    it('should return false if user lacks permission', async () => {
      const userWithoutPermission = { ...validUser, permissions: [] };
      mockUserRepository.findUserById.mockResolvedValueOnce(userWithoutPermission);

      const result = await service.validateUserPermission('user_001', 'task_001', 'household_001');

      expect(result).toBe(false);
    });

    it('should return true for owner role', async () => {
      mockUserRepository.findUserById.mockResolvedValueOnce(ownerUser);

      const result = await service.validateUserPermission('user_001', 'task_001', 'household_001');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockUserRepository.findUserById.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.validateUserPermission('user_001', 'task_001', 'household_001');

      expect(result).toBe(false);
    });
  });

  describe('listAvailableTasks', () => {
    it('should return tasks user can execute', async () => {
      const result = await service.listAvailableTasks('user_001', 'household_001');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(validTask);
    });

    it('should return empty array if user not found', async () => {
      mockUserRepository.findUserById.mockResolvedValueOnce(null);

      const result = await service.listAvailableTasks('user_999', 'household_001');

      expect(result).toHaveLength(0);
    });

    it('should return empty array if user lacks permission', async () => {
      const userWithoutPermission = { ...validUser, permissions: [] };
      mockUserRepository.findUserById.mockResolvedValueOnce(userWithoutPermission);

      const result = await service.listAvailableTasks('user_001', 'household_001');

      expect(result).toHaveLength(0);
    });

    it('should return only active tasks', async () => {
      const activeTask = validTask;
      const inactiveTask = { ...validTask, taskId: 'task_002', isActive: false };

      mockTaskRepository.findTasksByHousehold.mockResolvedValueOnce([activeTask, inactiveTask]);

      const result = await service.listAvailableTasks('user_001', 'household_001');

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });

    it('should filter out tasks from different households', async () => {
      const samehouseholdTask = validTask;
      const differentHouseholdTask = { ...validTask, taskId: 'task_002', householdId: 'household_002' };

      mockTaskRepository.findTasksByHousehold.mockResolvedValueOnce([
        samehouseholdTask,
        differentHouseholdTask,
      ]);

      const result = await service.listAvailableTasks('user_001', 'household_001');

      expect(result).toHaveLength(1);
      expect(result[0].householdId).toBe('household_001');
    });

    it('should return empty array on error', async () => {
      mockUserRepository.findUserById.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.listAvailableTasks('user_001', 'household_001');

      expect(result).toHaveLength(0);
    });
  });

  describe('getAuthorizedHouseholdMembers', () => {
    it('should return all household members for valid task', async () => {
      const result = await service.getAuthorizedHouseholdMembers(
        'task_001',
        'household_001'
      );

      expect(result).toHaveLength(2);
    });

    it('should exclude specified user', async () => {
      const ownerUserWithDifferentId: HouseholdUser = {
        ...ownerUser,
        userId: 'user_002',
      };

      mockUserRepository.findUsersInHousehold.mockResolvedValueOnce([
        validUser,
        ownerUserWithDifferentId,
      ]);

      const result = await service.getAuthorizedHouseholdMembers(
        'task_001',
        'household_001',
        'user_001'
      );

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user_002');
    });

    it('should return empty array if task not found', async () => {
      mockTaskRepository.findTaskById.mockResolvedValueOnce(null);

      const result = await service.getAuthorizedHouseholdMembers(
        'task_999',
        'household_001'
      );

      expect(result).toHaveLength(0);
    });

    it('should return empty array on error', async () => {
      mockTaskRepository.findTaskById.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.getAuthorizedHouseholdMembers(
        'task_001',
        'household_001'
      );

      expect(result).toHaveLength(0);
    });

    it('should handle no members case', async () => {
      mockUserRepository.findUsersInHousehold.mockResolvedValueOnce([]);

      const result = await service.getAuthorizedHouseholdMembers(
        'task_001',
        'household_001'
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('validateRequiredFields', () => {
    it('should validate required fields', () => {
      const result = service.validateRequiredFields('user_001', 'task_001', 'household_001');

      expect(result).toBe(true);
    });

    it('should reject empty userId', () => {
      expect(service.validateRequiredFields('', 'task_001', 'household_001')).toBe(false);
    });

    it('should reject whitespace-only userId', () => {
      expect(service.validateRequiredFields('   ', 'task_001', 'household_001')).toBe(false);
    });

    it('should reject non-string userId', () => {
      expect(service.validateRequiredFields(123 as any, 'task_001', 'household_001')).toBe(false);
    });

    it('should reject empty taskId', () => {
      expect(service.validateRequiredFields('user_001', '', 'household_001')).toBe(false);
    });

    it('should reject empty householdId', () => {
      expect(service.validateRequiredFields('user_001', 'task_001', '')).toBe(false);
    });

    it('should reject null values', () => {
      expect(service.validateRequiredFields(null as any, 'task_001', 'household_001')).toBe(false);
      expect(service.validateRequiredFields('user_001', null as any, 'household_001')).toBe(false);
      expect(service.validateRequiredFields('user_001', 'task_001', null as any)).toBe(false);
    });

    it('should reject undefined values', () => {
      expect(service.validateRequiredFields(undefined as any, 'task_001', 'household_001')).toBe(
        false
      );
      expect(service.validateRequiredFields('user_001', undefined as any, 'household_001')).toBe(
        false
      );
      expect(service.validateRequiredFields('user_001', 'task_001', undefined as any)).toBe(false);
    });
  });

  describe('Permission checking', () => {
    it('should accept users with admin permission', async () => {
      const userWithAdmin = { ...validUser, permissions: ['admin'] };
      mockUserRepository.findUserById.mockResolvedValueOnce(userWithAdmin);

      const result = await service.validateUserPermission('user_001', 'task_001', 'household_001');

      expect(result).toBe(true);
    });

    it('should accept owner role implicitly', async () => {
      const ownerUserTyped: HouseholdUser = {
        ...validUser,
        role: 'owner',
        permissions: ['admin'],
      };
      mockUserRepository.findUserById.mockResolvedValueOnce(ownerUserTyped);

      const result = await service.validateUserPermission('user_001', 'task_001', 'household_001');

      expect(result).toBe(true);
    });

    it('should accept specific task.execute permission', async () => {
      const userWithTaskExecute = { ...validUser, permissions: ['task.execute'] };
      mockUserRepository.findUserById.mockResolvedValueOnce(userWithTaskExecute);

      const result = await service.validateUserPermission('user_001', 'task_001', 'household_001');

      expect(result).toBe(true);
    });
  });

  describe('Household isolation', () => {
    it('should isolate tasks by household', async () => {
      const differentHouseholdTask = { ...validTask, householdId: 'different_household' };
      mockTaskRepository.findTaskById.mockResolvedValueOnce(differentHouseholdTask);

      const result = await service.validateTaskCanExecute(
        'user_001',
        'task_001',
        'household_001'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unauthorized household access');
    });

    it('should enforce household isolation in permission checks', async () => {
      const differentHouseholdUser = { ...validUser, householdId: 'different_household' };
      mockUserRepository.findUserById.mockResolvedValueOnce(differentHouseholdUser);

      const result = await service.validateUserPermission('user_001', 'task_001', 'household_001');

      expect(result).toBe(false);
    });
  });
});
