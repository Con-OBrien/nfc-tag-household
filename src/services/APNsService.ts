import { NotificationPayload } from '../types';

/**
 * APNsService - Apple Push Notification service integration for iOS push notifications
 *
 * Handles sending push notifications via Apple Push Notification service (APNs)
 * This is the primary notification service for iOS devices
 * 
 * Requirements: 5.3, 21.1, 21.2, 21.3
 */
export class APNsService {
  private certificatePath: string;
  private keyPath: string;
  private teamId: string;
  private keyId: string;
  private bundleId: string;
  private isInitialized: boolean = false;

  /**
   * Initialize APNsService with Apple certificate configuration
   * 
   * @param certificatePath - Path to APNs certificate file (from environment)
   * @param keyPath - Path to APNs private key file (from environment)
   * @param teamId - Apple Team ID
   * @param keyId - APNs Key ID
   * @param bundleId - iOS app bundle identifier
   * @throws Error if credentials are not configured
   */
  constructor(
    certificatePath?: string,
    keyPath?: string,
    teamId?: string,
    keyId?: string,
    bundleId?: string
  ) {
    this.certificatePath = certificatePath || process.env.APNS_CERTIFICATE_PATH || '';
    this.keyPath = keyPath || process.env.APNS_KEY_PATH || '';
    this.teamId = teamId || process.env.APPLE_TEAM_ID || '';
    this.keyId = keyId || process.env.APNS_KEY_ID || '';
    this.bundleId = bundleId || process.env.IOS_BUNDLE_ID || 'com.example.nfctag';

    // For Phase 4 mock implementation, we require at least the bundle ID
    // Real implementation would require all credentials
    if (!this.bundleId) {
      throw new Error('iOS bundle ID not configured. Set IOS_BUNDLE_ID environment variable.');
    }

    this.validateCredentials();
    this.isInitialized = true;
  }

  /**
   * Sends a push notification via Apple Push Notification service
   * 
   * @param pushToken - The APNs push token (device token) for the device
   * @param payload - Notification payload with title, body, and data
   * @returns true if delivery succeeded, false otherwise
   * @throws Error with specific classification for DeliveryRetryService
   * 
   * Requirements: 5.3, 5.4, 5.5
   */
  public async sendNotification(
    pushToken: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('APNsService not properly initialized. Missing APNs configuration.');
    }

    if (!pushToken) {
      throw new Error('Invalid APNs push token: token is empty');
    }

    if (!this.isValidAPNsToken(pushToken)) {
      throw new Error('Invalid APNs token format');
    }

