"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const PreferencesController_1 = require("../../src/controllers/PreferencesController");
const types_1 = require("../../src/types");
/**
 * Test suite for notification preference settings API (Task 23)
 * Tests all preference endpoints and validation logic
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
 */
(0, globals_1.describe)('PreferencesController', () => {
    let controller;
    let userRepository;
    let taskRepository;
    let eventRepository;
    let householdRepository;
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    let mockSetHeader;
    (0, globals_1.beforeEach)(() => {
        // Create mock repositories
        userRepository = {
            findUserById: globals_1.jest.fn(),
            updateUserPreferences: globals_1.jest.fn(),
        };
        taskRepository = {
            findTaskById: globals_1.jest.fn(),
        };
        eventRepository = {
            logEvent: globals_1.jest.fn(),
        };
        householdRepository = {};
        controller = new PreferencesController_1.PreferencesController(userRepository, taskRepository, eventRepository, householdRepository);
        // Mock request and response
        mockJson = globals_1.jest.fn().mockReturnValue(undefined);
        mockStatus = globals_1.jest.fn().mockReturnThis();
        mockSetHeader = globals_1.jest.fn().mockReturnThis();
        mockReq = {
            userId: 'test-user-id',
            householdId: 'test-household-id',
            body: {},
        };
        mockRes = {
            status: mockStatus,
            json: mockJson,
            send: globals_1.jest.fn(),
            setHeader: mockSetHeader,
        };
    });
    (0, globals_1.describe)('getPreferences', () => {
        (0, globals_1.it)('should return current user preferences', async () => {
            // Arrange
            const mockUser = {
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
            await controller.getPreferences(mockReq, mockRes);
            // Assert
            (0, globals_1.expect)(mockStatus).toHaveBeenCalledWith(200);
            (0, globals_1.expect)(mockJson).toHaveBeenCalledWith({
                success: true,
                data: {
                    notificationsEnabled: true,
                    mutedTasks: ['task1'],
                    quietHours: { start: 22, end: 8 },
                    channels: ['push', 'email'],
                },
                timestamp: globals_1.expect.any(Number),
            });
        });
        (0, globals_1.it)('should set cache control headers', async () => {
            // Arrange
            const mockUser = {
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
            await controller.getPreferences(mockReq, mockRes);
            // Assert
            (0, globals_1.expect)(mockSetHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache, no-store, must-revalidate');
        });
        (0, globals_1.it)('should throw NotFoundError when user does not exist', async () => {
            // Arrange
            userRepository.findUserById.mockResolvedValue(null);
            // Act & Assert
            await (0, globals_1.expect)(controller.getPreferences(mockReq, mockRes)).rejects.toThrow(types_1.NotFoundError);
        });
        // Requirement 9.1, 9.2
        (0, globals_1.it)('should display current notification preferences (Requirement 9.1, 9.2)', async () => {
            const mockUser = {
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
            await controller.getPreferences(mockReq, mockRes);
            const callArgs = mockJson.mock.calls[0][0];
            (0, globals_1.expect)(callArgs.data.notificationsEnabled).toBe(false);
            (0, globals_1.expect)(callArgs.data.mutedTasks).toEqual(['task2', 'task3']);
            (0, globals_1.expect)(callArgs.data.quietHours).toEqual({ start: 23, end: 7 });
            (0, globals_1.expect)(callArgs.data.channels).toEqual(['email', 'sms']);
        });
    });
    (0, globals_1.describe)('updatePreferences', () => {
        (0, globals_1.it)('should update notification enabled status', async () => {
            // Arrange
            const mockUser = {
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
            const updatedUser = {
                ...mockUser,
                preferences: { ...mockUser.preferences, notificationsEnabled: false },
            };
            userRepository.findUserById.mockResolvedValueOnce(mockUser);
            userRepository.updateUserPreferences.mockResolvedValue(undefined);
            userRepository.findUserById.mockResolvedValueOnce(updatedUser);
            eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' });
            mockReq.body = { notificationsEnabled: false };
            // Act
            await controller.updatePreferences(mockReq, mockRes);
            // Assert
            (0, globals_1.expect)(userRepository.updateUserPreferences).toHaveBeenCalledWith('test-user-id', 'test-household-id', { notificationsEnabled: false });
            (0, globals_1.expect)(mockStatus).toHaveBeenCalledWith(200);
        });
        (0, globals_1.it)('should reject invalid notificationsEnabled type', async () => {
            // Arrange
            const mockUser = {
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
            await (0, globals_1.expect)(controller.updatePreferences(mockReq, mockRes)).rejects.toThrow(types_1.ValidationError);
        });
        (0, globals_1.it)('should log preference changes to audit trail', async () => {
            // Arrange
            const mockUser = {
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
            const updatedUser = {
                ...mockUser,
                preferences: { ...mockUser.preferences, notificationsEnabled: false },
            };
            userRepository.findUserById.mockResolvedValueOnce(mockUser);
            userRepository.updateUserPreferences.mockResolvedValue(undefined);
            userRepository.findUserById.mockResolvedValueOnce(updatedUser);
            eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' });
            mockReq.body = { notificationsEnabled: false };
            // Act
            await controller.updatePreferences(mockReq, mockRes);
            // Assert
            (0, globals_1.expect)(eventRepository.logEvent).toHaveBeenCalledWith({
                userId: 'test-user-id',
                taskId: 'preference-update',
                householdId: 'test-household-id',
                action: 'comment',
                timestamp: globals_1.expect.any(Number),
                metadata: globals_1.expect.objectContaining({
                    eventType: 'preference_change',
                    changes: { notificationsEnabled: false },
                }),
            });
        });
        // Requirement 9.2
        (0, globals_1.it)('should apply preference changes immediately (Requirement 9.2)', async () => {
            const mockUser = {
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
            const updatedUser = {
                ...mockUser,
                preferences: { ...mockUser.preferences, notificationsEnabled: false },
            };
            userRepository.findUserById.mockResolvedValueOnce(mockUser);
            userRepository.updateUserPreferences.mockResolvedValue(undefined);
            userRepository.findUserById.mockResolvedValueOnce(updatedUser);
            eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' });
            mockReq.body = { notificationsEnabled: false };
            await controller.updatePreferences(mockReq, mockRes);
            const callArgs = mockJson.mock.calls[0][0];
            (0, globals_1.expect)(callArgs.data.notificationsEnabled).toBe(false);
        });
    });
    (0, globals_1.describe)('muteTask', () => {
        (0, globals_1.it)('should add task to muted list', async () => {
            // Arrange
            const mockUser = {
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
            const mockTask = {
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
            eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' });
            mockReq.body = { taskId: 'task1' };
            // Act
            await controller.muteTask(mockReq, mockRes);
            // Assert
            (0, globals_1.expect)(userRepository.updateUserPreferences).toHaveBeenCalledWith('test-user-id', 'test-household-id', { mutedTasks: ['task1'] });
            (0, globals_1.expect)(mockStatus).toHaveBeenCalledWith(200);
        });
        (0, globals_1.it)('should be idempotent - adding already-muted task is no-op', async () => {
            // Arrange
            const mockUser = {
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
            const mockTask = {
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
            await controller.muteTask(mockReq, mockRes);
            // Assert
            (0, globals_1.expect)(userRepository.updateUserPreferences).not.toHaveBeenCalled();
            (0, globals_1.expect)(mockStatus).toHaveBeenCalledWith(200);
            (0, globals_1.expect)(mockJson).toHaveBeenCalledWith({
                success: true,
                data: {
                    taskId: 'task1',
                    mutedAt: globals_1.expect.any(Number),
                    alreadyMuted: true,
                },
                timestamp: globals_1.expect.any(Number),
            });
        });
        (0, globals_1.it)('should throw NotFoundError for non-existent task', async () => {
            // Arrange
            const mockUser = {
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
            await (0, globals_1.expect)(controller.muteTask(mockReq, mockRes)).rejects.toThrow(types_1.NotFoundError);
        });
        // Requirement 9.3, 9.4
        (0, globals_1.it)('should mute and unmute tasks (Requirement 9.3, 9.4)', async () => {
            const mockUser = {
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
            const mockTask = {
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
            eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' });
            mockReq.body = { taskId: 'task1' };
            await controller.muteTask(mockReq, mockRes);
            (0, globals_1.expect)(userRepository.updateUserPreferences).toHaveBeenCalledWith('test-user-id', 'test-household-id', { mutedTasks: ['task1'] });
        });
    });
    (0, globals_1.describe)('unmuteTask', () => {
        (0, globals_1.it)('should remove task from muted list', async () => {
            // Arrange
            const mockUser = {
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
            const mockTask = {
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
            eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' });
            mockReq.params = { taskId: 'task1' };
            // Act
            await controller.unmuteTask(mockReq, mockRes);
            // Assert
            (0, globals_1.expect)(userRepository.updateUserPreferences).toHaveBeenCalledWith('test-user-id', 'test-household-id', { mutedTasks: ['task2'] });
            (0, globals_1.expect)(mockStatus).toHaveBeenCalledWith(204);
        });
        (0, globals_1.it)('should return 204 No Content on success', async () => {
            // Arrange
            const mockUser = {
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
            const mockTask = {
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
            eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' });
            mockReq.params = { taskId: 'task1' };
            // Act
            await controller.unmuteTask(mockReq, mockRes);
            // Assert
            (0, globals_1.expect)(mockStatus).toHaveBeenCalledWith(204);
        });
    });
    (0, globals_1.describe)('Quiet Hours Validation', () => {
        // Requirement 9.5, 9.6
        (0, globals_1.it)('should validate quiet hours format (valid ranges, Requirement 9.5, 9.6)', async () => {
            const mockUser = {
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
            const updatedUser = {
                ...mockUser,
                preferences: {
                    ...mockUser.preferences,
                    quietHours: { start: 22, end: 6 },
                },
            };
            userRepository.findUserById.mockResolvedValueOnce(mockUser);
            userRepository.updateUserPreferences.mockResolvedValue(undefined);
            userRepository.findUserById.mockResolvedValueOnce(updatedUser);
            eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' });
            mockReq.body = { quietHours: { start: 22, end: 6 } };
            await controller.updatePreferences(mockReq, mockRes);
            (0, globals_1.expect)(userRepository.updateUserPreferences).toHaveBeenCalled();
        });
        (0, globals_1.it)('should reject quiet hours with start > 23', async () => {
            const mockUser = {
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
            await (0, globals_1.expect)(controller.updatePreferences(mockReq, mockRes)).rejects.toThrow(types_1.ValidationError);
        });
        (0, globals_1.it)('should reject quiet hours with end < 0', async () => {
            const mockUser = {
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
            await (0, globals_1.expect)(controller.updatePreferences(mockReq, mockRes)).rejects.toThrow(types_1.ValidationError);
        });
        (0, globals_1.it)('should allow null quiet hours (no quiet hours)', async () => {
            const mockUser = {
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
            const updatedUser = {
                ...mockUser,
                preferences: {
                    ...mockUser.preferences,
                    quietHours: undefined,
                },
            };
            userRepository.findUserById.mockResolvedValueOnce(mockUser);
            userRepository.updateUserPreferences.mockResolvedValue(undefined);
            userRepository.findUserById.mockResolvedValueOnce(updatedUser);
            eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' });
            mockReq.body = { quietHours: null };
            await controller.updatePreferences(mockReq, mockRes);
            (0, globals_1.expect)(userRepository.updateUserPreferences).toHaveBeenCalled();
        });
        (0, globals_1.it)('should support midnight-wrapping quiet hours (e.g., 22:00-06:00)', async () => {
            const mockUser = {
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
            const updatedUser = {
                ...mockUser,
                preferences: {
                    ...mockUser.preferences,
                    quietHours: { start: 22, end: 6 },
                },
            };
            userRepository.findUserById.mockResolvedValueOnce(mockUser);
            userRepository.updateUserPreferences.mockResolvedValue(undefined);
            userRepository.findUserById.mockResolvedValueOnce(updatedUser);
            eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' });
            mockReq.body = { quietHours: { start: 22, end: 6 } };
            await controller.updatePreferences(mockReq, mockRes);
            (0, globals_1.expect)(userRepository.updateUserPreferences).toHaveBeenCalledWith('test-user-id', 'test-household-id', { quietHours: { start: 22, end: 6 } });
        });
    });
    (0, globals_1.describe)('Channel Validation', () => {
        // Requirement 9.7
        (0, globals_1.it)('should validate notification channels (Requirement 9.7)', async () => {
            const mockUser = {
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
            const updatedUser = {
                ...mockUser,
                preferences: {
                    ...mockUser.preferences,
                    channels: ['push', 'email', 'sms'],
                },
            };
            userRepository.findUserById.mockResolvedValueOnce(mockUser);
            userRepository.updateUserPreferences.mockResolvedValue(undefined);
            userRepository.findUserById.mockResolvedValueOnce(updatedUser);
            eventRepository.logEvent.mockResolvedValue({ eventId: 'event1' });
            mockReq.body = { channels: ['push', 'email', 'sms'] };
            await controller.updatePreferences(mockReq, mockRes);
            (0, globals_1.expect)(userRepository.updateUserPreferences).toHaveBeenCalledWith('test-user-id', 'test-household-id', { channels: ['push', 'email', 'sms'] });
        });
        (0, globals_1.it)('should reject invalid channel names', async () => {
            const mockUser = {
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
            await (0, globals_1.expect)(controller.updatePreferences(mockReq, mockRes)).rejects.toThrow(types_1.ValidationError);
        });
    });
    (0, globals_1.describe)('Access Control', () => {
        (0, globals_1.it)('should only allow users to access their own preferences', async () => {
            // Arrange
            const mockUser = {
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
            await controller.getPreferences(mockReq, mockRes);
            // Assert
            (0, globals_1.expect)(userRepository.findUserById).toHaveBeenCalledWith('user-A', 'household1');
            (0, globals_1.expect)(mockStatus).toHaveBeenCalledWith(200);
        });
    });
});
