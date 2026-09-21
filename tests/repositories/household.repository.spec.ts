import { HouseholdRepository } from '../../src/repositories/HouseholdRepository';
import { UserRepository } from '../../src/repositories/UserRepository';
import { Household as HouseholdEntity } from '../../src/entities/Household';
import { ValidationError, NotFoundError } from '../../src/types';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../src/config/database';
import { randomUUID } from 'crypto';

/**
 * HouseholdRepository Unit Tests
 * Tests household creation, user membership, role management, and household settings
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */
describe('HouseholdRepository', () => {
  let householdRepository: HouseholdRepository;
  let userRepository: UserRepository;
  let repository: Repository<HouseholdEntity>;

  // Test fixtures
  const creatorId = randomUUID();
  const now = Date.now();

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    repository = AppDataSource.getRepository(HouseholdEntity);
  });

  beforeEach(async () => {
    await repository.delete({});
    householdRepository = new HouseholdRepository();
    userRepository = new UserRepository();
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  describe('createHousehold', () => {
    it('should create household with unique ID and set creator as owner', async () => {
      const household = await householdRepository.createHousehold(
        "Alice & Bob's Home",
        creatorId
      );

      expect(household.householdId).toBeDefined();
      expect(household.name).toBe("Alice & Bob's Home");
      expect(household.createdBy).toBe(creatorId);
      expect(household.members).toContain(creatorId);
      expect(household.settings.taskCategories).toContain('Pet Care');
    });

    it('should initialize default task categories', async () => {
      const household = await householdRepository.createHousehold('Test', creatorId);

      expect(household.settings.taskCategories).toContain('Household Chores');
      expect(household.settings.taskCategories.length).toBeGreaterThan(0);
    });

    it('should require name and creatorId', async () => {
      await expect(householdRepository.createHousehold('', creatorId)).rejects.toThrow(
        ValidationError
      );

      await expect(householdRepository.createHousehold('Test', '')).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate name length', async () => {
      await expect(householdRepository.createHousehold('', creatorId)).rejects.toThrow();

      const longName = 'a'.repeat(256);
      await expect(householdRepository.createHousehold(longName, creatorId)).rejects.toThrow(
        ValidationError
      );
    });

    it('should set creation timestamp', async () => {
      const before = Date.now();
      const household = await householdRepository.createHousehold('Test', creatorId);
      const after = Date.now();

      expect(household.createdAt).toBeGreaterThanOrEqual(before);
      expect(household.createdAt).toBeLessThanOrEqual(after);
    });
  });

  describe('addUserToHousehold', () => {
    let householdId: string;
    const newUserId = randomUUID();

    beforeEach(async () => {
      const household = await householdRepository.createHousehold('Test', creatorId);
      householdId = household.householdId;
    });

    it('should add user to household with default member role', async () => {
      await householdRepository.addUserToHousehold(householdId, newUserId);

      const household = await householdRepository.getHouseholdInfo(householdId);

      expect(household!.members).toContain(newUserId);
    });

    it('should require householdId and userId', async () => {
      await expect(householdRepository.addUserToHousehold('', newUserId)).rejects.toThrow(
        ValidationError
      );

      await expect(householdRepository.addUserToHousehold(householdId, '')).rejects.toThrow(
        ValidationError
      );
    });

    it('should support specifying owner role', async () => {
      const ownerId = randomUUID();
      await householdRepository.addUserToHousehold(householdId, ownerId, 'owner');

      const household = await householdRepository.getHouseholdInfo(householdId);

      expect(household!.members).toContain(ownerId);
    });

    it('should reject invalid role', async () => {
      await expect(
        householdRepository.addUserToHousehold(householdId, newUserId, 'invalid' as any)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error for non-existent household', async () => {
      const fakeHouseholdId = randomUUID();

      await expect(
        householdRepository.addUserToHousehold(fakeHouseholdId, newUserId)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw error if user already in household', async () => {
      await householdRepository.addUserToHousehold(householdId, newUserId);

      await expect(
        householdRepository.addUserToHousehold(householdId, newUserId)
      ).rejects.toThrow();
    });
  });

  describe('removeUserFromHousehold', () => {
    let householdId: string;
    const userId = randomUUID();

    beforeEach(async () => {
      const household = await householdRepository.createHousehold('Test', creatorId);
      householdId = household.householdId;
      await householdRepository.addUserToHousehold(householdId, userId);
    });

    it('should remove user from household', async () => {
      await householdRepository.removeUserFromHousehold(householdId, userId);

      const household = await householdRepository.getHouseholdInfo(householdId);

      expect(household!.members).not.toContain(userId);
    });

    it('should require householdId and userId', async () => {
      await expect(householdRepository.removeUserFromHousehold('', userId)).rejects.toThrow(
        ValidationError
      );

      await expect(householdRepository.removeUserFromHousehold(householdId, '')).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw error if user not in household', async () => {
      const otherUserId = randomUUID();

      await expect(
        householdRepository.removeUserFromHousehold(householdId, otherUserId)
      ).rejects.toThrow();
    });
  });

  describe('getHouseholdInfo', () => {
    let householdId: string;

    beforeEach(async () => {
      const household = await householdRepository.createHousehold('Test', creatorId);
      householdId = household.householdId;
    });

    it('should return household information', async () => {
      const household = await householdRepository.getHouseholdInfo(householdId);

      expect(household).not.toBeNull();
      expect(household!.householdId).toBe(householdId);
      expect(household!.name).toBe('Test');
    });

    it('should return null for non-existent household', async () => {
      const fakeId = randomUUID();

      const household = await householdRepository.getHouseholdInfo(fakeId);

      expect(household).toBeNull();
    });

    it('should require householdId', async () => {
      await expect(householdRepository.getHouseholdInfo('')).rejects.toThrow(ValidationError);
    });
  });

  describe('updateHouseholdSettings', () => {
    let householdId: string;

    beforeEach(async () => {
      const household = await householdRepository.createHousehold('Test', creatorId);
      householdId = household.householdId;
    });

    it('should add task category', async () => {
      await householdRepository.addTaskCategory(householdId, 'Custom Category');

      const household = await householdRepository.getHouseholdInfo(householdId);

      expect(household!.settings.taskCategories).toContain('Custom Category');
    });

    it('should remove task category', async () => {
      await householdRepository.addTaskCategory(householdId, 'To Delete');
      await householdRepository.removeTaskCategory(householdId, 'To Delete');

      const household = await householdRepository.getHouseholdInfo(householdId);

      expect(household!.settings.taskCategories).not.toContain('To Delete');
    });

    it('should prevent removing last category', async () => {
      // Start with default categories, remove all but one
      const household = await householdRepository.getHouseholdInfo(householdId);
      const categories = household!.settings.taskCategories;

      for (let i = 0; i < categories.length - 1; i++) {
        await householdRepository.removeTaskCategory(householdId, categories[i]);
      }

      // Now try to remove the last one - should fail
      await expect(
        householdRepository.removeTaskCategory(householdId, categories[categories.length - 1])
      ).rejects.toThrow(ValidationError);
    });

    it('should reject duplicate category', async () => {
      await householdRepository.addTaskCategory(householdId, 'Duplicate');

      await expect(
        householdRepository.addTaskCategory(householdId, 'Duplicate')
      ).rejects.toThrow(ValidationError);
    });

    it('should require householdId', async () => {
      await expect(
        householdRepository.updateHouseholdSettings('', { taskCategories: ['New'] })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getHouseholdMembers', () => {
    let householdId: string;

    beforeEach(async () => {
      const household = await householdRepository.createHousehold('Test', creatorId);
      householdId = household.householdId;

      // Add multiple members
      for (let i = 0; i < 3; i++) {
        const userId = randomUUID();
        await householdRepository.addUserToHousehold(householdId, userId);
      }
    });

    it('should return all household members', async () => {
      const members = await householdRepository.getHouseholdMembers(householdId);

      expect(members.length).toBeGreaterThanOrEqual(3);
      expect(members.every((m) => m.householdId === householdId)).toBe(true);
    });

    it('should require householdId', async () => {
      await expect(householdRepository.getHouseholdMembers('')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('getHouseholdOwners', () => {
    let householdId: string;

    beforeEach(async () => {
      const household = await householdRepository.createHousehold('Test', creatorId);
      householdId = household.householdId;

      // Add owner and members
      const ownerId = randomUUID();
      await householdRepository.addUserToHousehold(householdId, ownerId, 'owner');

      for (let i = 0; i < 2; i++) {
        await householdRepository.addUserToHousehold(householdId, randomUUID());
      }
    });

    it('should return only owners', async () => {
      const owners = await householdRepository.getHouseholdOwners(householdId);

      expect(owners.every((o) => o.role === 'owner')).toBe(true);
    });
  });

  describe('isUserInHousehold', () => {
    let householdId: string;
    const userId = randomUUID();

    beforeEach(async () => {
      const household = await householdRepository.createHousehold('Test', creatorId);
      householdId = household.householdId;
      await householdRepository.addUserToHousehold(householdId, userId);
    });

    it('should return true if user in household', async () => {
      const isIn = await householdRepository.isUserInHousehold(userId, householdId);

      expect(isIn).toBe(true);
    });

    it('should return false if user not in household', async () => {
      const otherUserId = randomUUID();

      const isIn = await householdRepository.isUserInHousehold(otherUserId, householdId);

      expect(isIn).toBe(false);
    });

    it('should require userId and householdId', async () => {
      await expect(householdRepository.isUserInHousehold('', householdId)).rejects.toThrow(
        ValidationError
      );

      await expect(householdRepository.isUserInHousehold(userId, '')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('isUserOwner', () => {
    let householdId: string;
    const ownerId = randomUUID();
    const memberId = randomUUID();

    beforeEach(async () => {
      const household = await householdRepository.createHousehold('Test', creatorId);
      householdId = household.householdId;
      await householdRepository.addUserToHousehold(householdId, ownerId, 'owner');
      await householdRepository.addUserToHousehold(householdId, memberId, 'member');
    });

    it('should return true if user is owner', async () => {
      const isOwner = await householdRepository.isUserOwner(ownerId, householdId);

      expect(isOwner).toBe(true);
    });

    it('should return false if user is member', async () => {
      const isOwner = await householdRepository.isUserOwner(memberId, householdId);

      expect(isOwner).toBe(false);
    });

    it('should return false if user not in household', async () => {
      const otherUserId = randomUUID();

      const isOwner = await householdRepository.isUserOwner(otherUserId, householdId);

      expect(isOwner).toBe(false);
    });
  });

  describe('getMemberCount', () => {
    let householdId: string;

    beforeEach(async () => {
      const household = await householdRepository.createHousehold('Test', creatorId);
      householdId = household.householdId;

      for (let i = 0; i < 5; i++) {
        await householdRepository.addUserToHousehold(householdId, randomUUID());
      }
    });

    it('should count household members', async () => {
      const count = await householdRepository.getMemberCount(householdId);

      expect(count).toBeGreaterThanOrEqual(5);
    });

    it('should require householdId', async () => {
      await expect(householdRepository.getMemberCount('')).rejects.toThrow(ValidationError);
    });
  });

  describe('findByCreatorAndName', () => {
    it('should find household by creator and name', async () => {
      const household = await householdRepository.createHousehold('TestHouse', creatorId);

      const found = await householdRepository.findByCreatorAndName(creatorId, 'TestHouse');

      expect(found).not.toBeNull();
      expect(found!.householdId).toBe(household.householdId);
    });

    it('should return null if not found', async () => {
      const found = await householdRepository.findByCreatorAndName(creatorId, 'NonExistent');

      expect(found).toBeNull();
    });

    it('should require creatorId and name', async () => {
      await expect(householdRepository.findByCreatorAndName('', 'Test')).rejects.toThrow(
        ValidationError
      );

      await expect(householdRepository.findByCreatorAndName(creatorId, '')).rejects.toThrow(
        ValidationError
      );
    });
  });
});
