import { Router, Request, Response, NextFunction } from 'express';
import { NFCKeyController } from '../controllers/NFCKeyController';
import { authMiddleware } from '../middleware/auth';

/**
 * NFC Key Routes
 * Implements NFC tag security key management endpoints
 * Requirements: 16.1, 16.4, 16.6
 *
 * Protected routes (require authentication):
 * - POST /api/households/:householdId/nfc-keys - Generate new key
 * - GET /api/households/:householdId/nfc-keys - List keys (owners only)
 * - POST /api/households/:householdId/nfc-keys/rotate - Rotate key (owners only)
 * - POST /api/households/:householdId/nfc-tags/deactivate - Deactivate tag (owners only)
 */

const router = Router();
const nfcKeyController = new NFCKeyController();

/**
 * Middleware: Require authentication for all NFC key routes
 */
router.use(authMiddleware);

/**
 * POST /api/households/:householdId/nfc-keys
 * Generate a new NFC signing key for the household
 * Only household owners can generate new keys
 *
 * Response: 201 Created
 * {
 *   householdId: string,
 *   keyId: string,
 *   key: string (displayed only once),
 *   createdAt: number,
 *   status: "active"
 * }
 *
 * Requirements: 16.1, 16.4
 */
router.post(
  '/households/:householdId/nfc-keys',
  (req: Request, res: Response, next: NextFunction) => {
    nfcKeyController.generateNFCKey(req, res, next);
  }
);

/**
 * GET /api/households/:householdId/nfc-keys
 * List all NFC keys for the household (metadata only)
 * Only household owners can view key information
 *
 * Response: 200 OK
 * {
 *   householdId: string,
 *   keys: [
 *     {
 *       keyId: string,
 *       status: "active" | "rotated" | "retired",
 *       createdAt: number,
 *       rotatedAt?: number,
 *       tagsCount: number
 *     }
 *   ]
 * }
 *
 * Requirements: 16.1
 */
router.get(
  '/households/:householdId/nfc-keys',
  (req: Request, res: Response, next: NextFunction) => {
    nfcKeyController.listNFCKeys(req, res, next);
  }
);

/**
 * POST /api/households/:householdId/nfc-keys/rotate
 * Rotate the household's NFC signing key
 * All existing tags should be re-signed with new key
 * Only household owners can rotate keys
 *
 * Request body:
 * {
 *   oldKey: string (64-character hex string),
 *   tags?: Array (optional - tags to re-sign)
 * }
 *
 * Response: 200 OK
 * {
 *   householdId: string,
 *   newKey: string,
 *   rotatedTagCount: number,
 *   rotationTimestamp: number,
 *   message: string
 * }
 *
 * Requirements: 16.4, 16.6
 */
router.post(
  '/households/:householdId/nfc-keys/rotate',
  (req: Request, res: Response, next: NextFunction) => {
    nfcKeyController.rotateNFCKey(req, res, next);
  }
);

/**
 * POST /api/households/:householdId/nfc-tags/deactivate
 * Deactivate a specific NFC tag for this household
 * Requires householdKey to verify ownership
 * Only household owners can deactivate tags
 *
 * Request body:
 * {
 *   tagId: string,
 *   householdKey: string,
 *   reason?: string
 * }
 *
 * Response: 200 OK
 * {
 *   tagId: string,
 *   status: "deactivated",
 *   deactivatedAt: number
 * }
 *
 * Requirements: 16.4, 16.6
 */
router.post(
  '/households/:householdId/nfc-tags/deactivate',
  (req: Request, res: Response, next: NextFunction) => {
    nfcKeyController.deactivateTag(req, res, next);
  }
);

export default router;
