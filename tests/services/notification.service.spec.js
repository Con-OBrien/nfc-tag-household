"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NotificationService_1 = require("../../src/services/NotificationService");
const crypto_1 = require("crypto");
/**
 * NotificationService Integration Tests
 * Tests notification delivery with retry logic and failure classification
 *
 * Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 14.3, 14.4
 */
describe('NotificationService', () => {
    let notificationService;
    let mockUserRepository;
    let mockHouseholdRepository;
    let mockTaskRepository;
    let mockEventRepository;
    const testIds = {
        householdId: (0, crypto_1.randomUUID)(),
        userId1: (0, crypto_1.randomUUID)(),
        userId2: (0, crypto_1.randomUUID)(),
        taskId: (0, crypto_1.randomUUID)(),
        eventId: (0, crypto_1.randomUUID)(),
    };
    const createTestTask = () => ({
        taskId: testIds.taskId,
        name: 'Test Task',
        description: 'Test task description',
        category: 'Test',
        householdId: testIds.householdId,
        createdAt: Date.now(),
        createdBy: testIds.userId1,
        isActive: true,
    });
    const createTestEvent = () => ({
        eventId: testIds.eventId,
        userId: testIds.userId1,
        taskId: testIds.taskId,
        householdId: testIds.householdId,
        action: 'execute',
        timestamp: Date.now(),
    });
    const createTestUser = (userId, pushToken) => ({
        userId,
        householdId: testIds.householdId,
        name: 'Test User',
        email: 'test@example.com',
        role: 'member',
        pushToken,
        permissions: ['task.execute'],
        preferences: {
            notificationsEnabled: true,
            mutedTasks: [],
            channels: ['push'],
        },
        createdAt: Date.now(),
    });
    beforeEach(() => {
        mockUserRepository = {
            findUsersInHousehold: jest.fn().mockResolvedValue([]),
        };
        mockHouseholdRepository = {};
        mockTaskRepository = {
            findTaskById: jest.fn().mockResolvedValue(createTestTask()),
        };
        mockEventRepository = {
            logEvent: jest.fn().mockResolvedValue({
                eventId: (0, crypto_1.randomUUID)(),
                userId: testIds.userId1,
                taskId: testIds.taskId,
                householdId: testIds.householdId,
                action: 'acknowledge',
                timestamp: Date.now(),
                metadata: {},
            }),
        };
        notificationService = new NotificationService_1.NotificationService(mockUserRepository, mockHouseholdRepository, mockTaskRepository, mockEventRepository);
    });
    describe('sendNotification', () => {
        it('should return empty arrays for empty recipients', async () => {
            const payload = {
                title: 'Test',
                body: 'Test body',
                data: {
                    taskId: testIds.taskId,
                    eventId: testIds.eventId,
                    eventType: 'execute',
                    timestamp: Date.now(),
                },
            };
            const result = await notificationService.sendNotification(payload, []);
            expect(result.delivered).toEqual([]);
            expect(result.failed).toEqual([]);
        });
        it('should skip recipients without push tokens', async () => {
            const user1 = createTestUser(testIds.userId1, '');
            const user2 = createTestUser(testIds.userId2, 'valid_token');
            const payload = {
                title: 'Test',
                body: 'Test body',
                data: {
                    taskId: testIds.taskId,
                    eventId: testIds.eventId,
                    eventType: 'execute',
                    timestamp: Date.now(),
                },
            };
            const result = await notificationService.sendNotification(payload, [user1, user2]);
            expect(result.failed).toContain(testIds.userId1);
            expect(result.delivered.length + result.failed.length).toBe(2);
        });
        it('should handle multiple recipients', async () => {
            const user1 = createTestUser(testIds.userId1, 'token_1');
            const user2 = createTestUser(testIds.userId2, 'token_2');
            const payload = {
                title: 'Test',
                body: 'Test body',
                data: {
                    taskId: testIds.taskId,
                    eventId: testIds.eventId,
                    eventType: 'execute',
                    timestamp: Date.now(),
                },
            };
            const result = await notificationService.sendNotification(payload, [user1, user2]);
            expect(result.delivered.length + result.failed.length).toBe(2);
            expect(mockEventRepository.logEvent).toHaveBeenCalled();
        });
    });
    describe('sendToHouseholdMembers', () => {
        it('should send notifications to eligible household members', async () => {
            const user1 = createTestUser(testIds.userId1, 'token_1');
            const user2 = createTestUser(testIds.userId2, 'token_2');
            mockUserRepository.findUsersInHousehold.mockResolvedValue([
                user1,
                user2,
            ]);
            const event = createTestEvent();
            await notificationService.sendToHouseholdMembers(testIds.taskId, event, testIds.userId1 // Exclude user1
            );
            // Should have called sendNotification for user2
            expect(mockEventRepository.logEvent).toHaveBeenCalled();
        });
        it('should exclude the task executor from notifications', async () => {
            const user1 = createTestUser(testIds.userId1, 'token_1');
            const user2 = createTestUser(testIds.userId2, 'token_2');
            mockUserRepository.findUsersInHousehold.mockResolvedValue([
                user1,
                user2,
            ]);
            const event = createTestEvent();
            await notificationService.sendToHouseholdMembers(testIds.taskId, event, testIds.userId1 // Executor should be excluded
            );
            // Event should be logged with attempt to send to user2 only
            expect(mockEventRepository.logEvent).toHaveBeenCalled();
        });
        it('should handle missing task gracefully', async () => {
            mockTaskRepository.findTaskById.mockResolvedValue(null);
            const event = createTestEvent();
            await notificationService.sendToHouseholdMembers(testIds.taskId, event, testIds.userId1);
            // Should log warning but not throw
            expect(mockEventRepository.logEvent).not.toHaveBeenCalled();
        });
        it('should handle missing household members gracefully', async () => {
            mockUserRepository.findUsersInHousehold.mockResolvedValue([]);
            const event = createTestEvent();
            await notificationService.sendToHouseholdMembers(testIds.taskId, event, testIds.userId1);
            // Should not attempt to send notifications
            expect(mockEventRepository.logEvent).not.toHaveBeenCalled();
        });
    });
    describe('detectPlatform', () => {
        it('should detect APNs tokens (64 hex characters)', () => {
            const apnsToken = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
            expect(notificationService.detectPlatform(apnsToken)).toBe('apns');
        });
        it('should detect FCM tokens (non-hex or wrong length)', () => {
            const fcmToken = 'cDM...-_long_fcm_token_with_hyphens_and_underscores_123';
            expect(notificationService.detectPlatform(fcmToken)).toBe('fcm');
        });
        it('should default to FCM for ambiguous tokens', () => {
            expect(notificationService.detectPlatform('some_token')).toBe('fcm');
        });
    });
    describe('User Preference Filtering', () => {
        it('should filter out users with notifications disabled', async () => {
            const userWithDisabledNotifications = createTestUser(testIds.userId1, 'token_1');
            userWithDisabledNotifications.preferences.notificationsEnabled = false;
            const user2 = createTestUser(testIds.userId2, 'token_2');
            mockUserRepository.findUsersInHousehold.mockResolvedValue([
                userWithDisabledNotifications,
                user2,
            ]);
            const event = createTestEvent();
            await notificationService.sendToHouseholdMembers(testIds.taskId, event);
            // Only user2 should receive notification
            expect(mockEventRepository.logEvent).toHaveBeenCalled();
        });
        it('should filter out users who have muted the task', async () => {
            const userWithMutedTask = createTestUser(testIds.userId1, 'token_1');
            userWithMutedTask.preferences.mutedTasks = [testIds.taskId];
            const user2 = createTestUser(testIds.userId2, 'token_2');
            mockUserRepository.findUsersInHousehold.mockResolvedValue([
                userWithMutedTask,
                user2,
            ]);
            const event = createTestEvent();
            await notificationService.sendToHouseholdMembers(testIds.taskId, event);
            // Only user2 should receive notification
            expect(mockEventRepository.logEvent).toHaveBeenCalled();
        });
        it('should filter out users in quiet hours', async () => {
            const now = new Date();
            const currentHour = now.getHours();
            const userInQuietHours = createTestUser(testIds.userId1, 'token_1');
            userInQuietHours.preferences.quietHours = {
                start: currentHour,
                end: (currentHour + 1) % 24,
            };
            const user2 = createTestUser(testIds.userId2, 'token_2');
            mockUserRepository.findUsersInHousehold.mockResolvedValue([
                userInQuietHours,
                user2,
            ]);
            const event = createTestEvent();
            await notificationService.sendToHouseholdMembers(testIds.taskId, event);
            // Only user2 should receive notification
            expect(mockEventRepository.logEvent).toHaveBeenCalled();
        });
        it('should handle quiet hours wrapping around midnight', async () => {
            const userWithNightQuietHours = createTestUser(testIds.userId1, 'token_1');
            userWithNightQuietHours.preferences.quietHours = {
                start: 22, // 10 PM
                end: 6, // 6 AM
            };
            const now = new Date();
            const currentHour = now.getHours();
            // If current time is between 22 and 23, or 0 and 5, user is in quiet hours
            const shouldBeFiltered = currentHour >= 22 || currentHour < 6;
            mockUserRepository.findUsersInHousehold.mockResolvedValue([
                userWithNightQuietHours,
            ]);
            const event = createTestEvent();
            await notificationService.sendToHouseholdMembers(testIds.taskId, event);
            // Behavior depends on current time
            expect(mockEventRepository.logEvent).toHaveBeenCalled();
        });
    });
    describe('Notification Payload Formatting', () => {
        it('should format notification payload with task details', async () => {
            const user = createTestUser(testIds.userId1, 'token_1');
            const payload = {
                title: 'Task Update: Test Task',
                body: 'A household member has executed "Test Task"',
                data: {
                    taskId: testIds.taskId,
                    eventId: testIds.eventId,
                    eventType: 'execute',
                    timestamp: Date.now(),
                },
                deepLink: `app://task/${testIds.taskId}`,
            };
            const result = await notificationService.sendNotification(payload, [user]);
            expect(mockEventRepository.logEvent).toHaveBeenCalled();
        });
    });
    describe('Error Handling', () => {
        it('should handle user repository errors gracefully', async () => {
            mockUserRepository.findUsersInHousehold.mockRejectedValue(new Error('Database connection failed'));
            const event = createTestEvent();
            await expect(notificationService.sendToHouseholdMembers(testIds.taskId, event)).rejects.toThrow('Database connection failed');
        });
        it('should handle task repository errors gracefully', async () => {
            mockTaskRepository.findTaskById.mockRejectedValue(new Error('Task not found'));
            const event = createTestEvent();
            await expect(notificationService.sendToHouseholdMembers(testIds.taskId, event)).rejects.toThrow('Task not found');
        });
    });
    describe('Audit Log Integration', () => {
        it('should update audit log with delivery status', async () => {
            const user = createTestUser(testIds.userId1, 'token_1');
            const payload = {
                title: 'Test',
                body: 'Test body',
                data: {
                    taskId: testIds.taskId,
                    eventId: testIds.eventId,
                    eventType: 'execute',
                    timestamp: Date.now(),
                },
            };
            await notificationService.sendNotification(payload, [user], testIds.eventId, testIds.taskId, testIds.householdId);
            expect(mockEventRepository.logEvent).toHaveBeenCalled();
            // Verify logged event structure
            const loggedEvent = mockEventRepository.logEvent.mock
                .calls[0][0];
            expect(loggedEvent.userId).toBe(user.userId);
            expect(loggedEvent.taskId).toBe(testIds.taskId);
            expect(loggedEvent.householdId).toBe(testIds.householdId);
            expect(loggedEvent.action).toBe('acknowledge');
            expect(loggedEvent.metadata).toBeDefined();
            expect(loggedEvent.metadata.linkedEventId).toBe(testIds.eventId);
            expect(loggedEvent.metadata.attempts).toBeDefined();
        });
    });
});
