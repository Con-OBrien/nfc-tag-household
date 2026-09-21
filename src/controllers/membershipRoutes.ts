import { Router, Request, Response, NextFunction } from 'express';
import { MembershipController } from './MembershipController';

/**
 * Membership Routes
 * Handles user invitation, role management, and removal
 */
export function createMembershipRoutes(): Router {
  const router = Router({ mergeParams: true });
  const controller = new MembershipController();

  // Simple authentication middleware placeholder
  // In a real app, this would verify JWT or session tokens
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    // This is a placeholder - real implementation would verify JWT token
    const userId = req.headers['x-user-id'] as string || 'test-user-id';
    (req as any).userId = userId;
    next();
  };

  // Apply auth middleware to all routes
  router.use(requireAuth);

  /**
   * POST /api/households/:householdId/members/invite
   * Invite a user to a household
   */
  router.post('/:householdId/members/invite', (req: Request, res: Response, next: NextFunction) => {
    controller.inviteUser(req, res, next);
  });

  /**
   * PATCH /api/households/:householdId/members/:memberId/role
   * Update a member's role
   */
  router.patch(
    '/:householdId/members/:memberId/role',
    (req: Request, res: Response, next: NextFunction) => {
      controller.updateUserRole(req, res, next);
    }
  );

  /**
   * DELETE /api/households/:householdId/members/:memberId
   * Remove a member from the household
   */
  router.delete(
    '/:householdId/members/:memberId',
    (req: Request, res: Response, next: NextFunction) => {
      controller.removeMember(req, res, next);
    }
  );

  /**
   * GET /api/households/:householdId/members
   * Get all members of a household
   */
  router.get('/:householdId/members', (req: Request, res: Response, next: NextFunction) => {
    controller.getHouseholdMembers(req, res, next);
  });

  /**
   * GET /api/households/:householdId/members/:memberId
   * Get details of a specific member
   */
  router.get(
    '/:householdId/members/:memberId',
    (req: Request, res: Response, next: NextFunction) => {
      controller.getMemberDetails(req, res, next);
    }
  );

  return router;
}
