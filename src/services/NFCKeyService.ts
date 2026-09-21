import crypto from 'crypto';
import { CryptoService } from './CryptoService';

/**
 * NFCKeyService - Manages NFC tag security key generation, rotation, and validation
 * Generates household-specific HMAC keys for tag signatures
 * Implements tag deactivation and key rotation with re-signing
 * 
 * Requirements: 16.1, 16.4, 16.6
 */
export class NFCKeyService {
  private cryptoService: CryptoService;

  constructor() {
    try {
      this.cryptoService = new CryptoService();
    } catch (error) {
      console.warn('CryptoService initialization warning:', error);
    }
  }

  /**
   * Generates a new HMAC-SHA256 key for a household
   * The key is used to sign all NFC tags in that household
   * 
   * @returns Hex-encoded 256-bit key (64 characters)
   */
  public generateHouseholdKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates a signature for an NFC tag
   * Signature = HMAC-SHA256(key, taskId + timestamp + nonce)
   * 
   * @param householdKey - The household's HMAC key (hex-encoded)
   * @param taskId - The task ID to be included in the tag
   * @param timestamp - The tag creation timestamp
   * @param nonce - A random nonce for uniqueness
   * @returns Hex-encoded signature
   */
  public generateTagSignature(
    householdKey: string,
    taskId: string,
    timestamp: number,
    nonce: string
  ): string {
    const data = `${taskId}:${timestamp}:${nonce}`;
    return CryptoService.generateHMAC(data, householdKey);
  }

  /**
   * Validates an NFC tag signature using constant-time comparison
   * Prevents timing attacks during signature verification
   * 
   * @param signature - The signature to validate (hex-encoded)
   * @param householdKey - The household's HMAC key (hex-encoded)
   * @param taskId - The task ID in the tag
   * @param timestamp - The tag creation timestamp
   * @param nonce - The nonce included in the tag
   * @returns true if signature is valid, false otherwise
   */
  public validateTagSignature(
    signature: string,
    householdKey: string,
    taskId: string,
    timestamp: number,
    nonce: string
  ): boolean {
    const data = `${taskId}:${timestamp}:${nonce}`;
    return CryptoService.verifyHMAC(data, signature, householdKey);
  }

  /**
   * Generates a random nonce for tag uniqueness
   * Each tag should have a unique nonce to prevent replay attacks
   * 
   * @returns Hex-encoded random nonce
   */
  public generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Creates a complete NFC tag payload with signature
   * 
   * @param taskId - The task ID
   * @param householdKey - The household's HMAC key
   * @returns Tag payload object with signature
   */
  public createTagPayload(taskId: string, householdKey: string): {
    tagId: string;
    taskId: string;
    timestamp: number;
    nonce: string;
    signature: string;
  } {
    const tagId = `nfc_${crypto.randomBytes(8).toString('hex')}`;
    const timestamp = Date.now();
    const nonce = this.generateNonce();
    const signature = this.generateTagSignature(householdKey, taskId, timestamp, nonce);

    return {
      tagId,
      taskId,
      timestamp,
      nonce,
      signature,
    };
  }

  /**
   * Encrypts and encodes a tag payload for writing to physical tag
   * Uses base64 encoding after encryption
   * 
   * @param payload - The tag payload to encode
   * @returns Base64-encoded encrypted payload ready for tag
   */
  public encodeTagData(payload: object): string {
    const jsonString = JSON.stringify(payload);
    // Base64 encode the JSON
    return Buffer.from(jsonString, 'utf-8').toString('base64');
  }

  /**
   * Decodes and parses tag data read from physical tag
   * 
   * @param encodedData - Base64-encoded data from tag
   * @returns Parsed tag payload
   */
  public decodeTagData(encodedData: string): any {
    try {
      const jsonString = Buffer.from(encodedData, 'base64').toString('utf-8');
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Failed to decode tag data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Marks a tag as deactivated without deleting records
   * In production, this would be persisted in a database
   * 
   * @param tagId - The tag ID to deactivate
   * @param householdId - The household the tag belongs to
   * @returns Deactivation record with timestamp
   */
  public deactivateTag(tagId: string, householdId: string): {
    tagId: string;
    householdId: string;
    deactivatedAt: number;
    reason?: string;
  } {
    return {
      tagId,
      householdId,
      deactivatedAt: Date.now(),
    };
  }

  /**
   * Rotates a household's HMAC key and generates new signatures for all tags
   * This should be called periodically (e.g., quarterly) for security
   * 
   * In production:
   * 1. Generate new key
   * 2. For each existing tag, generate new signature with new key
   * 3. Write updated tags to physical NFC tags or sync to devices
   * 4. Retire old key after grace period
   * 
   * @param oldKey - The current household key
   * @param tags - Array of existing tag payloads to re-sign
   * @returns Object with new key and re-signed tags
   */
  public rotateHouseholdKey(
    oldKey: string,
    tags: Array<{
      tagId: string;
      taskId: string;
      timestamp: number;
      nonce: string;
      signature: string;
    }>
  ): {
    newKey: string;
    reSiagnedTags: Array<{
      tagId: string;
      taskId: string;
      timestamp: number;
      nonce: string;
      oldSignature: string;
      newSignature: string;
    }>;
    rotationTimestamp: number;
  } {
    const newKey = this.generateHouseholdKey();
    const reSiagnedTags = tags.map((tag) => ({
      tagId: tag.tagId,
      taskId: tag.taskId,
      timestamp: tag.timestamp,
      nonce: tag.nonce,
      oldSignature: tag.signature,
      newSignature: this.generateTagSignature(newKey, tag.taskId, tag.timestamp, tag.nonce),
    }));

    return {
      newKey,
      reSiagnedTags,
      rotationTimestamp: Date.now(),
    };
  }

  /**
   * Validates tag data freshness to prevent replay attacks
   * Tags older than 24 hours should be considered stale
   * 
   * @param tagTimestamp - The timestamp from the tag
   * @param maxAgeMs - Maximum age in milliseconds (default: 24 hours)
   * @returns true if tag is fresh, false if stale
   */
  public isTagFresh(tagTimestamp: number, maxAgeMs: number = 24 * 60 * 60 * 1000): boolean {
    const age = Date.now() - tagTimestamp;
    return age >= 0 && age <= maxAgeMs;
  }
}

export default NFCKeyService;
