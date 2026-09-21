import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Household as HouseholdEntity } from '../entities/Household';
import { Household, HouseholdUser } from '../types';
import { randomUUID } from 'crypto';
import { ValidationError, ForbiddenError, NotFoundError } from '../types';
import { UserRepository } from './UserRepository';

/**
 * HouseholdRepository - Data access layer for household management
 * Manages household creation, user membership, roles, and household-level settings
 * Enforces proper access control and data isolation between households
 */
export class HouseholdRepository {
  private repository: Repository<HouseholdEntity>;
  private userRepository: UserRepository;

  constructor() {
    this.repository = AppDataSource.getRepository(HouseholdEntity);
    this.userRepository = new UserRepository();
  }

  /**
   * Create a new household
   * Assigns unique householdId and sets creator as initial owner
   * Initializes default task categories and notification settings
   * @param name - Human-readable name for the household (e.g., "Alice & Bob's Home")
   * @param creatorId - UUID of the user creating the household
   * @returns Created Household with initial settings
   * @throws ValidationError if name or creatorId missing
   */
  async createHousehold(name: string, creatorId: string): Promise<Household> {
    if (!name || !creatorId) {
      throw new ValidationError('name and creatorId are required');
    }

    if (name.length < 1 || name.length > 255) {
      throw new ValidationError('Household name must be between 1 and 255 characters');
    }

    const now = Date.now();
    const householdId = randomUUID();

    const newHousehold = this.repository.create({
      householdId,
      name,
      createdAtTimestamp: now,
      createdBy: creatorId,
      members: [creatorId],
      settings: {
        defaultNotificationSettings: {
          notificationsEnabled: true,
          channels: ['push'],
        },
        taskCategories: [
          'Pet Care',
          'Household Chores',
          'Shopping',
          'Maintenance',
          'Other',
        ],
      },
    });

    const savedHousehold = await this.repository.save(newHousehold);

    return savedHousehold.toHousehold();
  }

  /**
   * Add a user to a household
   * Adds user ID to household members list
   * Default role is 'member' unless explicitly set otherwise
   * @param householdId - UUID of the household
   * @param userId - UUID of the user to add
   * @param role - Optional role ('owner' or 'member', default: 'member')
   * @throws ValidationError if householdId or userId missing
   * @throws NotFoundError if household not found
   * @throws Error if user already in household
   */
  async addUserToHousehold(
    householdId: string,
    userId: string,
    role: 'owner' | 'member' = 'member'
  ): Promise<void> {
    if (!householdId || !userId) {
      throw new ValidationError('householdId and userId are required');
    }

    if (!['owner', 'member'].includes(role)) {
      throw new ValidationError('role must be "owner" or "member"');
    }

    const household = await this.repository.findOne({
      where: { householdId },
    });

    if (!household) {
      throw new NotFoundError('Household');
    }

    // Check if user already in household
    if (household.members.includes(userId)) {
      throw new Error(`User ${userId} is already a member of this household`);
    }

    // Add user to members list
    household.members.push(userId);

    await this.repository.save(household);
  }

  /**
   * Remove a user from a household
   * Revokes all access to household tasks and resources
   * Preserves historical events for audit purposes (handled in EventRepository)
   * @param householdId - UUID of the household
   * @param userId - UUID of the user to remove
   * @throws ValidationError if householdId or userId missing
   * @throws NotFoundError if household not found
   * @throws Error if user not a member
   */
  async removeUserFromHousehold(householdId: string, userId: string): Promise<void> {
    if (!householdId || !userId) {
      throw new ValidationError('householdId and userId are required');
    }

    const household = await this.repository.findOne({
      where: { householdId },
    });

    if (!household) {
      throw new NotFoundError('Household');
    }

    // Check if user is in household
    if (!household.members.includes(userId)) {
      throw new Error(`User ${userId} is not a member of this household`);
    }

    // Remove user from members list
    household.members = household.members.filter((id) => id !== userId);

    await this.repository.save(household);
  }

  /**
   * Get household information including all members
   * Returns household metadata and member list
   * @param householdId - UUID of the household
   * @returns Household if found, null otherwise
   * @throws ValidationError if householdId missing
   */
  async getHouseholdInfo(householdId: string): Promise<Household | null> {
    if (!householdId) {
      throw new ValidationError('householdId is required');
    }

    const household = await this.repository.findOne({
      where: { householdId },
    });

    if (!household) {
      return null;
    }

    return household.toHousehold();
  }

  /**
   * Update user role within a household
   * Promotes or demotes user between owner and member roles
   * @param householdId - UUID of the household
   * @param userId - UUID of the user
   * @param role - New role ('owner' or 'member')
   * @throws ValidationError if householdId, userId, or role missing/invalid
   * @throws NotFoundError if household or user not found
   */
  async updateUserRole(householdId: string, userId: string, role: 'owner' | 'member'): Promise<void> {
    if (!householdId || !userId || !role) {
      throw new ValidationError('householdId, userId, and role are required');
    }

    if (!['owner', 'member'].includes(role)) {
      throw new ValidationError('role must be "owner" or "member"');
    }

    // Verify household exists
    const household = await this.repository.findOne({
      where: { householdId },
    });

    if (!household) {
      throw new NotFoundError('Household');
    }

    // Verify user is in household
    if (!household.members.includes(userId)) {
      throw new Error(`User ${userId} is not a member of this household`);
    }

    // Update user role (delegated to UserRepository)
    await this.userRepository.updateUserRole(userId, householdId, role);
  }