    try {
      // Mock APNs delivery - in real implementation would call APNs HTTP/2 API
      return await this.simulateAPNsDelivery(pushToken, payload);
    } catch (error) {
      // Re-throw to allow DeliveryRetryService to classify the error
      throw this.handleAPNsError(error);
    }
  }

  /**
   * Validates APNs credentials are properly configured
   * 
   * @throws Error if credentials cannot be validated
   */
  private validateCredentials(): void {
    // In a real implementation, would:
    // 1. Check if certificate and key files exist
    // 2. Parse and validate certificate format (PEM)
    // 3. Verify certificate expiration and validity
    // 4. Initialize APNs connection (HTTP/2 with JWT authentication)
    
    // For Phase 4 mock implementation, we validate configuration structure
    if (!this.bundleId.includes('.')) {
      throw new Error('Invalid iOS bundle ID format. Expected format: com.example.appname');
    }

    // For real implementation, these would be required:
    // if (!this.teamId) {
    //   throw new Error('Apple Team ID not configured');
    // }
    // if (!this.keyId) {
    //   throw new Error('APNs Key ID not configured');
    // }

    console.log(`[APNs] Configuration validated for bundle: ${this.bundleId}`);
  }

  /**
   * Validates APNs token format
   * APNs tokens (device tokens) are 64-character hex strings
   * For testing, we allow tokens starting with 'test_fail_' followed by hex chars
   * 
   * @param token - The token to validate
   * @returns true if token format is valid, false otherwise
   */
  private isValidAPNsToken(token: string): boolean {
    // For testing: allow test_fail tokens for simulation
    if (token.startsWith('test_fail')) {
      return token.length === 64 && /^test_fail[a-z0-9]+$/i.test(token);
    }
    
    // APNs tokens are exactly 64 hex characters
    // Match both lowercase and uppercase hex digits
    return token.length === 64 && /^[a-f0-9]{64}$/i.test(token);
  }

  /**
   * Simulates APNs delivery for Phase 4 mock implementation
   * In production, this would call the actual APNs HTTP/2 API
   * 
   * @param pushToken - APNs push token (device token)
   * @param payload - Notification payload
   * @returns true if delivery simulated as successful
   */
  private async simulateAPNsDelivery(
    pushToken: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    // Simulate network latency
    await this.sleep(50);

    // For testing purposes, simulate occasional failures that will trigger retry logic
    // Tokens starting with 'test_fail' simulate failures
    if (pushToken.startsWith('test_fail')) {
      let failureType = '';
      
      // Determine failure type by checking token prefix pattern
      if (pushToken.startsWith('test_failexpir')) failureType = 'expired';
      else if (pushToken.startsWith('test_failauth')) failureType = 'auth';
      else if (pushToken.startsWith('test_failrate')) failureType = 'rate';
      else if (pushToken.startsWith('test_failinvalid')) failureType = 'invalid';
      else if (pushToken.startsWith('test_failunavail')) failureType = 'unavailable';
      
      switch (failureType) {
        case 'invalid':
          // APNs returns 400 Bad Request for invalid tokens
          throw new Error('Invalid APNs token format: Bad device token');
        case 'expired':
          // APNs returns 410 Gone for expired/unregistered tokens
          throw new Error('Token expired: Device token has expired');
        case 'rate':
          // APNs returns 429 Too Many Requests for rate limiting
          throw new Error('APNs rate limit exceeded: Too many requests to APNs');
        case 'unavailable':
          // APNs returns 503 Service Unavailable
          throw new Error('APNs service unavailable: Service temporarily down');
        case 'auth':
          // APNs returns 403 Forbidden for auth errors
          throw new Error('APNs authentication failed: Invalid APNs certificate or credentials');
        default:
          throw new Error('Unknown APNs error');
      }
    }

    console.log(`[APNs] Notification delivered to token (masked): ${this.maskToken(pushToken)}`);
    console.log(`[APNs] Payload: ${payload.title}`);

    return true;
  }

  /**
   * Handles APNs-specific errors and formats them for DeliveryRetryService classification
   * 
   * APNs HTTP/2 error responses:
   * - 400: Bad Request (malformed JSON or invalid token format)
   * - 401: Unauthorized (invalid credentials)
   * - 403: Forbidden (certificate issues)
   * - 410: Gone (token no longer valid/expired)
   * - 429: Too Many Requests (rate limit)
   * - 500: Internal Server Error (APNs server issue)
   * - 503: Service Unavailable (APNs maintenance)
   * 
   * @param error - The error from APNs operation
   * @returns Error with message formatted for classification
   */
  private handleAPNsError(error: unknown): Error {
    if (!(error instanceof Error)) {
      return new Error('APNs delivery failed: Unknown error');
    }

    const message = error.message.toLowerCase();

    // Token errors - permanent failures (410 Gone, 400 Bad Request)
    if (message.includes('expired') || message.includes('gone')) {
      return new Error(`Token expired in APNs: ${error.message}`);
    }

    if (message.includes('invalid') && message.includes('token')) {
      return new Error(`Invalid APNs token: ${error.message}`);
    }

    if (message.includes('bad') && message.includes('device')) {
      return new Error(`Invalid APNs token: ${error.message}`);
    }

    if (message.includes('unregistered')) {
      return new Error(`Token not found in APNs: ${error.message}`);
    }

    // Authentication/Authorization errors (401, 403) - permanent
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('certificate') ||
      message.includes('credentials')
    ) {
      return new Error(`APNs authentication failed: ${error.message}`);
    }

    // Rate limiting (429) - temporary (will retry)
    if (message.includes('rate') || message.includes('throttl') || message.includes('429')) {
      return new Error(`APNs rate limit: ${error.message}`);
    }

    // Service unavailability (503, 500) - temporary
    if (message.includes('unavailable') || message.includes('service') || message.includes('500')) {
      return new Error(`APNs service unavailable: ${error.message}`);
    }

    // Network errors - temporary
    if (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    ) {
      return new Error(`APNs network error: ${error.message}`);
    }

    // Default - treat as temporary failure
    return new Error(`APNs temporary failure: ${error.message}`);
  }

  /**
   * Masks sensitive APNs token for logging
   * Shows only first 8 and last 4 characters
   * 
   * @param token - The token to mask
   * @returns Masked token for safe logging
   */
  private maskToken(token: string): string {
    if (token.length <= 12) {
      return '***';
    }
    return token.substring(0, 8) + '...' + token.substring(token.length - 4);
  }

  /**
   * Utility function to sleep for a specified duration
   * 
   * @param ms - Milliseconds to sleep
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if APNsService is properly initialized
   * 
   * @returns true if service is initialized and ready to send notifications
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get the configured bundle ID
   * 
   * @returns iOS app bundle identifier
   */
  public getBundleId(): string {
    return this.bundleId;
  }
}
