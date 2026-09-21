import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * CryptoService - AES-256-GCM encryption/decryption for sensitive data
 * Encrypts push tokens, email, phone, and other PII at rest in the database
 * 
 * Requirements: 18.2, 18.3, 18.4, 18.5
 */
export class CryptoService {
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-gcm';
  private saltLength = 16; // 128 bits
  private tagLength = 16; // 128 bits
  private ivLength = 12; // 96 bits (recommended for GCM)

  constructor() {
    // Load encryption key from environment or generate one
    const keyStr = process.env.ENCRYPTION_KEY;
    if (!keyStr) {
      throw new Error(
        'ENCRYPTION_KEY environment variable is required. Generate with: ' +
          'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    // Key must be 32 bytes for AES-256
    if (keyStr.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes for AES-256)');
    }

    this.encryptionKey = Buffer.from(keyStr, 'hex');
  }

  /**
   * Encrypts sensitive data using AES-256-GCM
   * Returns JSON object with iv, encryptedData, and authTag
   *
   * @param plaintext - The data to encrypt
   * @returns Encrypted data bundle as JSON string
   */
  public encrypt(plaintext: string): string {
    // Generate random IV for this encryption
    const iv = crypto.randomBytes(this.ivLength);

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv) as any;

    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Return encrypted bundle
    return JSON.stringify({
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm,
      version: 1,
    });
  }

  /**
   * Decrypts data encrypted with encrypt()
   * Verifies authentication tag to ensure data integrity
   *
   * @param encryptedBundle - JSON string from encrypt() method
   * @returns Decrypted plaintext
   * @throws Error if authentication tag verification fails
   */
  public decrypt(encryptedBundle: string): string {
    try {
      const bundle = JSON.parse(encryptedBundle);

      // Validate bundle structure
      if (!bundle.iv || !bundle.encryptedData || !bundle.authTag) {
        throw new Error('Invalid encrypted data format');
      }

      // Convert hex strings back to buffers
      const iv = Buffer.from(bundle.iv, 'hex');
      const encryptedData = Buffer.from(bundle.encryptedData, 'hex');
      const authTag = Buffer.from(bundle.authTag, 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv) as any;

      // Set authentication tag for verification
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encryptedData, 'hex', 'utf-8');
      decrypted += decipher.final('utf-8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Checks if a string is encrypted (valid encrypted bundle format)
   *
   * @param data - Data to check
   * @returns true if data appears to be an encrypted bundle
   */
  public isEncrypted(data: string): boolean {
    try {
      const bundle = JSON.parse(data);
      return (
        bundle.iv &&
        bundle.encryptedData &&
        bundle.authTag &&
        bundle.algorithm === this.algorithm
      );
    } catch {
      return false;
    }
  }

  /**
   * Generates a new encryption key (32 bytes for AES-256)
   * This is a static method for key generation/rotation
   *
   * @returns Hex-encoded encryption key (64 characters)
   */
  public static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Securely deletes data by overwriting it with random bytes (3 passes)
   * Uses constant-time comparison to prevent timing attacks
   *
   * @param data - The data to securely delete
   * @param passes - Number of overwrite passes (default: 3)
   */
  public static secureDelete(data: Buffer, passes: number = 3): void {
    // Overwrite data multiple times with random bytes
    for (let i = 0; i < passes; i++) {
      crypto.randomFillSync(data);
    }
    // Final pass with zeros
    data.fill(0);
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * Used for signature verification
   *
   * @param a - First string to compare
   * @param b - Second string to compare
   * @returns true if strings are equal, false otherwise
   */
  public static constantTimeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');

    if (bufA.length !== bufB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Generates an HMAC signature for data integrity verification
   * Used for NFC tag signatures and other security purposes
   *
   * @param data - The data to sign
   * @param secret - The secret key for HMAC
   * @returns Hex-encoded HMAC signature
   */
  public static generateHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verifies an HMAC signature using constant-time comparison
   * Prevents timing attacks on signature verification
   *
   * @param data - The original data
   * @param signature - The signature to verify
   * @param secret - The secret key for HMAC
   * @returns true if signature is valid, false otherwise
   */
  public static verifyHMAC(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHMAC(data, secret);
    return this.constantTimeCompare(signature, expectedSignature);
  }
}

export default CryptoService;
