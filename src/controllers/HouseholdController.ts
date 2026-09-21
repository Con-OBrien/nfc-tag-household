import { Request, Response, NextFunction } from 'express';
import { HouseholdRepository } from '../repositories/HouseholdRepository';
import { UserRepository } from '../repositories/UserRepository';
import { ValidationError, ForbiddenError, NotFoundError, CreateHouseholdRequest, ApiResponse, Household } from '../types';

/**
 * HouseholdController - Handles all household-related HTTP requests
 * Requirements: 8.1, 8.2, 20.1, 20.2
 *
 * Manages:
 * - Household creation with creator as initial owner
 * - Household information retrieval with isolation checks
 * - Default task categories initialization
 * - Household settings initialization
 */
export class HouseholdController {
  private householdRepository: HouseholdRepository;
  private userRepository: UserRepository;

  constructor() {
    this.householdRepository = new HouseholdRepository();
    this.userRepository = new UserRepository();
  }

  /**
   * POST /api/households
   * Create a new household
   *
   * Request body:
   * {
   *   name: string (required, 1-255 characters)
   *   description?: string
   * }
   *
   * Response:
   * {
   *   householdId: string,
   *   name: string,
   *   createdBy: string,
   *   createdAt: number,
   *   members: string[],
   *   taskCategories: string[],
   *   settings: object
   * }
   *
   * Requirements: 8.1, 8.2, 20.1, 20.2
   */
  async createHousehold(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract user ID from authenticated request (assumes middleware sets req.userId)
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      // Parse and validate request body
      const { name } = req.body as CreateHouseholdRequest;

      // Validate name is provided
      if (!name) {
        throw new ValidationError('Household name is required');
      }

      // Validate name length
      if (typeof name !== 'string' || name.length < 1 || name.length > 255) {
        throw new ValidationError('Household name must be between 1 and 255 characters');
      }

      // Check for duplicate household name by same creator
      const existing = await this.householdRepository.findByCreatorAndName(userId, name);
      if (existing) {
        throw new ValidationError(
          `Household with name "${name}" already exists for this user`,
          { code: 'HOUSEHOLD_NAME_DUPLICATE' }
        );
      }

      // Create the household
      const household = await this.householdRepository.createHousehold(name, userId);

      // Return success response
      const response: ApiResponse<Household> = {
        success: true,
        data: household,
        timestamp: Date.now(),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/households/:householdId
   * Get household information with member list and settings
   *
   * Path params:
   * - householdId: UUID of household
   *
   * Response:
   * {
   *   householdId: string,
   *   name: string,
   *   createdBy: string,
   *   createdAt: number,
   *   members: string[],
   *   taskCategories: string[],
   *   settings: object
   * }
   *
   * Requirements: 6.1, 8.1, 20.1
   */
  async getHousehold(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract user ID from authenticated request
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      // Extract householdId from URL parameters
      const householdId = req.params.householdId as string;

      if (!householdId) {
        throw new ValidationError('householdId is required');
      }

      // Verify user is member of household (household isolation)
      const isUserInHousehold = await this.householdRepository.isUserInHousehold(
        userId,
        householdId
      );

      if (!isUserInHousehold) {
        throw new ForbiddenError('User does not have access to this household');
      }

      // Retrieve household info
      const household = await this.householdRepository.getHouseholdInfo(householdId);

      if (!household) {
        throw new NotFoundError('Household');
      }

      // Return success response
      const response: ApiResponse<Household> = {
        success: true,
        data: household,
        timestamp: Date.now(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Middleware to verify user is authenticated
   * Sets req.userId from token or session
   * Requirements: Prerequisite for all endpoints
   */
  static authenticateUser(req: Request, res: Response, next: NextFunction): void {
    try {
      // Extract userId from request (should be set by auth middleware)
      const userId = (req as any).userId;

      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}

export default HouseholdController;
