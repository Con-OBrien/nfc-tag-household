import crypto from 'crypto';
import { NFCTagData } from '../types';

/**
 * NFCReaderService - Handles NFC tag detection, data extraction, and HMAC signature validation
 * Provides secure validation of NFC tags to prevent spoofing attacks
 */
export class NFCReaderService {
  /**
   * Validates the HMAC signature of NFC tag data to ensure authenticity
   * Uses constant-time comparison to prevent timing attacks
   *
   * @param tagData - The NFC tag data to validate
   * @param householdSecret - The household-specific secret key for HMAC
   * @returns true if signature is valid, false otherwise
   *
   * Requirements: 1.3, 16.2, 16.5
   */
  public validateTagSignature(
    tagData: Omit<NFCTagData, 'signature'> & { signature?: string },
    householdSecret: string
  ): boolean {
    // If no signature provided, cannot validate
    if (!tagData.signature) {
      return false;
    }

    try {
      // Create signature data (all fields except signature itself)
      const { signature, ...dataToSign } = tagData;
      const signatureData = this.createSignatureData(dataToSign);

      // Calculate expected HMAC-SHA256
      const expectedSignature = crypto
        .createHmac('sha256', householdSecret)
        .update(signatureData)
        .digest('hex');

      // Use constant-time comparison to prevent timing attacks
      return this.constantTimeCompare(signature, expectedSignature);
    } catch (error) {
      // If any error occurs during validation, reject the signature
      return false;
    }
  }

  /**
   * Generates an HMAC signature for NFC tag data
   * Used when creating new NFC tags
   *
   * @param tagData - The NFC tag data to sign
   * @param householdSecret - The household-specific secret key
   * @returns The HMAC-SHA256 signature as hex string
   *
   * Requirements: 16.1, 16.4
   */
  public generateTagSignature(
    tagData: Omit<NFCTagData, 'signature'>,
    householdSecret: string
  ): string {
    const signatureData = this.createSignatureData(tagData);

    return crypto
      .createHmac('sha256', householdSecret)
      .update(signatureData)
      .digest('hex');
  }

  /**
   * Extracts and validates NFC tag data
   * Ensures data is properly formatted and contains required fields
   *
   * @param rawTagData - Raw data from NFC tag read
   * @returns Parsed NFCTagData if valid, null otherwise
   *
   * Requirements: 1.2, 1.5
   */
  public extractTagData(rawTagData: unknown): NFCTagData | null {
    try {
      // Handle both parsed objects and JSON strings
      let data: any = rawTagData;
      if (typeof rawTagData === 'string') {
        data = JSON.parse(rawTagData);
      }

      // Validate required fields
      if (!this.isValidTagData(data)) {
        return null;
      }

      return {
        tagId: String(data.tagId).trim(),
        taskId: String(data.taskId).trim(),
        timestamp: Number(data.timestamp),
        signature: data.signature ? String(data.signature).trim() : undefined,
      };
    } catch (error) {
      // Return null if any error occurs during extraction
      return null;
    }
  }

  /**
   * Validates the structure and content of NFC tag data
   * Checks for required fields and correct types
   *
   * @param data - The data to validate
   * @returns true if data is valid NFC tag data, false otherwise
   *
   * Requirements: 1.5
   */
  public isValidTagData(data: unknown): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const obj = data as any;

    // Check required fields
    if (!obj.tagId || !obj.taskId || !obj.timestamp) {
      return false;
    }

    // Check field types
    if (typeof obj.tagId !== 'string' || obj.tagId.trim().length === 0) {
      return false;
    }

    if (typeof obj.taskId !== 'string' || obj.taskId.trim().length === 0) {
      return false;
    }

    if (typeof obj.timestamp !== 'number' || !Number.isFinite(obj.timestamp)) {
      return false;
    }

    // Timestamp should be recent (within last 5 minutes)
    const now = Date.now();
    const fiveMinutesInMs = 5 * 60 * 1000;
    if (obj.timestamp > now || now - obj.timestamp > fiveMinutesInMs) {
      return false;
    }

    // Signature is optional but if provided should be a string
    if (obj.signature && typeof obj.signature !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Checks if a tag has been deactivated
   * In a real implementation, this would check against a database
   *
   * @param tagId - The tag ID to check
   * @param deactivatedTags - Set of deactivated tag IDs
   * @returns true if tag is active, false if deactivated
   *
   * Requirements: 16.6
   */
  public isTagActive(tagId: string, deactivatedTags: Set<string>): boolean {
    return !deactivatedTags.has(tagId);
  }

  /**
   * Creates a consistent signature data string from tag data
   * This is used for both signing and verification
   *
   * @param data - The NFC tag data to create signature data from
   * @returns Formatted string suitable for HMAC
   */
  private createSignatureData(data: Omit<NFCTagData, 'signature'>): string {
    // Create deterministic string by sorting fields
    // Format: tagId:taskId:timestamp
    return `${data.tagId}:${data.taskId}:${data.timestamp}`;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * Compares two strings without revealing their length through timing
   *
   * @param a - First string to compare
   * @param b - Second string to compare
   * @returns true if strings are equal, false otherwise
   *
   * Requirements: 16.5
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      // Use a dummy comparison to take consistent time
      try {
        crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
      } catch {
        // Ignore - just used for timing consistency
      }
      return false;
    }

    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch (error) {
      // If comparison fails (shouldn't happen with same length), return false
      return false;
    }
  }
}
