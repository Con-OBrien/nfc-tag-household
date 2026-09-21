"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMembershipRoutes = createMembershipRoutes;
const express_1 = require("express");
const MembershipController_1 = require("./MembershipController");
/**
 * Membership Routes
 * Handles user invitation, role management, and removal
 */
function createMembershipRoutes() {
    const router = (0, express_1.Router)({ mergeParams: true });
    const controller = new MembershipController_1.MembershipController();
    // Simple authentication middleware placeholder
    // In a real app, this would verify JWT or session tokens
    const requireAuth = (req, res, next) => {
        // This is a placeholder - real implementation would verify JWT token
        const userId = req.headers['x-user-id'] || 'test-user-id';
        req.userId = userId;
        next();
    };
    // Apply auth middleware to all routes
    router.use(requireAuth);
    /**
     * POST /api/households/:householdId/members/invite
     * Invite a user to a household
     */
    router.post('/:householdId/members/invite', (req, res, next) => {
        controller.inviteUser(req, res, next);
    });
    /**
     * PATCH /api/households/:householdId/members/:memberId/role
     * Update a member's role
     */
    router.patch('/:householdId/members/:memberId/role', (req, res, next) => {
        controller.updateUserRole(req, res, next);
    });
    /**
     * DELETE /api/households/:householdId/members/:memberId
     * Remove a member from the household
     */
    router.delete('/:householdId/members/:memberId', (req, res, next) => {
        controller.removeMember(req, res, next);
    });
    /**
     * GET /api/households/:householdId/members
     * Get all members of a household
     */
    router.get('/:householdId/members', (req, res, next) => {
        controller.getHouseholdMembers(req, res, next);
    });
    /**
     * GET /api/households/:householdId/members/:memberId
     * Get details of a specific member
     */
    router.get('/:householdId/members/:memberId', (req, res, next) => {
        controller.getMemberDetails(req, res, next);
    });
    return router;
}
