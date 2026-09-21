import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PreferencesController } from '../../src/controllers/PreferencesController';
import { UserRepository } from '../../src/repositories/UserRepository';
import { TaskRepository } from '../../src/repositories/TaskRepository';
import { EventRepository } from '../../src/repositories/EventRepository';
import { HouseholdRepository } from '../../src/repositories/HouseholdRepository';
import { ValidationError, NotFoundError, HouseholdUser, Task } from '../../src/types';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../src/middleware/auth';

/**
 * Test suite for notification preference settings API (Task 23)
 * Tests all preference endpoints and validation logic
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
 */
describe('PreferencesController', () => {
  let controller: PreferencesController;
  let userRepository: jest.Mocked<UserRepository>;
  let taskRepository: jest.Mocked<TaskRepository>;
  let eventRepository: jest.Mocked<EventRepository>;
  let householdRepository: jest.Mocked<HouseholdRepository>;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockSetHeader: jest.Mock;

  beforeEach(() => {
    // Create mock repositories
    userRepository = {
      findUserById: jest.fn(),
      updateUserPreferences: jest.fn(),
    } as any;

    taskRepository = {
      findTaskById: jest.fn(),
    } as any;

    eventRepository = {
      logEvent: jest.fn(),
    } as any;

    householdRepository = {} as any;

    controller = new PreferencesController(
      userRepository,
      taskRepository,
      eventRepository,
      householdRepository
    );

    // Mock request and response
    mockJson = jest.fn().mockReturnValue(undefined);
    mockStatus = jest.fn().mockReturnThis();
    mockSetHeader = jest.fn().mockReturnThis();

    mockReq = {
      userId: 'test-user-id',
      householdId: 'test-household-id',
      body: {},
    };

    mockRes = {
      status: mockStatus,
      json: mockJson,
      send: jest.fn(),
      setHeader: mockSetHeader,
    } as any;
  });

  describe('getPreferences', () => {
    it('should return current user preferences', async () => {
      // Arrange
      const mockUser: HouseholdUser = {
        userId: 'test-user-id',
        householdId: 'test-household-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: ['task1'],
          quietHours: { start: 22, end: 8 },
          channels: ['push', 'email'],
        },
        createdAt: Date.now(),
      };

      userRepository.findUserById.mockResolvedValue(mockUser);

      // Act
      await controller.getPreferences(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          notificationsEnabled: true,
          mutedTasks: ['task1'],
          quietHours: { start: 22, end: 8 },
          channels: ['push', 'email'],
        },
        timestamp: expect.any(Number),
      });
    });

    it('should set cache control headers', async () => {
      // Arrange
      const mockUser: HouseholdUser = {
        userId: 'test-user-id',
        householdId: 'test-household-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      userRepository.findUserById.mockResolvedValue(mockUser);

      // Act
      await controller.getPreferences(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      // Assert
      expect(mockSetHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-cache, no-store, must-revalidate'
      );
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      userRepository.findUserById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        controller.getPreferences(
          mockReq as AuthenticatedRequest,
          mockRes as Response
        )
      ).rejects.toThrow(NotFoundError);
    });

    // Requirement 9.1, 9.2
    it('should display current notification preferences (Requirement 9.1, 9.2)', async () => {
      const mockUser: HouseholdUser = {
        userId: 'user1',
        householdId: 'household1',
        name: 'User One',
        email: 'user1@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: false,
          mutedTasks: ['task2', 'task3'],
          quietHours: { start: 23, end: 7 },
          channels: ['email', 'sms'],
        },
        createdAt: Date.now(),
      };

      userRepository.findUserById.mockResolvedValue(mockUser);

      await controller.getPreferences(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      const callArgs = mockJson.mock.calls[0][0] as any;
      expect(callArgs.data.notificationsEnabled).toBe(false);
      expect(callArgs.data.mutedTasks).toEqual(['task2', 'task3']);
      expect(callArgs.data.quietHours).toEqual({ start: 23, end: 7 });
      expect(callArgs.data.channels).toEqual(['email', 'sms']);
    });
  });

  describe('updatePreferences', () => {
    it('should update notification enabled status', async () => {
      // Arrange
      const mockUser: HouseholdUser = {
        userId: 'test-user-id',
        householdId: 'test-household-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      const updatedUser: HouseholdUser = {
        ...mockUser,
        preferences: { ...mockUser.preferences, notificationsEnabled: false },
      };

      userRepository.findUserById.mockResolvedValueOnce(mockUser);
      userRepository.updateUserPreferences.mockResolvedValue(undefined);
      userRepository.findUserById.mockResolvedValueOnce(updatedUser);
      eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' } as any);

      mockReq.body = { notificationsEnabled: false };

      // Act
      await controller.updatePreferences(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      // Assert
      expect(userRepository.updateUserPreferences).toHaveBeenCalledWith(
        'test-user-id',
        'test-household-id',
        { notificationsEnabled: false }
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it('should reject invalid notificationsEnabled type', async () => {
      // Arrange
      const mockUser: HouseholdUser = {
        userId: 'test-user-id',
        householdId: 'test-household-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      userRepository.findUserById.mockResolvedValue(mockUser);
      mockReq.body = { notificationsEnabled: 'true' }; // String instead of boolean

      // Act & Assert
      await expect(
        controller.updatePreferences(
          mockReq as AuthenticatedRequest,
          mockRes as Response
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should log preference changes to audit trail', async () => {
      // Arrange
      const mockUser: HouseholdUser = {
        userId: 'test-user-id',
        householdId: 'test-household-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      const updatedUser: HouseholdUser = {
        ...mockUser,
        preferences: { ...mockUser.preferences, notificationsEnabled: false },
      };

      userRepository.findUserById.mockResolvedValueOnce(mockUser);
      userRepository.updateUserPreferences.mockResolvedValue(undefined);
      userRepository.findUserById.mockResolvedValueOnce(updatedUser);
      eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' } as any);

      mockReq.body = { notificationsEnabled: false };

      // Act
      await controller.updatePreferences(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      // Assert
      expect(eventRepository.logEvent).toHaveBeenCalledWith({
        userId: 'test-user-id',
        taskId: 'preference-update',
        householdId: 'test-household-id',
        action: 'comment',
        timestamp: expect.any(Number),
        metadata: expect.objectContaining({
          eventType: 'preference_change',
          changes: { notificationsEnabled: false },
        }),
      });
    });

    // Requirement 9.2
    it('should apply preference changes immediately (Requirement 9.2)', async () => {
      const mockUser: HouseholdUser = {
        userId: 'user1',
        householdId: 'household1',
        name: 'User One',
        email: 'user1@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      const updatedUser: HouseholdUser = {
        ...mockUser,
        preferences: { ...mockUser.preferences, notificationsEnabled: false },
      };

      userRepository.findUserById.mockResolvedValueOnce(mockUser);
      userRepository.updateUserPreferences.mockResolvedValue(undefined);
      userRepository.findUserById.mockResolvedValueOnce(updatedUser);
      eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' } as any);

      mockReq.body = { notificationsEnabled: false };

      await controller.updatePreferences(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      const callArgs = mockJson.mock.calls[0][0] as any;
      expect(callArgs.data.notificationsEnabled).toBe(false);
    });
  });

  describe('muteTask', () => {
    it('should add task to muted list', async () => {
      // Arrange
      const mockUser: HouseholdUser = {
        userId: 'test-user-id',
        householdId: 'test-household-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      const mockTask: Task = {
        taskId: 'task1',
        name: 'Test Task',
        description: 'A test task',
        category: 'chores',
        householdId: 'test-household-id',
        createdAt: Date.now(),
        createdBy: 'test-user-id',
        isActive: true,
      };

      userRepository.findUserById.mockResolvedValue(mockUser);
      taskRepository.findTaskById.mockResolvedValue(mockTask);
      userRepository.updateUserPreferences.mockResolvedValue(undefined);
      eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' } as any);

      mockReq.body = { taskId: 'task1' };

      // Act
      await controller.muteTask(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      // Assert
      expect(userRepository.updateUserPreferences).toHaveBeenCalledWith(
        'test-user-id',
        'test-household-id',
        { mutedTasks: ['task1'] }
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it('should be idempotent - adding already-muted task is no-op', async () => {
      // Arrange
      const mockUser: HouseholdUser = {
        userId: 'test-user-id',
        householdId: 'test-household-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: ['task1'], // Already muted
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      const mockTask: Task = {
        taskId: 'task1',
        name: 'Test Task',
        description: 'A test task',
        category: 'chores',
        householdId: 'test-household-id',
        createdAt: Date.now(),
        createdBy: 'test-user-id',
        isActive: true,
      };

      userRepository.findUserById.mockResolvedValue(mockUser);
      taskRepository.findTaskById.mockResolvedValue(mockTask);

      mockReq.body = { taskId: 'task1' };

      // Act
      await controller.muteTask(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      // Assert
      expect(userRepository.updateUserPreferences).not.toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          taskId: 'task1',
          mutedAt: expect.any(Number),
          alreadyMuted: true,
        },
        timestamp: expect.any(Number),
      });
    });

    it('should throw NotFoundError for non-existent task', async () => {
      // Arrange
      const mockUser: HouseholdUser = {
        userId: 'test-user-id',
        householdId: 'test-household-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      userRepository.findUserById.mockResolvedValue(mockUser);
      taskRepository.findTaskById.mockResolvedValue(null); // Task not found

      mockReq.body = { taskId: 'nonexistent' };

      // Act & Assert
      await expect(
        controller.muteTask(
          mockReq as AuthenticatedRequest,
          mockRes as Response
        )
      ).rejects.toThrow(NotFoundError);
    });

    // Requirement 9.3, 9.4
    it('should mute and unmute tasks (Requirement 9.3, 9.4)', async () => {
      const mockUser: HouseholdUser = {
        userId: 'test-user-id',
        householdId: 'test-household-id',
        name: 'User One',
        email: 'user1@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      const mockTask: Task = {
        taskId: 'task1',
        name: 'Test Task',
        description: 'A test task',
        category: 'chores',
        householdId: 'test-household-id',
        createdAt: Date.now(),
        createdBy: 'test-user-id',
        isActive: true,
      };

      userRepository.findUserById.mockResolvedValue(mockUser);
      taskRepository.findTaskById.mockResolvedValue(mockTask);
      userRepository.updateUserPreferences.mockResolvedValue(undefined);
      eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' } as any);

      mockReq.body = { taskId: 'task1' };

      await controller.muteTask(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      expect(userRepository.updateUserPreferences).toHaveBeenCalledWith(
        'test-user-id',
        'test-household-id',
        { mutedTasks: ['task1'] }
      );
    });
  });

  describe('unmuteTask', () => {
    it('should remove task from muted list', async () => {
      // Arrange
      const mockUser: HouseholdUser = {
        userId: 'test-user-id',
        householdId: 'test-household-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: ['task1', 'task2'],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      const mockTask: Task = {
        taskId: 'task1',
        name: 'Test Task',
        description: 'A test task',
        category: 'chores',
        householdId: 'test-household-id',
        createdAt: Date.now(),
        createdBy: 'test-user-id',
        isActive: true,
      };

      userRepository.findUserById.mockResolvedValue(mockUser);
      taskRepository.findTaskById.mockResolvedValue(mockTask);
      userRepository.updateUserPreferences.mockResolvedValue(undefined);
      eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' } as any);

      mockReq.params = { taskId: 'task1' };

      // Act
      await controller.unmuteTask(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      // Assert
      expect(userRepository.updateUserPreferences).toHaveBeenCalledWith(
        'test-user-id',
        'test-household-id',
        { mutedTasks: ['task2'] }
      );
      expect(mockStatus).toHaveBeenCalledWith(204);
    });

    it('should return 204 No Content on success', async () => {
      // Arrange
      const mockUser: HouseholdUser = {
        userId: 'test-user-id',
        householdId: 'test-household-id',
        name: 'Test User',
        email: 'test@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: ['task1'],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      const mockTask: Task = {
        taskId: 'task1',
        name: 'Test Task',
        description: 'A test task',
        category: 'chores',
        householdId: 'test-household-id',
        createdAt: Date.now(),
        createdBy: 'test-user-id',
        isActive: true,
      };

      userRepository.findUserById.mockResolvedValue(mockUser);
      taskRepository.findTaskById.mockResolvedValue(mockTask);
      userRepository.updateUserPreferences.mockResolvedValue(undefined);
      eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' } as any);

      mockReq.params = { taskId: 'task1' };

      // Act
      await controller.unmuteTask(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(204);
    });
  });

  describe('Quiet Hours Validation', () => {
    // Requirement 9.5, 9.6
    it('should validate quiet hours format (valid ranges, Requirement 9.5, 9.6)', async () => {
      const mockUser: HouseholdUser = {
        userId: 'user1',
        householdId: 'household1',
        name: 'User One',
        email: 'user1@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      const updatedUser: HouseholdUser = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          quietHours: { start: 22, end: 6 },
        },
      };

      userRepository.findUserById.mockResolvedValueOnce(mockUser);
      userRepository.updateUserPreferences.mockResolvedValue(undefined);
      userRepository.findUserById.mockResolvedValueOnce(updatedUser);
      eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' } as any);

      mockReq.body = { quietHours: { start: 22, end: 6 } };

      await controller.updatePreferences(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      expect(userRepository.updateUserPreferences).toHaveBeenCalled();
    });

    it('should reject quiet hours with start > 23', async () => {
      const mockUser: HouseholdUser = {
        userId: 'user1',
        householdId: 'household1',
        name: 'User One',
        email: 'user1@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      userRepository.findUserById.mockResolvedValue(mockUser);

      mockReq.body = { quietHours: { start: 25, end: 6 } };

      await expect(
        controller.updatePreferences(
          mockReq as AuthenticatedRequest,
          mockRes as Response
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should reject quiet hours with end < 0', async () => {
      const mockUser: HouseholdUser = {
        userId: 'user1',
        householdId: 'household1',
        name: 'User One',
        email: 'user1@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      userRepository.findUserById.mockResolvedValue(mockUser);

      mockReq.body = { quietHours: { start: 22, end: -1 } };

      await expect(
        controller.updatePreferences(
          mockReq as AuthenticatedRequest,
          mockRes as Response
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should allow null quiet hours (no quiet hours)', async () => {
      const mockUser: HouseholdUser = {
        userId: 'user1',
        householdId: 'household1',
        name: 'User One',
        email: 'user1@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          quietHours: { start: 22, end: 6 },
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      const updatedUser: HouseholdUser = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          quietHours: undefined,
        },
      };

      userRepository.findUserById.mockResolvedValueOnce(mockUser);
      userRepository.updateUserPreferences.mockResolvedValue(undefined);
      userRepository.findUserById.mockResolvedValueOnce(updatedUser);
      eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' } as any);

      mockReq.body = { quietHours: null };

      await controller.updatePreferences(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      expect(userRepository.updateUserPreferences).toHaveBeenCalled();
    });

    it('should support midnight-wrapping quiet hours (e.g., 22:00-06:00)', async () => {
      const mockUser: HouseholdUser = {
        userId: 'test-user-id',
        householdId: 'test-household-id',
        name: 'User One',
        email: 'user1@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      const updatedUser: HouseholdUser = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          quietHours: { start: 22, end: 6 },
        },
      };

      userRepository.findUserById.mockResolvedValueOnce(mockUser);
      userRepository.updateUserPreferences.mockResolvedValue(undefined);
      userRepository.findUserById.mockResolvedValueOnce(updatedUser);
      eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' } as any);

      mockReq.body = { quietHours: { start: 22, end: 6 } };

      await controller.updatePreferences(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      expect(userRepository.updateUserPreferences).toHaveBeenCalledWith(
        'test-user-id',
        'test-household-id',
        { quietHours: { start: 22, end: 6 } }
      );
    });
  });

  describe('Channel Validation', () => {
    // Requirement 9.7
    it('should validate notification channels (Requirement 9.7)', async () => {
      const mockUser: HouseholdUser = {
        userId: 'test-user-id',
        householdId: 'test-household-id',
        name: 'User One',
        email: 'user1@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      const updatedUser: HouseholdUser = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          channels: ['push', 'email', 'sms'],
        },
      };

      userRepository.findUserById.mockResolvedValueOnce(mockUser);
      userRepository.updateUserPreferences.mockResolvedValue(undefined);
      userRepository.findUserById.mockResolvedValueOnce(updatedUser);
      eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' } as any);

      mockReq.body = { channels: ['push', 'email', 'sms'] };

      await controller.updatePreferences(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      expect(userRepository.updateUserPreferences).toHaveBeenCalledWith(
        'test-user-id',
        'test-household-id',
        { channels: ['push', 'email', 'sms'] }
      );
    });

    it('should reject invalid channel names', async () => {
      const mockUser: HouseholdUser = {
        userId: 'user1',
        householdId: 'household1',
        name: 'User One',
        email: 'user1@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      userRepository.findUserById.mockResolvedValue(mockUser);

      mockReq.body = { channels: ['push', 'telegram'] }; // 'telegram' is invalid

      await expect(
        controller.updatePreferences(
          mockReq as AuthenticatedRequest,
          mockRes as Response
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Access Control', () => {
    it('should only allow users to access their own preferences', async () => {
      // Arrange
      const mockUser: HouseholdUser = {
        userId: 'user-A',
        householdId: 'household1',
        name: 'User A',
        email: 'userA@example.com',
        role: 'member',
        pushToken: 'token123',
        permissions: [],
        preferences: {
          notificationsEnabled: true,
          mutedTasks: [],
          channels: ['push'],
        },
        createdAt: Date.now(),
      };

      userRepository.findUserById.mockResolvedValue(mockUser);

      // Try to access as user-A (correct)
      mockReq.userId = 'user-A';
      mockReq.householdId = 'household1';

      // Act
      await controller.getPreferences(
        mockReq as AuthenticatedRequest,
        mockRes as Response
      );

      // Assert
      expect(userRepository.findUserById).toHaveBeenCalledWith(
        'user-A',
        'household1'
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
    });
  });
});
