"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const HouseholdRepository_1 = require("../../src/repositories/HouseholdRepository");
const UserRepository_1 = require("../../src/repositories/UserRepository");
const Household_1 = require("../../src/entities/Household");
const types_1 = require("../../src/types");
const database_1 = require("../../src/config/database");
const crypto_1 = require("crypto");
/**
 * HouseholdRepository Unit Tests
 * Tests household creation, user membership, role management, and household settings
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */
describe('HouseholdRepository', () => {
    let householdRepository;
    let userRepository;
    let repository;
    // Test fixtures
    const creatorId = (0, crypto_1.randomUUID)();
    const now = Date.now();
    beforeAll(async () => {
        if (!database_1.AppDataSource.isInitialized) {
            await database_1.AppDataSource.initialize();
        }
        repository = database_1.AppDataSource.getRepository(Household_1.Household);
    });
    beforeEach(async () => {
        await repository.delete({});
        householdRepository = new HouseholdRepository_1.HouseholdRepository();
        userRepository = new UserRepository_1.UserRepository();
    });
    afterAll(async () => {
        if (database_1.AppDataSource.isInitialized) {
            await database_1.AppDataSource.destroy();
        }
    });
    describe('createHousehold', () => {
        it('should create household with unique ID and set creator as owner', async () => {
            const household = await householdRepository.createHousehold("Alice & Bob's Home", creatorId);
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
            await expect(householdRepository.createHousehold('', creatorId)).rejects.toThrow(types_1.ValidationError);
            await expect(householdRepository.createHousehold('Test', '')).rejects.toThrow(types_1.ValidationError);
        });
        it('should validate name length', async () => {
            await expect(householdRepository.createHousehold('', creatorId)).rejects.toThrow();
            const longName = 'a'.repeat(256);
            await expect(householdRepository.createHousehold(longName, creatorId)).rejects.toThrow(types_1.ValidationError);
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
        let householdId;
        const newUserId = (0, crypto_1.randomUUID)();
        beforeEach(async () => {
            const household = await householdRepository.createHousehold('Test', creatorId);
            householdId = household.householdId;
        });
        it('should add user to household with default member role', async () => {
            await householdRepository.addUserToHousehold(householdId, newUserId);
            const household = await householdRepository.getHouseholdInfo(householdId);
            expect(household.members).toContain(newUserId);
        });
        it('should require householdId and userId', async () => {
            await expect(householdRepository.addUserToHousehold('', newUserId)).rejects.toThrow(types_1.ValidationError);
            await expect(householdRepository.addUserToHousehold(householdId, '')).rejects.toThrow(types_1.ValidationError);
        });
        it('should support specifying owner role', async () => {
            const ownerId = (0, crypto_1.randomUUID)();
            await householdRepository.addUserToHousehold(householdId, ownerId, 'owner');
            const household = await householdRepository.getHouseholdInfo(householdId);
            expect(household.members).toContain(ownerId);
        });
        it('should reject invalid role', async () => {
            await expect(householdRepository.addUserToHousehold(householdId, newUserId, 'invalid')).rejects.toThrow(types_1.ValidationError);
        });
        it('should throw error for non-existent household', async () => {
            const fakeHouseholdId = (0, crypto_1.randomUUID)();
            await expect(householdRepository.addUserToHousehold(fakeHouseholdId, newUserId)).rejects.toThrow(types_1.NotFoundError);
        });
        it('should throw error if user already in household', async () => {
            await householdRepository.addUserToHousehold(householdId, newUserId);
            await expect(householdRepository.addUserToHousehold(householdId, newUserId)).rejects.toThrow();
        });
    });
    describe('removeUserFromHousehold', () => {
        let householdId;
        const userId = (0, crypto_1.randomUUID)();
        beforeEach(async () => {
            const household = await householdRepository.createHousehold('Test', creatorId);
            householdId = household.householdId;
            await householdRepository.addUserToHousehold(householdId, userId);
        });
        it('should remove user from household', async () => {
            await householdRepository.removeUserFromHousehold(householdId, userId);
            const household = await householdRepository.getHouseholdInfo(householdId);
            expect(household.members).not.toContain(userId);
        });
        it('should require householdId and userId', async () => {
            await expect(householdRepository.removeUserFromHousehold('', userId)).rejects.toThrow(types_1.ValidationError);
            await expect(householdRepository.removeUserFromHousehold(householdId, '')).rejects.toThrow(types_1.ValidationError);
        });
        it('should throw error if user not in household', async () => {
            const otherUserId = (0, crypto_1.randomUUID)();
            await expect(householdRepository.removeUserFromHousehold(householdId, otherUserId)).rejects.toThrow();
        });
    });
    describe('getHouseholdInfo', () => {
        let householdId;
        beforeEach(async () => {
            const household = await householdRepository.createHousehold('Test', creatorId);
            householdId = household.householdId;
        });
        it('should return household information', async () => {
            const household = await householdRepository.getHouseholdInfo(householdId);
            expect(household).not.toBeNull();
            expect(household.householdId).toBe(householdId);
            expect(household.name).toBe('Test');
        });
        it('should return null for non-existent household', async () => {
            const fakeId = (0, crypto_1.randomUUID)();
            const household = await householdRepository.getHouseholdInfo(fakeId);
            expect(household).toBeNull();
        });
        it('should require householdId', async () => {
            await expect(householdRepository.getHouseholdInfo('')).rejects.toThrow(types_1.ValidationError);
        });
    });
    describe('updateHouseholdSettings', () => {
        let householdId;
        beforeEach(async () => {
            const household = await householdRepository.createHousehold('Test', creatorId);
            householdId = household.householdId;
        });
        it('should add task category', async () => {
            await householdRepository.addTaskCategory(householdId, 'Custom Category');
            const household = await householdRepository.getHouseholdInfo(householdId);
            expect(household.settings.taskCategories).toContain('Custom Category');
        });
        it('should remove task category', async () => {
            await householdRepository.addTaskCategory(householdId, 'To Delete');
            await householdRepository.removeTaskCategory(householdId, 'To Delete');
            const household = await householdRepository.getHouseholdInfo(householdId);
            expect(household.settings.taskCategories).not.toContain('To Delete');
        });
        it('should prevent removing last category', async () => {
            // Start with default categories, remove all but one
            const household = await householdRepository.getHouseholdInfo(householdId);
            const categories = household.settings.taskCategories;
            for (let i = 0; i < categories.length - 1; i++) {
                await householdRepository.removeTaskCategory(householdId, categories[i]);
            }
            // Now try to remove the last one - should fail
            await expect(householdRepository.removeTaskCategory(householdId, categories[categories.length - 1])).rejects.toThrow(types_1.ValidationError);
        });
        it('should reject duplicate category', async () => {
            await householdRepository.addTaskCategory(householdId, 'Duplicate');
            await expect(householdRepository.addTaskCategory(householdId, 'Duplicate')).rejects.toThrow(types_1.ValidationError);
        });
        it('should require householdId', async () => {
            await expect(householdRepository.updateHouseholdSettings('', { taskCategories: ['New'] })).rejects.toThrow(types_1.ValidationError);
        });
    });
    describe('getHouseholdMembers', () => {
        let householdId;
        beforeEach(async () => {
            const household = await householdRepository.createHousehold('Test', creatorId);
            householdId = household.householdId;
            // Add multiple members
            for (let i = 0; i < 3; i++) {
                const userId = (0, crypto_1.randomUUID)();
                await householdRepository.addUserToHousehold(householdId, userId);
            }
        });
        it('should return all household members', async () => {
            const members = await householdRepository.getHouseholdMembers(householdId);
            expect(members.length).toBeGreaterThanOrEqual(3);
            expect(members.every((m) => m.householdId === householdId)).toBe(true);
        });
        it('should require householdId', async () => {
            await expect(householdRepository.getHouseholdMembers('')).rejects.toThrow(types_1.ValidationError);
        });
    });
    describe('getHouseholdOwners', () => {
        let householdId;
        beforeEach(async () => {
            const household = await householdRepository.createHousehold('Test', creatorId);
            householdId = household.householdId;
            // Add owner and members
            const ownerId = (0, crypto_1.randomUUID)();
            await householdRepository.addUserToHousehold(householdId, ownerId, 'owner');
            for (let i = 0; i < 2; i++) {
                await householdRepository.addUserToHousehold(householdId, (0, crypto_1.randomUUID)());
            }
        });
        it('should return only owners', async () => {
            const owners = await householdRepository.getHouseholdOwners(householdId);
            expect(owners.every((o) => o.role === 'owner')).toBe(true);
        });
    });
    describe('isUserInHousehold', () => {
        let householdId;
        const userId = (0, crypto_1.randomUUID)();
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
            const otherUserId = (0, crypto_1.randomUUID)();
            const isIn = await householdRepository.isUserInHousehold(otherUserId, householdId);
            expect(isIn).toBe(false);
        });
        it('should require userId and householdId', async () => {
            await expect(householdRepository.isUserInHousehold('', householdId)).rejects.toThrow(types_1.ValidationError);
            await expect(householdRepository.isUserInHousehold(userId, '')).rejects.toThrow(types_1.ValidationError);
        });
    });
    describe('isUserOwner', () => {
        let householdId;
        const ownerId = (0, crypto_1.randomUUID)();
        const memberId = (0, crypto_1.randomUUID)();
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
            const otherUserId = (0, crypto_1.randomUUID)();
            const isOwner = await householdRepository.isUserOwner(otherUserId, householdId);
            expect(isOwner).toBe(false);
        });
    });
    describe('getMemberCount', () => {
        let householdId;
        beforeEach(async () => {
            const household = await householdRepository.createHousehold('Test', creatorId);
            householdId = household.householdId;
            for (let i = 0; i < 5; i++) {
                await householdRepository.addUserToHousehold(householdId, (0, crypto_1.randomUUID)());
            }
        });
        it('should count household members', async () => {
            const count = await householdRepository.getMemberCount(householdId);
            expect(count).toBeGreaterThanOrEqual(5);
        });
        it('should require householdId', async () => {
            await expect(householdRepository.getMemberCount('')).rejects.toThrow(types_1.ValidationError);
        });
    });
    describe('findByCreatorAndName', () => {
        it('should find household by creator and name', async () => {
            const household = await householdRepository.createHousehold('TestHouse', creatorId);
            const found = await householdRepository.findByCreatorAndName(creatorId, 'TestHouse');
            expect(found).not.toBeNull();
            expect(found.householdId).toBe(household.householdId);
        });
        it('should return null if not found', async () => {
            const found = await householdRepository.findByCreatorAndName(creatorId, 'NonExistent');
            expect(found).toBeNull();
        });
        it('should require creatorId and name', async () => {
            await expect(householdRepository.findByCreatorAndName('', 'Test')).rejects.toThrow(types_1.ValidationError);
            await expect(householdRepository.findByCreatorAndName(creatorId, '')).rejects.toThrow(types_1.ValidationError);
        });
    });
});