  /**
   * Update household settings
   * Updates default notification settings and task categories
   * @param householdId - UUID of the household
   * @param settings - Partial settings update
   * @throws ValidationError if householdId missing
   * @throws NotFoundError if household not found
   */
  async updateHouseholdSettings(
    householdId: string,
    settings: Partial<Household['settings']>
  ): Promise<void> {
    if (!householdId) {
      throw new ValidationError('householdId is required');
    }

    const household = await this.repository.findOne({
      where: { householdId },
    });

    if (!household) {
      throw new NotFoundError('Household');
    }

    // Validate task categories if provided
    if (settings.taskCategories) {
      if (!Array.isArray(settings.taskCategories)) {
        throw new ValidationError('taskCategories must be an array of strings');
      }
      if (settings.taskCategories.length === 0) {
        throw new ValidationError('At least one task category is required');
      }
      for (const category of settings.taskCategories) {
        if (typeof category !== 'string' || category.length === 0) {
          throw new ValidationError('Each task category must be a non-empty string');
        }
      }
    }

    // Update settings
    household.settings = {
      ...household.settings,
      ...settings,
    };

    await this.repository.save(household);
  }

  /**
   * Get all members of a household with detailed info
   * @param householdId - UUID of the household
   * @returns Array of HouseholdUsers
   */
  async getHouseholdMembers(householdId: string): Promise<HouseholdUser[]> {
    if (!householdId) {
      throw new ValidationError('householdId is required');
    }

    return this.userRepository.findUsersInHousehold(householdId);
  }

  /**
   * Get household owners
   * Used to determine who can make administrative changes
   * @param householdId - UUID of the household
   * @returns Array of HouseholdUsers with owner role
   */
  async getHouseholdOwners(householdId: string): Promise<HouseholdUser[]> {
    if (!householdId) {
      throw new ValidationError('householdId is required');
    }

    return this.userRepository.findUsersInHousehold(householdId, 'owner');
  }

  /**
   * Add a task category to household settings
   * @param householdId - UUID of the household
   * @param category - Category name to add
   * @throws ValidationError if category already exists
   */
  async addTaskCategory(householdId: string, category: string): Promise<void> {
    if (!householdId || !category) {
      throw new ValidationError('householdId and category are required');
    }

    const household = await this.repository.findOne({
      where: { householdId },
    });

    if (!household) {
      throw new NotFoundError('Household');
    }

    if (household.settings.taskCategories.includes(category)) {
      throw new ValidationError(`Category "${category}" already exists`);
    }

    household.settings.taskCategories.push(category);
    await this.repository.save(household);
  }

  /**
   * Remove a task category from household settings
   * Tasks in this category will be reassigned to default category
   * @param householdId - UUID of the household
   * @param category - Category name to remove
   * @throws ValidationError if category not found or is the only category
   */
  async removeTaskCategory(householdId: string, category: string): Promise<void> {
    if (!householdId || !category) {
      throw new ValidationError('householdId and category are required');
    }

    const household = await this.repository.findOne({
      where: { householdId },
    });

    if (!household) {
      throw new NotFoundError('Household');
    }

    if (!household.settings.taskCategories.includes(category)) {
      throw new ValidationError(`Category "${category}" not found`);
    }

    if (household.settings.taskCategories.length === 1) {
      throw new ValidationError('Household must have at least one task category');
    }

    household.settings.taskCategories = household.settings.taskCategories.filter(
      (c) => c !== category
    );

    await this.repository.save(household);
  }

  /**
   * Verify that a user is a member of a household
   * Used for authorization checks
   * @param userId - UUID of the user
   * @param householdId - UUID of the household
   * @returns true if user is member, false otherwise
   */
  async isUserInHousehold(userId: string, householdId: string): Promise<boolean> {
    if (!userId || !householdId) {
      throw new ValidationError('userId and householdId are required');
    }

    const household = await this.repository.findOne({
      where: { householdId },
    });

    if (!household) {
      return false;
    }

    return household.members.includes(userId);
  }

  /**
   * Verify that a user is an owner of a household
   * Used for administrative authorization checks
   * @param userId - UUID of the user
   * @param householdId - UUID of the household
   * @returns true if user is owner, false otherwise
   */
  async isUserOwner(userId: string, householdId: string): Promise<boolean> {
    if (!userId || !householdId) {
      throw new ValidationError('userId and householdId are required');
    }

    const user = await this.userRepository.findUserById(userId, householdId);
    return user ? user.role === 'owner' : false;
  }

  /**
   * Get total member count for a household
   * @param householdId - UUID of the household
   * @returns Number of members
   */
  async getMemberCount(householdId: string): Promise<number> {
    if (!householdId) {
      throw new ValidationError('householdId is required');
    }

    return this.userRepository.countUsersInHousehold(householdId);
  }

  /**
   * Find a household by creator ID and name
   * Used to prevent duplicate household creation
   * @param creatorId - UUID of the creator
   * @param name - Household name
   * @returns Household if found, null otherwise
   */
  async findByCreatorAndName(creatorId: string, name: string): Promise<Household | null> {
    if (!creatorId || !name) {
      throw new ValidationError('creatorId and name are required');
    }

    const household = await this.repository.findOne({
      where: {
        createdBy: creatorId,
        name,
      },
    });

    return household ? household.toHousehold() : null;
  }
}
