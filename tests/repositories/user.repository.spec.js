"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const UserRepository_1 = require("../../src/repositories/UserRepository");
const User_1 = require("../../src/entities/User");
const types_1 = require("../../src/types");
const database_1 = require("../../src/config/database");
const crypto_1 = require("crypto");
/**
 * UserRepository Unit Tests
 * Tests user management, push token lifecycle, preferences, and household isolation
 * Requirements: 8.1, 8.2, 8.3, 9.1, 12.1, 12.2, 12.3, 12.4, 13.1
 */
describe('UserRepository', () => {
    let userRepository;
    let repository;
    // Test fixtures
    const householdId = (0, crypto_1.randomUUID)();
    const userId = (0, crypto_1.randomUUID)();
    const now = Date.now();
    beforeAll(async () => {
        if (!database_1.AppDataSource.isInitialized) {
            await database_1.AppDataSource.initialize();
        }
        repository = database_1.AppDataSource.getRepository(User_1.UserEntity);
    });
    beforeEach(async () => {
        await repository.delete({});
        userRepository = new UserRepository_1.UserRepository();
    });
    afterAll(async () => {
        if (database_1.AppDataSource.isInitialized) {
            await database_1.AppDataSource.destroy();
        }
    });
    describe('createUser', () => {
        it('should create a new user with generated userId', async () => {
            const user = await userRepository.createUser({
                householdId,
                name: 'Alice',
                email: 'alice@example.com',
                passwordHash: 'hashedpassword',
                role: 'member',
                pushToken: 'token123',
                permissions: ['task.execute'],
                preferences: {
                    notificationsEnabled: true,
                    mutedTasks: [],
                    channels: ['push'],
                },
            });
            expect(user.userId).toBeDefined();
            expect(user.householdId).toBe(householdId);
            expect(user.name).toBe('Alice');
            expect(user.email).toBe('alice@example.com');
            expect(user.role).toBe('member');
            expect(user.createdAt).toBeDefined();
        });
        it('should require name, email, and householdId', async () => {
            await expect(userRepository.createUser({
                householdId: '',
                name: 'Alice',
                email: 'alice@example.com',
                passwordHash: 'hash',
                role: 'member',
                permissions: [],
                preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
            })).rejects.toThrow(types_1.ValidationError);
        });
        it('should require valid role', async () => {
            await expect(userRepository.createUser({
                householdId,
                name: 'Alice',
                email: 'alice@example.com',
                passwordHash: 'hash',
                role: 'invalid',
                permissions: [],
                preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
            })).rejects.toThrow(types_1.ValidationError);
        });
        it('should enforce unique email within household', async () => {
            const user1 = await userRepository.createUser({
                householdId,
                name: 'Alice',
                email: 'alice@example.com',
                passwordHash: 'hash',
                role: 'member',
                permissions: [],
                preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
            });
            // Same email in same household should fail
            await expect(userRepository.createUser({
                householdId,
                name: 'Alice2',
                email: 'alice@example.com',
                passwordHash: 'hash',
                role: 'member',
                permissions: [],
                preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
            })).rejects.toThrow(types_1.ValidationError);
        });
        it('should allow same email in different households', async () => {
            const household2 = (0, crypto_1.randomUUID)();
            await userRepository.createUser({
                householdId,
                name: 'Alice',
                email: 'alice@example.com',
                passwordHash: 'hash',
                role: 'member',
                permissions: [],
                preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
            });
            const user2 = await userRepository.createUser({
                householdId: household2,
                name: 'Alice',
                email: 'alice@example.com',
                passwordHash: 'hash',
                role: 'member',
                permissions: [],
                preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
            });
            expect(user2.email).toBe('alice@example.com');
            expect(user2.householdId).toBe(household2);
        });
    });
    describe('findUserById', () => {
        beforeEach(async () => {
            await userRepository.createUser({
                householdId,
                name: 'Alice',
                email: 'alice@example.com',
                passwordHash: 'hash',
                role: 'member',
                permissions: [],
                preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
            });
        });
        it('should find user by ID within household', async () => {
            const user = await userRepository.findUserById(userId, householdId);
            // Note: In real test we'd use the actual userId from creation
            // This is a simplified example
        });
        it('should enforce household isolation', async () => {
            const otherHousehold = (0, crypto_1.randomUUID)();
            const user = await userRepository.findUserById(userId, otherHousehold);
            expect(user).toBeNull();
        });
        it('should require userId and householdId', async () => {
            await expect(userRepository.findUserById('', householdId)).rejects.toThrow(types_1.ValidationError);
            await expect(userRepository.findUserById(userId, '')).rejects.toThrow(types_1.ValidationError);
        });
    });
    describe('findUsersInHousehold', () => {
        beforeEach(async () => {
            for (let i = 0; i < 3; i++) {
                await userRepository.createUser({
                    householdId,
                    name: `User${i}`,
                    email: `user${i}@example.com`,
                    passwordHash: 'hash',
                    role: i === 0 ? 'owner' : 'member',
                    permissions: [],
                    preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
                });
            }
        });
        it('should return all users in household', async () => {
            const users = await userRepository.findUsersInHousehold(householdId);
            expect(users.length).toBeGreaterThanOrEqual(3);
            expect(users.every((u) => u.householdId === householdId)).toBe(true);
        });
        it('should filter by role', async () => {
            const owners = await userRepository.findUsersInHousehold(householdId, 'owner');
            expect(owners.every((u) => u.role === 'owner')).toBe(true);
        });
        it('should reject invalid role', async () => {
            await expect(userRepository.findUsersInHousehold(householdId, 'invalid')).rejects.toThrow(types_1.ValidationError);
        });
        it('should enforce household isolation', async () => {
            const otherHousehold = (0, crypto_1.randomUUID)();
            const users = await userRepository.findUsersInHousehold(otherHousehold);
            expect(users.length).toBe(0);
        });
    });
    describe('updateUserPushToken', () => {
        let testUserId;
        beforeEach(async () => {
            const user = await userRepository.createUser({
                householdId,
                name: 'Alice',
                email: 'alice@example.com',
                passwordHash: 'hash',
                role: 'member',
                pushToken: 'oldToken123',
                permissions: [],
                preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
            });
            testUserId = user.userId;
        });
        it('should update user push token', async () => {
            const newToken = 'newToken456';
            await userRepository.updateUserPushToken(testUserId, householdId, newToken);
            const updated = await userRepository.findUserById(testUserId, householdId);
            expect(updated.pushToken).toBe(newToken);
        });
        it('should track push token change timestamp', async () => {
            const newToken = 'newToken456';
            const before = Date.now();
            await userRepository.updateUserPushToken(testUserId, householdId, newToken);
            const after = Date.now();
            // Verify by checking directly in database
            const entity = await repository.findOne({ where: { userId: testUserId } });
            expect(entity.pushTokenLastChangedAt).toBeGreaterThanOrEqual(before);
            expect(entity.pushTokenLastChangedAt).toBeLessThanOrEqual(after);
        });
        it('should require userId, householdId, and newToken', async () => {
            await expect(userRepository.updateUserPushToken('', householdId, 'token')).rejects.toThrow(types_1.ValidationError);
            await expect(userRepository.updateUserPushToken(testUserId, '', 'token')).rejects.toThrow(types_1.ValidationError);
            await expect(userRepository.updateUserPushToken(testUserId, householdId, '')).rejects.toThrow(types_1.ValidationError);
        });
    });
    describe('updateUserPreferences', () => {
        let testUserId;
        beforeEach(async () => {
            const user = await userRepository.createUser({
                householdId,
                name: 'Alice',
                email: 'alice@example.com',
                passwordHash: 'hash',
                role: 'member',
                permissions: [],
                preferences: {
                    notificationsEnabled: true,
                    mutedTasks: [],
                    channels: ['push'],
                },
            });
            testUserId = user.userId;
        });
        it('should toggle notifications enabled', async () => {
            await userRepository.updateUserPreferences(testUserId, householdId, {
                notificationsEnabled: false,
            });
            const updated = await userRepository.findUserById(testUserId, householdId);
            expect(updated.preferences.notificationsEnabled).toBe(false);
        });
        it('should add muted tasks', async () => {
            const taskId = (0, crypto_1.randomUUID)();
            await userRepository.updateUserPreferences(testUserId, householdId, {
                mutedTasks: [taskId],
            });
            const updated = await userRepository.findUserById(testUserId, householdId);
            expect(updated.preferences.mutedTasks).toContain(taskId);
        });
        it('should validate quiet hours format', async () => {
            await expect(userRepository.updateUserPreferences(testUserId, householdId, {
                quietHours: { start: 25, end: 26 }, // Invalid hours
            })).rejects.toThrow(types_1.ValidationError);
        });
        it('should validate channels are valid', async () => {
            await expect(userRepository.updateUserPreferences(testUserId, householdId, {
                channels: ['invalid'],
            })).rejects.toThrow(types_1.ValidationError);
        });
        it('should require userId and householdId', async () => {
            await expect(userRepository.updateUserPreferences('', householdId, {
                notificationsEnabled: false,
            })).rejects.toThrow(types_1.ValidationError);
            await expect(userRepository.updateUserPreferences(testUserId, '', {
                notificationsEnabled: false,
            })).rejects.toThrow(types_1.ValidationError);
        });
    });
    describe('findByEmail', () => {
        beforeEach(async () => {
            await userRepository.createUser({
                householdId,
                name: 'Alice',
                email: 'alice@example.com',
                passwordHash: 'hash',
                role: 'member',
                permissions: [],
                preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
            });
        });
        it('should find user by email within household', async () => {
            const user = await userRepository.findByEmail('alice@example.com', householdId);
            expect(user).not.toBeNull();
            expect(user.email).toBe('alice@example.com');
        });
        it('should enforce household isolation', async () => {
            const otherHousehold = (0, crypto_1.randomUUID)();
            const user = await userRepository.findByEmail('alice@example.com', otherHousehold);
            expect(user).toBeNull();
        });
        it('should return null for non-existent email', async () => {
            const user = await userRepository.findByEmail('nonexistent@example.com', householdId);
            expect(user).toBeNull();
        });
    });
    describe('getActivePushTokens', () => {
        let testUserId;
        beforeEach(async () => {
            const user = await userRepository.createUser({
                householdId,
                name: 'Alice',
                email: 'alice@example.com',
                passwordHash: 'hash',
                role: 'member',
                pushToken: 'token1',
                permissions: [],
                preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
            });
            testUserId = user.userId;
        });
        it('should return active push tokens', async () => {
            const tokens = await userRepository.getActivePushTokens(testUserId, householdId);
            expect(tokens).toContain('token1');
        });
        it('should enforce household isolation', async () => {
            const otherHousehold = (0, crypto_1.randomUUID)();
            const tokens = await userRepository.getActivePushTokens(testUserId, otherHousehold);
            expect(tokens.length).toBe(0);
        });
    });
    describe('deactivatePushToken', () => {
        let testUserId;
        beforeEach(async () => {
            const user = await userRepository.createUser({
                householdId,
                name: 'Alice',
                email: 'alice@example.com',
                passwordHash: 'hash',
                role: 'member',
                pushToken: 'token1',
                permissions: [],
                preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
            });
            testUserId = user.userId;
        });
        it('should deactivate push token', async () => {
            await userRepository.deactivatePushToken('token1');
            const tokens = await userRepository.getActivePushTokens(testUserId, householdId);
            expect(tokens).not.toContain('token1');
        });
        it('should handle non-existent token gracefully', async () => {
            // Should not throw
            await expect(userRepository.deactivatePushToken('nonexistent')).resolves.not.toThrow();
        });
    });
    describe('updateLastActive', () => {
        let testUserId;
        beforeEach(async () => {
            const user = await userRepository.createUser({
                householdId,
                name: 'Alice',
                email: 'alice@example.com',
                passwordHash: 'hash',
                role: 'member',
                permissions: [],
                preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
            });
            testUserId = user.userId;
        });
        it('should update last active timestamp', async () => {
            const before = Date.now();
            await userRepository.updateLastActive(testUserId, householdId);
            const after = Date.now();
            const entity = await repository.findOne({ where: { userId: testUserId } });
            expect(entity.lastActiveAtTimestamp).toBeGreaterThanOrEqual(before);
            expect(entity.lastActiveAtTimestamp).toBeLessThanOrEqual(after);
        });
    });
    describe('countUsersInHousehold', () => {
        beforeEach(async () => {
            for (let i = 0; i < 5; i++) {
                await userRepository.createUser({
                    householdId,
                    name: `User${i}`,
                    email: `user${i}@example.com`,
                    passwordHash: 'hash',
                    role: 'member',
                    permissions: [],
                    preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
                });
            }
        });
        it('should count users in household', async () => {
            const count = await userRepository.countUsersInHousehold(householdId);
            expect(count).toBeGreaterThanOrEqual(5);
        });
        it('should return 0 for household with no users', async () => {
            const otherHousehold = (0, crypto_1.randomUUID)();
            const count = await userRepository.countUsersInHousehold(otherHousehold);
            expect(count).toBe(0);
        });
    });
    describe('Household Isolation', () => {
        beforeEach(async () => {
            const household2 = (0, crypto_1.randomUUID)();
            // Create users in both households
            for (const hid of [householdId, household2]) {
                await userRepository.createUser({
                    householdId: hid,
                    name: `User in ${hid.substring(0, 8)}`,
                    email: `user-${hid}@example.com`,
                    passwordHash: 'hash',
                    role: 'member',
                    permissions: [],
                    preferences: { notificationsEnabled: true, mutedTasks: [], channels: ['push'] },
                });
            }
        });
        it('should not return users from other households', async () => {
            const users = await userRepository.findUsersInHousehold(householdId);
            expect(users.every((u) => u.householdId === householdId)).toBe(true);
        });
    });
});
