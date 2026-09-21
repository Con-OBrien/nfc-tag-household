import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MembershipController } from '../../src/controllers/MembershipController';
import { HouseholdRepository } from '../../src/repositories/HouseholdRepository';
import { UserRepository } from '../../src/repositories/UserRepository';
import { Request, Response, NextFunction } from 'express';
import { HouseholdUser, Household } from '../../src/types';

describe('MembershipController', () => {
  let controller: MembershipController;
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;
  let householdRepositorySpy: any;
  let userRepositorySpy: any;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new MembershipController();

    mockReq = {
      params: {},
      body: {},
      headers: {},
      userId: 'owner-user-id',
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    if (householdRepositorySpy) {
      householdRepositorySpy.mockRestore();
    }
    if (userRepositorySpy) {
      userRepositorySpy.mockRestore();
    }
  });

  describe('inviteUser', () => {
    it('should invite a user with default member role', async () => {
      mockReq.params = { householdId: 'household-1' };
      mockReq.body = { email: 'newuser@example.com' };

      const mockHousehold: Household = {
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

      const mockNewUser: HouseholdUser = {
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

      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdInfo')
        .mockResolvedValue(mockHousehold);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserInHousehold')
        .mockResolvedValue(true);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserOwner')
        .mockResolvedValue(true);
      jest
        .spyOn(UserRepository.prototype, 'findByEmail')
        .mockResolvedValue(null);
      jest
        .spyOn(UserRepository.prototype, 'createUser')
        .mockResolvedValue(mockNewUser);

      const testController = new MembershipController();
      await testController.inviteUser(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            userId: 'new-user-id',
            email: 'newuser@example.com',
            role: 'member',
          }),
        })
      );
    });

    it('should reject invitation from non-owner', async () => {
      mockReq.params = { householdId: 'household-1' };
      mockReq.body = { email: 'newuser@example.com' };
      mockReq.userId = 'member-user-id';

      const mockHousehold: Household = {
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

      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdInfo')
        .mockResolvedValue(mockHousehold);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserInHousehold')
        .mockResolvedValue(true);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserOwner')
        .mockResolvedValue(false);

      const testController = new MembershipController();
      await testController.inviteUser(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN',
          statusCode: 403,
        })
      );
    });

    it('should reject duplicate membership', async () => {
      mockReq.params = { householdId: 'household-1' };
      mockReq.body = { email: 'existing@example.com' };

      const mockHousehold: Household = {
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

      const existingUser: HouseholdUser = {
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

      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdInfo')
        .mockResolvedValue(mockHousehold);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserInHousehold')
        .mockResolvedValue(true);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserOwner')
        .mockResolvedValue(true);
      jest
        .spyOn(UserRepository.prototype, 'findByEmail')
        .mockResolvedValue(existingUser);

      const testController = new MembershipController();
      await testController.inviteUser(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          statusCode: 400,
        })
      );
    });

    it('should reject invalid email format', async () => {
      mockReq.params = { householdId: 'household-1' };
      mockReq.body = { email: 'invalid-email' };

      const testController = new MembershipController();
      await testController.inviteUser(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          statusCode: 400,
          message: 'Invalid email format',
        })
      );
    });

    it('should require authentication', async () => {
      mockReq.params = { householdId: 'household-1' };
      mockReq.body = { email: 'newuser@example.com' };
      mockReq.userId = undefined;

      const testController = new MembershipController();
      await testController.inviteUser(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'User authentication required',
        })
      );
    });
  });

  describe('updateUserRole', () => {
    it('should promote member to owner', async () => {
      mockReq.params = { householdId: 'household-1', memberId: 'member-to-promote' };
      mockReq.body = { role: 'owner' };

      const mockHousehold: Household = {
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

      const memberToPromote: HouseholdUser = {
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

      const promotedMember: HouseholdUser = {
        ...memberToPromote,
        role: 'owner',
        permissions: ['admin', 'task.execute'],
      };

      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdInfo')
        .mockResolvedValue(mockHousehold);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserInHousehold')
        .mockResolvedValue(true);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserOwner')
        .mockResolvedValue(true);
      jest
        .spyOn(UserRepository.prototype, 'findUserById')
        .mockResolvedValueOnce(memberToPromote)
        .mockResolvedValueOnce(promotedMember);
      jest
        .spyOn(UserRepository.prototype, 'updateUserRole')
        .mockResolvedValue(undefined);

      const testController = new MembershipController();
      await testController.updateUserRole(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            role: 'owner',
          }),
        })
      );
    });

    it('should prevent removing last owner', async () => {
      mockReq.params = { householdId: 'household-1', memberId: 'last-owner' };
      mockReq.body = { role: 'member' };

      const mockHousehold: Household = {
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

      const lastOwner: HouseholdUser = {
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

      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdInfo')
        .mockResolvedValue(mockHousehold);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserInHousehold')
        .mockResolvedValue(true);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserOwner')
        .mockResolvedValue(true);
      jest
        .spyOn(UserRepository.prototype, 'findUserById')
        .mockResolvedValue(lastOwner);
      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdOwners')
        .mockResolvedValue([lastOwner]);

      const testController = new MembershipController();
      await testController.updateUserRole(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Cannot remove the last owner from a household',
        })
      );
    });

    it('should reject role change from non-owner', async () => {
      mockReq.params = { householdId: 'household-1', memberId: 'some-member' };
      mockReq.body = { role: 'owner' };
      mockReq.userId = 'member-user-id';

      const mockHousehold: Household = {
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

      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdInfo')
        .mockResolvedValue(mockHousehold);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserInHousehold')
        .mockResolvedValue(true);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserOwner')
        .mockResolvedValue(false);

      const testController = new MembershipController();
      await testController.updateUserRole(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN',
          message: 'Only household owners can change member roles',
        })
      );
    });
  });

  describe('removeMember', () => {
    it('should remove member from household', async () => {
      mockReq.params = { householdId: 'household-1', memberId: 'member-to-remove' };

      const mockHousehold: Household = {
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

      const memberToRemove: HouseholdUser = {
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

      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdInfo')
        .mockResolvedValue(mockHousehold);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserInHousehold')
        .mockResolvedValue(true);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserOwner')
        .mockResolvedValue(true);
      jest
        .spyOn(UserRepository.prototype, 'findUserById')
        .mockResolvedValue(memberToRemove);
      jest
        .spyOn(HouseholdRepository.prototype, 'removeUserFromHousehold')
        .mockResolvedValue(undefined);

      const testController = new MembershipController();
      await testController.removeMember(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should prevent removing last owner', async () => {
      mockReq.params = { householdId: 'household-1', memberId: 'last-owner' };

      const mockHousehold: Household = {
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

      const lastOwner: HouseholdUser = {
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

      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdInfo')
        .mockResolvedValue(mockHousehold);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserInHousehold')
        .mockResolvedValue(true);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserOwner')
        .mockResolvedValue(true);
      jest
        .spyOn(UserRepository.prototype, 'findUserById')
        .mockResolvedValue(lastOwner);
      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdOwners')
        .mockResolvedValue([lastOwner]);

      const testController = new MembershipController();
      await testController.removeMember(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Cannot remove the last owner from a household',
        })
      );
    });

    it('should reject removal from non-owner', async () => {
      mockReq.params = { householdId: 'household-1', memberId: 'some-member' };
      mockReq.userId = 'member-user-id';

      const mockHousehold: Household = {
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

      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdInfo')
        .mockResolvedValue(mockHousehold);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserInHousehold')
        .mockResolvedValue(true);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserOwner')
        .mockResolvedValue(false);

      const testController = new MembershipController();
      await testController.removeMember(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN',
          message: 'Only household owners can remove members',
        })
      );
    });
  });

  describe('getHouseholdMembers', () => {
    it('should return all household members', async () => {
      mockReq.params = { householdId: 'household-1' };

      const mockHousehold: Household = {
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

      const members: HouseholdUser[] = [
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

      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdInfo')
        .mockResolvedValue(mockHousehold);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserInHousehold')
        .mockResolvedValue(true);
      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdMembers')
        .mockResolvedValue(members);

      const testController = new MembershipController();
      await testController.getHouseholdMembers(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            householdId: 'household-1',
            memberCount: 2,
          }),
        })
      );
    });

    it('should enforce household isolation', async () => {
      mockReq.params = { householdId: 'household-1' };
      mockReq.userId = 'outsider-user-id';

      const mockHousehold: Household = {
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

      jest
        .spyOn(HouseholdRepository.prototype, 'getHouseholdInfo')
        .mockResolvedValue(mockHousehold);
      jest
        .spyOn(HouseholdRepository.prototype, 'isUserInHousehold')
        .mockResolvedValue(false);

      const testController = new MembershipController();
      await testController.getHouseholdMembers(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FORBIDDEN',
          message: 'You are not a member of this household',
        })
      );
    });
  });
});
