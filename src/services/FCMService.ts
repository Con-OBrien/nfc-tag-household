import { NotificationPayload } from '../types';

/**
 * FCMService - Firebase Cloud Messaging integration for Android push notifications
 *
 * Handles sending push notifications via Firebase Cloud Messaging (FCM)
 * This is the primary notification service for Android devices
 * 
 * Requirements: 5.3, 21.1, 21.2, 21.3
 */
export class FCMService {
  private projectId: string;
  private credentialsPath: string;
  private isInitialized: boolean = false;

  /**
   * Initialize FCMService with Firebase credentials
   * 
   * @param projectId - Firebase project ID from environment
   * @param credentialsPath - Path to Firebase service account credentials
   * @throws Error if credentials are not configured
   */
  constructor(projectId?: string, credentialsPath?: string) {
    this.projectId = projectId || process.env.FIREBASE_PROJECT_ID || '';
    this.credentialsPath = credentialsPath || process.env.FIREBASE_CREDENTIALS_PATH || '';

    if (!this.projectId) {
      throw new Error('Firebase project ID not configured. Set FIREBASE_PROJECT_ID environment variable.');
    }

    // In a real implementation, we would load and validate credentials here
    // For now, we simulate credential loading for Phase 4 (mock implementation)
    this.validateCredentials();
    this.isInitialized = true;
  }

  /**
   * Sends a push notification via Firebase Cloud Messaging
   * 
   * @param pushToken - The FCM push token for the device
   * @param payload - Notification payload with title, body, and data
   * @returns true if delivery succeeded, false otherwise
   * @throws Error with specific classification for DeliveryRetryService
   * 
   * Requirements: 5.3, 5.4, 5.5
   */
  public async sendMessage(
    pushToken: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('FCMService not properly initialized. Missing Firebase credentials.');
    }

    if (!pushToken) {
      throw new Error('Invalid FCM push token: token is empty');
    }

    if (!this.isValidFCMToken(pushToken)) {
      throw new Error('Invalid FCM token format');
    }

    try {
      // Mock FCM delivery - in real implementation would call admin.messaging().send()
      return await this.simulateFCMDelivery(pushToken, payload);
    } catch (error) {
      // Re-throw to allow DeliveryRetryService to classify the error
      throw this.handleFCMError(error);
    }
  }

  /**
   * Validates Firebase credentials are properly configured
   * 
   * @throws Error if credentials cannot be validated
   */
  private validateCredentials(): void {
    // In a real implementation, would:
    // 1. Check if credentials file exists at credentialsPath
    // 2. Parse and validate JSON credentials structure
    // 3. Check for required fields (type, project_id, private_key, client_email)
    // 4. Initialize Firebase admin SDK
    
    // For Phase 4 mock implementation, we just validate the projectId format
    if (!this.projectId.match(/^[a-z0-9-]+$/)) {
      throw new Error('Invalid Firebase project ID format');
    }

    console.log(`[FCM] Credentials validated for project: ${this.projectId}`);
  }

  /**
   * Validates FCM token format
   * FCM tokens are typically long strings with URL-safe characters
   * For testing, we allow tokens starting with 'test_fail_' for simulation
   * 
   * @param token - The token to validate
   * @returns true if token format is valid, false otherwise
   */
  private isValidFCMToken(token: string): boolean {
    // For testing: allow test_fail_ tokens for simulation
    if (token.startsWith('test_fail_')) {
      return token.length > 50; // Just ensure minimum length
    }
    
    // FCM tokens are typically 152+ characters, URL-safe base64
    // This is a simplified check - real validation would be more comprehensive
    return token.length > 50 && /^[a-zA-Z0-9_:-]+$/.test(token);
  }

  /**
   * Simulates FCM delivery for Phase 4 mock implementation
   * In production, this would call the actual FCM API
   * 
   * @param pushToken - FCM push token
   * @param payload - Notification payload
   * @returns true if delivery simulated as successful
   */
  private async simulateFCMDelivery(
    pushToken: string,
    payload: NotificationPayload
  ): Promise<boolean> {
    // Simulate network latency
    await this.sleep(50);

    // For testing purposes, simulate occasional failures that will trigger retry logic
    // This allows testing of the retry mechanism without real FCM
    
    // Simulate rare failures based on token characteristics
    // Tokens starting with 'test_fail_' simulate failures
    if (pushToken.startsWith('test_fail_')) {
      const failureType = pushToken.split('_')[2];
      
      switch (failureType) {
        case 'invalid':
          throw new Error('Invalid FCM token: Token is invalid');
        case 'expired':
          throw new Error('Invalid FCM token: Token has expired or is not registered');
        case 'rate':
          throw new Error('Rate limit exceeded: Too many requests to FCM service');
        case 'unavailable':
          throw new Error('FCM service unavailable: Service temporarily down');
        case 'auth':
          throw new Error('Authentication failed: Invalid Firebase credentials or permissions');
        default:
          throw new Error('Unknown FCM error');
      }
    }

    console.log(`[FCM] Notification delivered to token (masked): ${this.maskToken(pushToken)}`);
    console.log(`[FCM] Payload: ${payload.title}`);

    return true;
  }

  /**
   * Handles FCM-specific errors and formats them for DeliveryRetryService classification
   * 
   * @param error - The error from FCM operation
   * @returns Error with message formatted for classification
   */
  private handleFCMError(error: unknown): Error {
    if (!(error instanceof Error)) {
      return new Error('FCM delivery failed: Unknown error');
    }

    const message = error.message.toLowerCase();

    // Token errors - permanent failures (won't retry)
    if (message.includes('expired') && message.includes('token')) {
      return new Error(`Token expired in FCM: ${error.message}`);
    }

    if (message.includes('invalid') && message.includes('token')) {
      return new Error(`Invalid FCM token: ${error.message}`);
    }

    if (message.includes('not found') && message.includes('token')) {
      return new Error(`Token not found in FCM: ${error.message}`);
    }

    // Authentication/Authorization errors - permanent
    if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('authentication')) {
      return new Error(`FCM authentication failed: ${error.message}`);
    }

    // Rate limiting - temporary (will retry)
    if (message.includes('rate') || message.includes('throttl') || message.includes('quota')) {
      return new Error(`FCM rate limit: ${error.message}`);
    }

    // Service unavailability - temporary
    if (message.includes('unavailable') || message.includes('service') || message.includes('503')) {
      return new Error(`FCM service unavailable: ${error.message}`);
    }

    // Network errors - temporary
    if (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    ) {
      return new Error(`FCM network error: ${error.message}`);
    }

    // Default - treat as temporary failure
    return new Error(`FCM temporary failure: ${error.message}`);
  }

  /**
   * Masks sensitive FCM token for logging
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
   * Check if FCMService is properly initialized
   * 
   * @returns true if service is initialized and ready to send messages
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get the configured project ID
   * 
   * @returns Firebase project ID
   */
  public getProjectId(): string {
    return this.projectId;
  }
}
