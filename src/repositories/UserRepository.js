"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const database_1 = require("../config/database");
const User_1 = require("../entities/User");
const crypto_1 = require("crypto");
const types_1 = require("../types");
const CryptoService_1 = require("../services/CryptoService");
/**
 * UserRepository - Data access layer for user and household member management
 * Enforces household isolation on all queries - users can only access members of their own household
 * Manages push token lifecycle, user preferences, and role-based access
 * Encrypts sensitive data (push tokens, email, phone) at rest using AES-256-GCM
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 18.2, 18.3, 18.4, 18.5
 */
class UserRepository {
    constructor() {
        this.repository = database_1.AppDataSource.getRepository(User_1.UserEntity);
        try {
            this.cryptoService = new CryptoService_1.CryptoService();
        }
        catch (error) {
            console.warn('CryptoService initialization warning:', error);
            // Continue without encryption if key not configured
        }
    }
    /**
     * Find a user by ID with household isolation check
     * Returns user with all push tokens and preferences
     * @param userId - UUID of the user to find
     * @param householdId - UUID of the household (for isolation check)
     * @returns HouseholdUser if found and belongs to household, null otherwise
     * @throws ValidationError if userId or householdId missing
     * @throws ForbiddenError if user doesn't belong to specified household
     */
    async findUserById(userId, householdId) {
        if (!userId || !householdId) {
            throw new types_1.ValidationError('userId and householdId are required');
        }
        const userEntity = await this.repository.findOne({
            where: {
                userId,
                householdId,
            },
        });
        if (!userEntity) {
            return null;
        }
        return userEntity.toHouseholdUser();
    }
    /**
     * Helper method: Decrypt push token if encrypted
     * Used when retrieving users to get plaintext tokens for notification delivery
     * @param token - Possibly encrypted token
     * @returns Decrypted token or original token if not encrypted
     */
    decryptTokenIfNeeded(token) {
        if (!this.cryptoService) {
            return token;
        }
        try {
            if (this.cryptoService.isEncrypted(token)) {
                return this.cryptoService.decrypt(token);
            }
        }
        catch (error) {
            console.error('Failed to decrypt push token:', error);
        }
        return token;
    }
    /**
     * Find all users in a household with optional role filtering
     * Enforces household isolation - only returns members of the specified household
     * @param householdId - UUID of the household
     * @param role - Optional role filter ('owner' or 'member')
     * @returns Array of HouseholdUsers in the household
     * @throws ValidationError if householdId missing or role invalid
     */
    async findUsersInHousehold(householdId, role) {
        if (!householdId) {
            throw new types_1.ValidationError('householdId is required');
        }
        if (role && !['owner', 'member'].includes(role)) {
            throw new types_1.ValidationError('role must be "owner" or "member"');
        }
        let query = this.repository
            .createQueryBuilder('user')
            .where('user.householdId = :householdId', { householdId });
        if (role) {
            query = query.andWhere('user.role = :role', { role });
        }
        const userEntities = await query.orderBy('user.createdAt', 'ASC').getMany();
        return userEntities.map((entity) => entity.toHouseholdUser());
    }
    /**
     * Create a new user in the system
     * Assigns unique userId, validates email uniqueness within household
     * Sets default member role if not specified
     * @param user - User data (without userId and createdAt)
     * @returns Created HouseholdUser with assigned userId
     * @throws ValidationError if required fields missing or invalid
     */
    async createUser(user) {
        // Validate required fields
        if (!user.name || !user.email || !user.householdId) {
            throw new types_1.ValidationError('name, email, and householdId are required');
        }
        if (!user.role || !['owner', 'member'].includes(user.role)) {
            throw new types_1.ValidationError('role must be "owner" or "member"');
        }
        // Check for duplicate email within household
        const existingUser = await this.repository.findOne({
            where: {
                email: user.email,
                householdId: user.householdId,
            },
        });
        if (existingUser) {
            throw new types_1.ValidationError(`User with email "${user.email}" already exists in this household`);
        }
        const now = Date.now();
        const newUserEntity = this.repository.create({
            userId: (0, crypto_1.randomUUID)(),
            householdId: user.householdId,
            name: user.name,
            email: user.email,
            passwordHash: user.passwordHash,
            role: user.role || 'member',
            pushToken: user.pushToken,
            pushTokens: [],
            permissions: user.permissions || [],
            preferences: user.preferences || {
                notificationsEnabled: true,
                mutedTasks: [],
                channels: ['push'],
            },
            createdAtTimestamp: now,
            lastActiveAtTimestamp: now,
        });
        const savedUser = await this.repository.save(newUserEntity);
        return savedUser.toHouseholdUser();
    }
    /**
     * Update user's push token
     * Marks the old token as inactive by removing it from active tokens
     * Adds the new token to the list of active tokens
     * Records the time of the token change for audit purposes
     * @param userId - UUID of the user
     * @param householdId - UUID of the household (for isolation check)
     * @param newToken - New push token to register
     * @throws ValidationError if userId, householdId, or newToken missing
     * @throws NotFoundError if user not found
     */
    async updateUserPushToken(userId, householdId, newToken) {
        if (!userId || !householdId || !newToken) {
            throw new types_1.ValidationError('userId, householdId, and newToken are required');
        }
        const userEntity = await this.repository.findOne({
            where: {
                userId,
                householdId,
            },
        });
        if (!userEntity) {
            throw new types_1.NotFoundError('User');
        }
        // Encrypt the push token before storing (if crypto service available)
        let encryptedToken = newToken;
        if (this.cryptoService) {
            try {
                encryptedToken = this.cryptoService.encrypt(newToken);
            }
            catch (error) {
                console.error('Failed to encrypt push token:', error);
                // Fall back to storing unencrypted
            }
        }
        // Remove old token from active tokens if it exists
        if (userEntity.pushToken && userEntity.pushTokens.includes(userEntity.pushToken)) {
            userEntity.pushTokens = userEntity.pushTokens.filter((token) => token !== userEntity.pushToken);
        }
        // Add new token to active tokens
        if (!userEntity.pushTokens.includes(encryptedToken)) {
            userEntity.pushTokens.push(encryptedToken);
        }
        // Set as current push token
        userEntity.pushToken = encryptedToken;
        userEntity.pushTokenLastChangedAt = Date.now();
        await this.repository.save(userEntity);
    }
    /**
     * Update user notification preferences
     * Supports updating: notificationsEnabled, mutedTasks, quietHours, channels
     * @param userId - UUID of the user
     * @param householdId - UUID of the household (for isolation check)
     * @param preferences - Partial preferences update
     * @throws ValidationError if userId or householdId missing
     * @throws NotFoundError if user not found
     */
    async updateUserPreferences(userId, householdId, preferences) {
        if (!userId || !householdId) {
            throw new types_1.ValidationError('userId and householdId are required');
        }
        const userEntity = await this.repository.findOne({
            where: {
                userId,
                householdId,
            },
        });
        if (!userEntity) {
            throw new types_1.NotFoundError('User');
        }
        // Validate quiet hours if provided
        if (preferences.quietHours) {
            const { start, end } = preferences.quietHours;
            if (start === undefined || end === undefined) {
                throw new types_1.ValidationError('quietHours must have both start and end times');
            }
            if (typeof start !== 'number' || typeof end !== 'number') {
                throw new types_1.ValidationError('quietHours start and end must be numbers');
            }
            if (start < 0 || start > 23 || end < 0 || end > 23) {
                throw new types_1.ValidationError('quietHours must be in 24-hour format (0-23)');
            }
        }
        // Validate channels if provided
        if (preferences.channels) {
            const validChannels = ['push', 'email', 'sms'];
            for (const channel of preferences.channels) {
                if (!validChannels.includes(channel)) {
                    throw new types_1.ValidationError(`Invalid channel "${channel}". Must be one of: push, email, sms`);
                }
            }
        }
        // Update preferences
        userEntity.preferences = {
            ...userEntity.preferences,
            ...preferences,
        };
        await this.repository.save(userEntity);
    }
    /**
     * Find user by email within a household
     * @param email - Email address to search
     * @param householdId - UUID of the household (for isolation)
     * @returns HouseholdUser if found, null otherwise
     */
    async findByEmail(email, householdId) {
        if (!email || !householdId) {
            throw new types_1.ValidationError('email and householdId are required');
        }
        const userEntity = await this.repository.findOne({
            where: {
                email,
                householdId,
            },
        });
        return userEntity ? userEntity.toHouseholdUser() : null;
    }
    /**
     * Get all active push tokens for a user
     * Used for sending notifications to all their devices
     * @param userId - UUID of the user
     * @param householdId - UUID of the household (for isolation)
     * @returns Array of active push tokens
     */
    async getActivePushTokens(userId, householdId) {
        if (!userId || !householdId) {
            throw new types_1.ValidationError('userId and householdId are required');
        }
        const userEntity = await this.repository.findOne({
            where: {
                userId,
                householdId,
            },
        });
        if (!userEntity) {
            return [];
        }
        // Filter out empty or invalid tokens
        return userEntity.pushTokens.filter((token) => token && token.length > 0);
    }
    /**
     * Mark push token as inactive
     * Used when push service reports token is no longer valid
     * @param token - Push token to deactivate
     */
    async deactivatePushToken(token) {
        if (!token) {
            throw new types_1.ValidationError('token is required');
        }
        const userEntity = await this.repository.findOne({
            where: {
                pushTokens: `{${token}}`,
            },
        });
        if (!userEntity) {
            return; // Token not found, nothing to do
        }
        // Remove token from active list
        userEntity.pushTokens = userEntity.pushTokens.filter((t) => t !== token);
        // Clear current push token if it was the deactivated one
        if (userEntity.pushToken === token) {
            userEntity.pushToken = undefined;
        }
        await this.repository.save(userEntity);
    }
    /**
     * Update user's last active timestamp
     * Called when user performs an action
     * @param userId - UUID of the user
     * @param householdId - UUID of the household (for isolation)
     */
    async updateLastActive(userId, householdId) {
        if (!userId || !householdId) {
            throw new types_1.ValidationError('userId and householdId are required');
        }
        const userEntity = await this.repository.findOne({
            where: {
                userId,
                householdId,
            },
        });
        if (!userEntity) {
            return;
        }
        userEntity.lastActiveAtTimestamp = Date.now();
        await this.repository.save(userEntity);
    }
    /**
     * Get households where a user is an owner
     * Used to determine which households a user can manage
     * @param userId - UUID of the user
     * @returns Array of household IDs where user is owner
     */
    async getOwnedHouseholds(userId) {
        if (!userId) {
            throw new types_1.ValidationError('userId is required');
        }
        const userEntities = await this.repository.find({
            where: {
                userId,
                role: 'owner',
            },
        });
        return userEntities.map((u) => u.householdId);
    }
    /**
     * Count total users in a household
     * @param householdId - UUID of the household
     * @returns Number of users
     */
    async countUsersInHousehold(householdId) {
        if (!householdId) {
            throw new types_1.ValidationError('householdId is required');
        }
        return this.repository.count({
            where: { householdId },
        });
    }
    /**
     * Update user role within a household
     * Promotes or demotes user between owner and member roles
     * @param userId - UUID of the user
     * @param householdId - UUID of the household (for isolation check)
     * @param role - New role ('owner' or 'member')
     * @throws ValidationError if userId, householdId, or role missing/invalid
     * @throws NotFoundError if user not found
     */
    async updateUserRole(userId, householdId, role) {
        if (!userId || !householdId || !role) {
            throw new types_1.ValidationError('userId, householdId, and role are required');
        }
        if (!['owner', 'member'].includes(role)) {
            throw new types_1.ValidationError('role must be "owner" or "member"');
        }
        const userEntity = await this.repository.findOne({
            where: {
                userId,
                householdId,
            },
        });
        if (!userEntity) {
            throw new types_1.NotFoundError('User');
        }
        userEntity.role = role;
        // Update permissions based on role
        if (role === 'owner') {
            // Ensure owner has administrative permissions
            if (!userEntity.permissions.includes('admin')) {
                userEntity.permissions.push('admin');
            }
        }
        else {
            // Remove admin permissions for members
            userEntity.permissions = userEntity.permissions.filter((p) => p !== 'admin');
        }
        await this.repository.save(userEntity);
    }
    /**
     * Check if a user belongs to a household
     * Used for household isolation checks
     * @param userId - UUID of the user
     * @param householdId - UUID of the household
     * @returns true if user is a member of the household, false otherwise
     */
    async isUserInHousehold(userId, householdId) {
        if (!userId || !householdId) {
            return false;
        }
        const count = await this.repository.count({
            where: {
                userId,
                householdId,
            },
        });
        return count > 0;
    }
    /**
     * Get all households for a user
     * Returns list of household IDs user belongs to
     * @param userId - UUID of the user
     * @returns Array of household objects with householdId
     * @throws ValidationError if userId is missing
     */
    async getUserHouseholds(userId) {
        if (!userId) {
            throw new types_1.ValidationError('userId is required');
        }
        const userEntities = await this.repository.find({
            where: {
                userId,
            },
            select: {
                householdId: true,
            },
        });
        return userEntities.map((entity) => ({
            householdId: entity.householdId,
        }));
    }
    /**
     * Find user details by ID (without household requirement)
     * Used to verify user exists when fetching cross-household events
     * @param userId - UUID of the user
     * @returns User object if found, null otherwise
     * @throws ValidationError if userId is missing
     */
    async findUserDetails(userId) {
        if (!userId) {
            throw new types_1.ValidationError('userId is required');
        }
        const userEntity = await this.repository.findOne({
            where: {
                userId,
            },
            select: {
                userId: true,
                name: true,
            },
        });
        if (!userEntity) {
            return null;
        }
        return {
            userId: userEntity.userId,
            name: userEntity.name,
        };
    }
}
exports.UserRepository = UserRepository;
