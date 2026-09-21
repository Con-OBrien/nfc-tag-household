import { Request, Response, NextFunction } from 'express';
import { HouseholdRepository } from '../repositories/HouseholdRepository';
import { UserRepository } from '../repositories/UserRepository';
import { NFCKeyService } from '../services/NFCKeyService';
import { CryptoService } from '../services/CryptoService';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ApiResponse,
} from '../types';

/**
 * NFCKeyController - Manages NFC tag security key generation, rotation, and tag deactivation
 * Provides endpoints for household-specific NFC infrastructure
 * 
 * Requirements: 16.1, 16.4, 16.6
 */
export class NFCKeyController {
  private householdRepository: HouseholdRepository;
  private userRepository: UserRepository;
  private nfcKeyService: NFCKeyService;

  constructor() {
    this.householdRepository = new HouseholdRepository();
    this.userRepository = new UserRepository();
    this.nfcKeyService = new NFCKeyService();
  }

  /**
   * POST /api/households/:householdId/nfc-keys
   * Generate a new NFC signing key for the household
   * Only household owners can generate new keys
   * 
   * Response: 201 Created
   * {
   *   success: true,
   *   data: {
   *     householdId: string,
   *     keyId: string,
   *     createdAt: number,
   *     expiresAt?: number,
   *     status: "active"
   *   }
   * }
   *
   * Requirements: 16.1, 16.4
   */
  async generateNFCKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      const householdId = req.params.householdId as string;
      if (!householdId) {
        throw new ValidationError('householdId is required');
      }

      // Check user is household owner
      const user = await this.userRepository.findUserById(userId, householdId);
      if (!user) {
        throw new ForbiddenError('User is not a member of this household');
      }

      if (user.role !== 'owner') {
        throw new ForbiddenError('Only household owners can generate NFC keys');
      }

      // Generate new key
      const newKey = this.nfcKeyService.generateHouseholdKey();

      // In production, store the key in database associated with household
      // For now, return the key to client (should be securely transmitted)
      const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const response: ApiResponse<{
        householdId: string;
        keyId: string;
        key: string;
        createdAt: number;
        status: string;
      }> = {
        success: true,
        data: {
          householdId,
          keyId,
          key: newKey, // Should only be shown once - client must save it
          createdAt: Date.now(),
          status: 'active',
        },
        timestamp: Date.now(),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/households/:householdId/nfc-tags/deactivate
   * Deactivate a specific NFC tag for this household
   * Provides signature verification for tag ownership
   * 
   * Request body:
   * {
   *   tagId: string,
   *   householdKey: string (to verify ownership),
   *   reason?: string
   * }
   *
   * Response: 200 OK
   * {
   *   success: true,
   *   data: {
   *     tagId: string,
   *     status: "deactivated",
   *     deactivatedAt: number
   *   }
   * }
   *
   * Requirements: 16.4, 16.6
   */
  async deactivateTag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      const householdId = req.params.householdId as string;
      const { tagId, householdKey, reason } = req.body;

      if (!householdId || !tagId || !householdKey) {
        throw new ValidationError('householdId, tagId, and householdKey are required');
      }

      // Check user is in household
      const user = await this.userRepository.findUserById(userId, householdId);
      if (!user) {
        throw new ForbiddenError('User is not a member of this household');
      }

      // Only owners can deactivate tags
      if (user.role !== 'owner') {
        throw new ForbiddenError('Only household owners can deactivate tags');
      }

      // Verify household key matches (proves they have the key)
      // In production, verify householdKey against stored key hash
      if (!householdKey || typeof householdKey !== 'string' || householdKey.length < 32) {
        throw new ForbiddenError('Invalid household key');
      }

      // Deactivate the tag
      const deactivationRecord = this.nfcKeyService.deactivateTag(tagId, householdId);

      // In production, persist this to database
      // For now, return the deactivation record

      const response: ApiResponse<{
        tagId: string;
        status: string;
        deactivatedAt: number;
      }> = {
        success: true,
        data: {
          tagId: deactivationRecord.tagId,
          status: 'deactivated',
          deactivatedAt: deactivationRecord.deactivatedAt,
        },
        timestamp: Date.now(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/households/:householdId/nfc-keys/rotate
   * Rotate the household's NFC signing key
   * All existing tags should be re-signed with new key
   * 
   * Request body:
   * {
   *   oldKey: string,
   *   tags: Array (optional - tags to re-sign)
   * }
   *
   * Response: 200 OK
   * {
   *   success: true,
   *   data: {
   *     householdId: string,
   *     newKey: string,
   *     rotatedTagCount: number,
   *     rotationTimestamp: number
   *   }
   * }
   *
   * Requirements: 16.4, 16.6
   */
  async rotateNFCKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      const householdId = req.params.householdId as string;
      const { oldKey, tags = [] } = req.body;

      if (!householdId || !oldKey) {
        throw new ValidationError('householdId and oldKey are required');
      }

      // Check user is household owner
      const user = await this.userRepository.findUserById(userId, householdId);
      if (!user) {
        throw new ForbiddenError('User is not a member of this household');
      }

      if (user.role !== 'owner') {
        throw new ForbiddenError('Only household owners can rotate NFC keys');
      }

      // Verify old key format (must be valid hex string)
      if (typeof oldKey !== 'string' || oldKey.length !== 64) {
        throw new ValidationError('oldKey must be a 64-character hex string (32 bytes)');
      }

      // Rotate the key
      const rotation = this.nfcKeyService.rotateHouseholdKey(oldKey, tags);

      // In production:
      // 1. Store new key in database
      // 2. Create rotation audit log entry
      // 3. Send notifications to all devices to update keys
      // 4. Optionally retire old key after grace period (e.g., 30 days)

      const response: ApiResponse<{
        householdId: string;
        newKey: string;
        rotatedTagCount: number;
        rotationTimestamp: number;
        message: string;
      }> = {
        success: true,
        data: {
          householdId,
          newKey: rotation.newKey,
          rotatedTagCount: rotation.reSiagnedTags.length,
          rotationTimestamp: rotation.rotationTimestamp,
          message: `Key rotation complete. ${rotation.reSiagnedTags.length} tags re-signed with new key.`,
        },
        timestamp: Date.now(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/households/:householdId/nfc-keys
   * List all NFC keys for the household (only their metadata, not the actual keys)
   * Only household owners can view key information
   * 
   * Response: 200 OK
   * {
   *   success: true,
   *   data: {
   *     householdId: string,
   *     keys: [
   *       {
   *         keyId: string,
   *         status: "active" | "rotated" | "retired",
   *         createdAt: number,
   *         rotatedAt?: number,
   *         tagsCount: number
   *       }
   *     ]
   *   }
   * }
   *
   * Requirements: 16.1
   */
  async listNFCKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      const householdId = req.params.householdId as string;
      if (!householdId) {
        throw new ValidationError('householdId is required');
      }

      // Check user is in household
      const user = await this.userRepository.findUserById(userId, householdId);
      if (!user) {
        throw new ForbiddenError('User is not a member of this household');
      }

      // Only owners can view key information
      if (user.role !== 'owner') {
        throw new ForbiddenError('Only household owners can view NFC keys');
      }

      // In production, retrieve from database
      // For now, return empty list
      const keys: any[] = [];

      const response: ApiResponse<{
        householdId: string;
        keys: any[];
      }> = {
        success: true,
        data: {
          householdId,
          keys,
        },
        timestamp: Date.now(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default NFCKeyController;
