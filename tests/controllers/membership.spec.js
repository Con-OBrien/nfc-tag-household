"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const MembershipController_1 = require("../../src/controllers/MembershipController");
const HouseholdRepository_1 = require("../../src/repositories/HouseholdRepository");
const UserRepository_1 = require("../../src/repositories/UserRepository");
(0, globals_1.describe)('MembershipController', () => {
    let controller;
    let mockReq;
    let mockRes;
    let mockNext;
    let householdRepositorySpy;
    let userRepositorySpy;
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
        controller = new MembershipController_1.MembershipController();
        mockReq = {
            params: {},
            body: {},
            headers: {},
            userId: 'owner-user-id',
        };
        mockRes = {
            status: globals_1.jest.fn().mockReturnThis(),
            json: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis(),
        };
        mockNext = globals_1.jest.fn();
    });
    (0, globals_1.afterEach)(() => {
        if (householdRepositorySpy) {
            householdRepositorySpy.mockRestore();
        }
        if (userRepositorySpy) {
            userRepositorySpy.mockRestore();
        }
    });
    (0, globals_1.describe)('inviteUser', () => {
        (0, globals_1.it)('should invite a user with default member role', async () => {
            mockReq.params = { householdId: 'household-1' };
            mockReq.body = { email: 'newuser@example.com' };
            const mockHousehold = {
                householdId: 'household-1',
                name: 'Test Household',
                createdAt: Date.now(),
                createdBy: 'owner-user-id',
                members: ['owner-user-id'],
                settings: {
                    defaultNotificationSettings: {},
                    taskCategories: ['Pet Care'],
                },
            };
            const mockNewUser = {
                userId: 'new-user-id',
                householdId: 'household-1',
                name: 'newuser',
                email: 'newuser@example.com',
                role: 'member',
                pushToken: 'token123',
                permissions: ['task.execute'],
                preferences: {
                    notificationsEnabled: true,
                    mutedTasks: [],
                    channels: ['push'],
                },
                createdAt: Date.now(),
            };
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdInfo')
                .mockResolvedValue(mockHousehold);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserInHousehold')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserOwner')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(UserRepository_1.UserRepository.prototype, 'findByEmail')
                .mockResolvedValue(null);
            globals_1.jest
                .spyOn(UserRepository_1.UserRepository.prototype, 'createUser')
                .mockResolvedValue(mockNewUser);
            const testController = new MembershipController_1.MembershipController();
            await testController.inviteUser(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockRes.status).toHaveBeenCalledWith(201);
            (0, globals_1.expect)(mockRes.json).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                success: true,
                data: globals_1.expect.objectContaining({
                    userId: 'new-user-id',
                    email: 'newuser@example.com',
                    role: 'member',
                }),
            }));
        });
        (0, globals_1.it)('should reject invitation from non-owner', async () => {
            mockReq.params = { householdId: 'household-1' };
            mockReq.body = { email: 'newuser@example.com' };
            mockReq.userId = 'member-user-id';
            const mockHousehold = {
                householdId: 'household-1',
                name: 'Test Household',
                createdAt: Date.now(),
                createdBy: 'owner-user-id',
                members: ['owner-user-id', 'member-user-id'],
                settings: {
                    defaultNotificationSettings: {},
                    taskCategories: ['Pet Care'],
                },
            };
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdInfo')
                .mockResolvedValue(mockHousehold);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserInHousehold')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserOwner')
                .mockResolvedValue(false);
            const testController = new MembershipController_1.MembershipController();
            await testController.inviteUser(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockNext).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                code: 'FORBIDDEN',
                statusCode: 403,
            }));
        });
        (0, globals_1.it)('should reject duplicate membership', async () => {
            mockReq.params = { householdId: 'household-1' };
            mockReq.body = { email: 'existing@example.com' };
            const mockHousehold = {
                householdId: 'household-1',
                name: 'Test Household',
                createdAt: Date.now(),
                createdBy: 'owner-user-id',
                members: ['owner-user-id', 'existing-user-id'],
                settings: {
                    defaultNotificationSettings: {},
                    taskCategories: ['Pet Care'],
                },
            };
            const existingUser = {
                userId: 'existing-user-id',
                householdId: 'household-1',
                name: 'Existing User',
                email: 'existing@example.com',
                role: 'member',
                pushToken: 'token123',
                permissions: ['task.execute'],
                preferences: {
                    notificationsEnabled: true,
                    mutedTasks: [],
                    channels: ['push'],
                },
                createdAt: Date.now(),
            };
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdInfo')
                .mockResolvedValue(mockHousehold);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserInHousehold')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserOwner')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(UserRepository_1.UserRepository.prototype, 'findByEmail')
                .mockResolvedValue(existingUser);
            const testController = new MembershipController_1.MembershipController();
            await testController.inviteUser(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockNext).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                code: 'VALIDATION_ERROR',
                statusCode: 400,
            }));
        });
        (0, globals_1.it)('should reject invalid email format', async () => {
            mockReq.params = { householdId: 'household-1' };
            mockReq.body = { email: 'invalid-email' };
            const testController = new MembershipController_1.MembershipController();
            await testController.inviteUser(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockNext).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                code: 'VALIDATION_ERROR',
                statusCode: 400,
                message: 'Invalid email format',
            }));
        });
        (0, globals_1.it)('should require authentication', async () => {
            mockReq.params = { householdId: 'household-1' };
            mockReq.body = { email: 'newuser@example.com' };
            mockReq.userId = undefined;
            const testController = new MembershipController_1.MembershipController();
            await testController.inviteUser(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockNext).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                code: 'VALIDATION_ERROR',
                message: 'User authentication required',
            }));
        });
    });
    (0, globals_1.describe)('updateUserRole', () => {
        (0, globals_1.it)('should promote member to owner', async () => {
            mockReq.params = { householdId: 'household-1', memberId: 'member-to-promote' };
            mockReq.body = { role: 'owner' };
            const mockHousehold = {
                householdId: 'household-1',
                name: 'Test Household',
                createdAt: Date.now(),
                createdBy: 'owner-user-id',
                members: ['owner-user-id', 'member-to-promote'],
                settings: {
                    defaultNotificationSettings: {},
                    taskCategories: ['Pet Care'],
                },
            };
            const memberToPromote = {
                userId: 'member-to-promote',
                householdId: 'household-1',
                name: 'Member To Promote',
                email: 'member@example.com',
                role: 'member',
                pushToken: 'token123',
                permissions: ['task.execute'],
                preferences: {
                    notificationsEnabled: true,
                    mutedTasks: [],
                    channels: ['push'],
                },
                createdAt: Date.now(),
            };
            const promotedMember = {
                ...memberToPromote,
                role: 'owner',
                permissions: ['admin', 'task.execute'],
            };
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdInfo')
                .mockResolvedValue(mockHousehold);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserInHousehold')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserOwner')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(UserRepository_1.UserRepository.prototype, 'findUserById')
                .mockResolvedValueOnce(memberToPromote)
                .mockResolvedValueOnce(promotedMember);
            globals_1.jest
                .spyOn(UserRepository_1.UserRepository.prototype, 'updateUserRole')
                .mockResolvedValue(undefined);
            const testController = new MembershipController_1.MembershipController();
            await testController.updateUserRole(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockRes.json).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                success: true,
                data: globals_1.expect.objectContaining({
                    role: 'owner',
                }),
            }));
        });
        (0, globals_1.it)('should prevent removing last owner', async () => {
            mockReq.params = { householdId: 'household-1', memberId: 'last-owner' };
            mockReq.body = { role: 'member' };
            const mockHousehold = {
                householdId: 'household-1',
                name: 'Test Household',
                createdAt: Date.now(),
                createdBy: 'last-owner',
                members: ['last-owner', 'member-user-id'],
                settings: {
                    defaultNotificationSettings: {},
                    taskCategories: ['Pet Care'],
                },
            };
            const lastOwner = {
                userId: 'last-owner',
                householdId: 'household-1',
                name: 'Last Owner',
                email: 'lastowner@example.com',
                role: 'owner',
                pushToken: 'token123',
                permissions: ['admin'],
                preferences: {
                    notificationsEnabled: true,
                    mutedTasks: [],
                    channels: ['push'],
                },
                createdAt: Date.now(),
            };
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdInfo')
                .mockResolvedValue(mockHousehold);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserInHousehold')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserOwner')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(UserRepository_1.UserRepository.prototype, 'findUserById')
                .mockResolvedValue(lastOwner);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdOwners')
                .mockResolvedValue([lastOwner]);
            const testController = new MembershipController_1.MembershipController();
            await testController.updateUserRole(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockNext).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                code: 'VALIDATION_ERROR',
                message: 'Cannot remove the last owner from a household',
            }));
        });
        (0, globals_1.it)('should reject role change from non-owner', async () => {
            mockReq.params = { householdId: 'household-1', memberId: 'some-member' };
            mockReq.body = { role: 'owner' };
            mockReq.userId = 'member-user-id';
            const mockHousehold = {
                householdId: 'household-1',
                name: 'Test Household',
                createdAt: Date.now(),
                createdBy: 'owner-user-id',
                members: ['owner-user-id', 'member-user-id'],
                settings: {
                    defaultNotificationSettings: {},
                    taskCategories: ['Pet Care'],
                },
            };
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdInfo')
                .mockResolvedValue(mockHousehold);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserInHousehold')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserOwner')
                .mockResolvedValue(false);
            const testController = new MembershipController_1.MembershipController();
            await testController.updateUserRole(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockNext).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                code: 'FORBIDDEN',
                message: 'Only household owners can change member roles',
            }));
        });
    });
    (0, globals_1.describe)('removeMember', () => {
        (0, globals_1.it)('should remove member from household', async () => {
            mockReq.params = { householdId: 'household-1', memberId: 'member-to-remove' };
            const mockHousehold = {
                householdId: 'household-1',
                name: 'Test Household',
                createdAt: Date.now(),
                createdBy: 'owner-user-id',
                members: ['owner-user-id', 'member-to-remove'],
                settings: {
                    defaultNotificationSettings: {},
                    taskCategories: ['Pet Care'],
                },
            };
            const memberToRemove = {
                userId: 'member-to-remove',
                householdId: 'household-1',
                name: 'Member To Remove',
                email: 'member@example.com',
                role: 'member',
                pushToken: 'token123',
                permissions: ['task.execute'],
                preferences: {
                    notificationsEnabled: true,
                    mutedTasks: [],
                    channels: ['push'],
                },
                createdAt: Date.now(),
            };
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdInfo')
                .mockResolvedValue(mockHousehold);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserInHousehold')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserOwner')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(UserRepository_1.UserRepository.prototype, 'findUserById')
                .mockResolvedValue(memberToRemove);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'removeUserFromHousehold')
                .mockResolvedValue(undefined);
            const testController = new MembershipController_1.MembershipController();
            await testController.removeMember(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockRes.status).toHaveBeenCalledWith(204);
            (0, globals_1.expect)(mockRes.send).toHaveBeenCalled();
        });
        (0, globals_1.it)('should prevent removing last owner', async () => {
            mockReq.params = { householdId: 'household-1', memberId: 'last-owner' };
            const mockHousehold = {
                householdId: 'household-1',
                name: 'Test Household',
                createdAt: Date.now(),
                createdBy: 'last-owner',
                members: ['last-owner', 'member-user-id'],
                settings: {
                    defaultNotificationSettings: {},
                    taskCategories: ['Pet Care'],
                },
            };
            const lastOwner = {
                userId: 'last-owner',
                householdId: 'household-1',
                name: 'Last Owner',
                email: 'lastowner@example.com',
                role: 'owner',
                pushToken: 'token123',
                permissions: ['admin'],
                preferences: {
                    notificationsEnabled: true,
                    mutedTasks: [],
                    channels: ['push'],
                },
                createdAt: Date.now(),
            };
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdInfo')
                .mockResolvedValue(mockHousehold);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserInHousehold')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserOwner')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(UserRepository_1.UserRepository.prototype, 'findUserById')
                .mockResolvedValue(lastOwner);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdOwners')
                .mockResolvedValue([lastOwner]);
            const testController = new MembershipController_1.MembershipController();
            await testController.removeMember(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockNext).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                code: 'VALIDATION_ERROR',
                message: 'Cannot remove the last owner from a household',
            }));
        });
        (0, globals_1.it)('should reject removal from non-owner', async () => {
            mockReq.params = { householdId: 'household-1', memberId: 'some-member' };
            mockReq.userId = 'member-user-id';
            const mockHousehold = {
                householdId: 'household-1',
                name: 'Test Household',
                createdAt: Date.now(),
                createdBy: 'owner-user-id',
                members: ['owner-user-id', 'member-user-id'],
                settings: {
                    defaultNotificationSettings: {},
                    taskCategories: ['Pet Care'],
                },
            };
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdInfo')
                .mockResolvedValue(mockHousehold);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserInHousehold')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserOwner')
                .mockResolvedValue(false);
            const testController = new MembershipController_1.MembershipController();
            await testController.removeMember(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockNext).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                code: 'FORBIDDEN',
                message: 'Only household owners can remove members',
            }));
        });
    });
    (0, globals_1.describe)('getHouseholdMembers', () => {
        (0, globals_1.it)('should return all household members', async () => {
            mockReq.params = { householdId: 'household-1' };
            const mockHousehold = {
                householdId: 'household-1',
                name: 'Test Household',
                createdAt: Date.now(),
                createdBy: 'owner-user-id',
                members: ['owner-user-id', 'member-user-id'],
                settings: {
                    defaultNotificationSettings: {},
                    taskCategories: ['Pet Care'],
                },
            };
            const members = [
                {
                    userId: 'owner-user-id',
                    householdId: 'household-1',
                    name: 'Owner',
                    email: 'owner@example.com',
                    role: 'owner',
                    pushToken: 'token1',
                    permissions: ['admin'],
                    preferences: {
                        notificationsEnabled: true,
                        mutedTasks: [],
                        channels: ['push'],
                    },
                    createdAt: Date.now(),
                },
                {
                    userId: 'member-user-id',
                    householdId: 'household-1',
                    name: 'Member',
                    email: 'member@example.com',
                    role: 'member',
                    pushToken: 'token2',
                    permissions: ['task.execute'],
                    preferences: {
                        notificationsEnabled: true,
                        mutedTasks: [],
                        channels: ['push'],
                    },
                    createdAt: Date.now(),
                },
            ];
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdInfo')
                .mockResolvedValue(mockHousehold);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserInHousehold')
                .mockResolvedValue(true);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdMembers')
                .mockResolvedValue(members);
            const testController = new MembershipController_1.MembershipController();
            await testController.getHouseholdMembers(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockRes.json).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                success: true,
                data: globals_1.expect.objectContaining({
                    householdId: 'household-1',
                    memberCount: 2,
                }),
            }));
        });
        (0, globals_1.it)('should enforce household isolation', async () => {
            mockReq.params = { householdId: 'household-1' };
            mockReq.userId = 'outsider-user-id';
            const mockHousehold = {
                householdId: 'household-1',
                name: 'Test Household',
                createdAt: Date.now(),
                createdBy: 'owner-user-id',
                members: ['owner-user-id'],
                settings: {
                    defaultNotificationSettings: {},
                    taskCategories: ['Pet Care'],
                },
            };
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'getHouseholdInfo')
                .mockResolvedValue(mockHousehold);
            globals_1.jest
                .spyOn(HouseholdRepository_1.HouseholdRepository.prototype, 'isUserInHousehold')
                .mockResolvedValue(false);
            const testController = new MembershipController_1.MembershipController();
            await testController.getHouseholdMembers(mockReq, mockRes, mockNext);
            (0, globals_1.expect)(mockNext).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                code: 'FORBIDDEN',
                message: 'You are not a member of this household',
            }));
        });
    });
});
