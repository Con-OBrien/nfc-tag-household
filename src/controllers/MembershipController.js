"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipController = void 0;
const HouseholdRepository_1 = require("../repositories/HouseholdRepository");
const UserRepository_1 = require("../repositories/UserRepository");
const types_1 = require("../types");
/**
 * MembershipController - Handles household member management operations
 * Implements user invitation, role management, and removal with access control
 */
class MembershipController {
    constructor() {
        this.householdRepository = new HouseholdRepository_1.HouseholdRepository();
        this.userRepository = new UserRepository_1.UserRepository();
    }
    /**
     * POST /api/households/:householdId/members/invite
     * Invite a user to a household with default member role
     * Only household owners can invite new members
     *
     * Request: { email: string }
     * Response: { memberId, userId, email, role: 'member', joinedAt, invitedBy }
     */
    async inviteUser(req, res, next) {
        try {
            const householdId = Array.isArray(req.params.householdId)
                ? req.params.householdId[0]
                : req.params.householdId;
            const { email } = req.body;
            const requesterId = req.userId; // Set by auth middleware
            // Validate input
            if (!householdId) {
                throw new types_1.ValidationError('householdId is required');
            }
            if (!email) {
                throw new types_1.ValidationError('email is required');
            }
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new types_1.ValidationError('Invalid email format');
            }
            if (!requesterId) {
                throw new types_1.ValidationError('User authentication required');
            }
            // Verify household exists
            const household = await this.householdRepository.getHouseholdInfo(householdId);
            if (!household) {
                throw new types_1.NotFoundError('Household');
            }
            // Verify requester is in household
            const isUserInHousehold = await this.householdRepository.isUserInHousehold(requesterId, householdId);
            if (!isUserInHousehold) {
                throw new types_1.ForbiddenError('You are not a member of this household');
            }
            // Verify requester is owner (required to invite)
            const isOwner = await this.householdRepository.isUserOwner(requesterId, householdId);
            if (!isOwner) {
                throw new types_1.ForbiddenError('Only household owners can invite members');
            }
            // Check if user already exists in household
            const existingUser = await this.userRepository.findByEmail(email, householdId);
            if (existingUser) {
                throw new types_1.ValidationError(`User with email "${email}" is already a member of this household`);
            }
            // Create new user account
            const passwordHash = ''; // Will be set during user signup
            const now = Date.now();
            const newUser = await this.userRepository.createUser({
                householdId,
                name: email.split('@')[0], // Use email prefix as default name
                email,
                passwordHash,
                role: 'member', // Default role for invited users
                pushToken: undefined,
                permissions: ['task.execute'],
                preferences: {
                    notificationsEnabled: true,
                    mutedTasks: [],
                    channels: ['push'],
                },
            });
            // Return invitation response
            res.status(201).json({
                success: true,
                data: {
                    memberId: newUser.userId,
                    userId: newUser.userId,
                    email: newUser.email,
                    name: newUser.name,
                    role: newUser.role,
                    joinedAt: newUser.createdAt,
                    invitedBy: requesterId,
                },
                timestamp: Date.now(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /api/households/:householdId/members/:memberId/role
     * Change a user's role within the household
     * Only owners can change roles
     * Prevent removing the last owner
     *
     * Request: { role: 'owner' | 'member' }
     * Response: { memberId, userId, role, updatedAt }
     */
    async updateUserRole(req, res, next) {
        try {
            const householdId = Array.isArray(req.params.householdId)
                ? req.params.householdId[0]
                : req.params.householdId;
            const memberId = Array.isArray(req.params.memberId)
                ? req.params.memberId[0]
                : req.params.memberId;
            const { role } = req.body;
            const requesterId = req.userId; // Set by auth middleware
            // Validate input
            if (!householdId || !memberId) {
                throw new types_1.ValidationError('householdId and memberId are required');
            }
            if (!role) {
                throw new types_1.ValidationError('role is required');
            }
            if (!['owner', 'member'].includes(role)) {
                throw new types_1.ValidationError('role must be "owner" or "member"');
            }
            if (!requesterId) {
                throw new types_1.ValidationError('User authentication required');
            }
            // Verify household exists
            const household = await this.householdRepository.getHouseholdInfo(householdId);
            if (!household) {
                throw new types_1.NotFoundError('Household');
            }
            // Verify requester is in household
            const isRequesterInHousehold = await this.householdRepository.isUserInHousehold(requesterId, householdId);
            if (!isRequesterInHousehold) {
                throw new types_1.ForbiddenError('You are not a member of this household');
            }
            // Verify requester is owner (required to change roles)
            const isRequesterOwner = await this.householdRepository.isUserOwner(requesterId, householdId);
            if (!isRequesterOwner) {
                throw new types_1.ForbiddenError('Only household owners can change member roles');
            }
            // Verify member exists in household
            const member = await this.userRepository.findUserById(memberId, householdId);
            if (!member) {
                throw new types_1.NotFoundError('Household member');
            }
            // Prevent removing the last owner
            if (member.role === 'owner' && role === 'member') {
                const owners = await this.householdRepository.getHouseholdOwners(householdId);
                if (owners.length === 1) {
                    throw new types_1.ValidationError('Cannot remove the last owner from a household');
                }
            }
            // Update the user role
            await this.userRepository.updateUserRole(memberId, householdId, role);
            // Get updated user info
            const updatedMember = await this.userRepository.findUserById(memberId, householdId);
            // Return success response
            res.json({
                success: true,
                data: {
                    memberId: updatedMember.userId,
                    userId: updatedMember.userId,
                    email: updatedMember.email,
                    role: updatedMember.role,
                    updatedAt: Date.now(),
                },
                timestamp: Date.now(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * DELETE /api/households/:householdId/members/:memberId
     * Remove a user from the household
     * Only owners can remove members
     * Prevent removing the last owner
     * Revokes all access to household tasks
     * Preserves event history for audit
     *
     * Response: 204 No Content on success
     */
    async removeMember(req, res, next) {
        try {
            const householdId = Array.isArray(req.params.householdId)
                ? req.params.householdId[0]
                : req.params.householdId;
            const memberId = Array.isArray(req.params.memberId)
                ? req.params.memberId[0]
                : req.params.memberId;
            const requesterId = req.userId; // Set by auth middleware
            // Validate input
            if (!householdId || !memberId) {
                throw new types_1.ValidationError('householdId and memberId are required');
            }
            if (!requesterId) {
                throw new types_1.ValidationError('User authentication required');
            }
            // Verify household exists
            const household = await this.householdRepository.getHouseholdInfo(householdId);
            if (!household) {
                throw new types_1.NotFoundError('Household');
            }
            // Verify requester is in household
            const isRequesterInHousehold = await this.householdRepository.isUserInHousehold(requesterId, householdId);
            if (!isRequesterInHousehold) {
                throw new types_1.ForbiddenError('You are not a member of this household');
            }
            // Verify requester is owner (required to remove members)
            const isRequesterOwner = await this.householdRepository.isUserOwner(requesterId, householdId);
            if (!isRequesterOwner) {
                throw new types_1.ForbiddenError('Only household owners can remove members');
            }
            // Verify member exists in household
            const member = await this.userRepository.findUserById(memberId, householdId);
            if (!member) {
                throw new types_1.NotFoundError('Household member');
            }
            // Prevent removing the last owner
            if (member.role === 'owner') {
                const owners = await this.householdRepository.getHouseholdOwners(householdId);
                if (owners.length === 1) {
                    throw new types_1.ValidationError('Cannot remove the last owner from a household');
                }
            }
            // Remove user from household
            // This revokes all access to household tasks
            await this.householdRepository.removeUserFromHousehold(householdId, memberId);
            // Return 204 No Content on success
            res.status(204).send();
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/households/:householdId/members
     * Get all members of a household
     * Only household members can view member list
     *
     * Response: { members: HouseholdUser[] }
     */
    async getHouseholdMembers(req, res, next) {
        try {
            const householdId = Array.isArray(req.params.householdId)
                ? req.params.householdId[0]
                : req.params.householdId;
            const requesterId = req.userId; // Set by auth middleware
            // Validate input
            if (!householdId) {
                throw new types_1.ValidationError('householdId is required');
            }
            if (!requesterId) {
                throw new types_1.ValidationError('User authentication required');
            }
            // Verify household exists
            const household = await this.householdRepository.getHouseholdInfo(householdId);
            if (!household) {
                throw new types_1.NotFoundError('Household');
            }
            // Verify requester is in household (household isolation)
            const isUserInHousehold = await this.householdRepository.isUserInHousehold(requesterId, householdId);
            if (!isUserInHousehold) {
                throw new types_1.ForbiddenError('You are not a member of this household');
            }
            // Get all members
            const members = await this.householdRepository.getHouseholdMembers(householdId);
            // Return members list
            res.json({
                success: true,
                data: {
                    householdId,
                    members: members.map((member) => ({
                        userId: member.userId,
                        name: member.name,
                        email: member.email,
                        role: member.role,
                        createdAt: member.createdAt,
                        lastActiveAt: member.lastActiveAt,
                    })),
                    memberCount: members.length,
                },
                timestamp: Date.now(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/households/:householdId/members/:memberId
     * Get details of a specific household member
     * Only household members can view member details
     *
     * Response: { userId, name, email, role, createdAt, lastActiveAt }
     */
    async getMemberDetails(req, res, next) {
        try {
            const householdId = Array.isArray(req.params.householdId)
                ? req.params.householdId[0]
                : req.params.householdId;
            const memberId = Array.isArray(req.params.memberId)
                ? req.params.memberId[0]
                : req.params.memberId;
            const requesterId = req.userId; // Set by auth middleware
            // Validate input
            if (!householdId || !memberId) {
                throw new types_1.ValidationError('householdId and memberId are required');
            }
            if (!requesterId) {
                throw new types_1.ValidationError('User authentication required');
            }
            // Verify household exists
            const household = await this.householdRepository.getHouseholdInfo(householdId);
            if (!household) {
                throw new types_1.NotFoundError('Household');
            }
            // Verify requester is in household (household isolation)
            const isUserInHousehold = await this.householdRepository.isUserInHousehold(requesterId, householdId);
            if (!isUserInHousehold) {
                throw new types_1.ForbiddenError('You are not a member of this household');
            }
            // Get member details
            const member = await this.userRepository.findUserById(memberId, householdId);
            if (!member) {
                throw new types_1.NotFoundError('Household member');
            }
            // Return member details
            res.json({
                success: true,
                data: {
                    userId: member.userId,
                    name: member.name,
                    email: member.email,
                    role: member.role,
                    createdAt: member.createdAt,
                    lastActiveAt: member.lastActiveAt,
                },
                timestamp: Date.now(),
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.MembershipController = MembershipController;
