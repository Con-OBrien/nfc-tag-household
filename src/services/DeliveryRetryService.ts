import { EventRepository } from '../repositories/EventRepository';
import { TaskEvent } from '../types';

/**
 * DeliveryFailureClassification - Categorizes delivery failures for proper retry handling
 * Used to determine if a failure is transient (retry-worthy) or permanent
 *
 * Classification types:
 * - 'token_expired': Push token is no longer valid (permanent, don't retry)
 * - 'rate_limited': Service rate limiting detected (temporary, retry with backoff)
 * - 'service_unavailable': External service (FCM/APNs) temporarily down (temporary, retry)
 * - 'permanent_failure': Other permanent errors (permanent, don't retry)
 * - 'temporary_failure': Transient errors like network timeouts (temporary, retry)
 * - 'success': Delivery succeeded
 */
export type DeliveryFailureClassification =
  | 'token_expired'
  | 'rate_limited'
  | 'service_unavailable'
  | 'permanent_failure'
  | 'temporary_failure'
  | 'success';

/**
 * DeliveryAttemptRecord - Tracks a single delivery attempt with classification
 */
export interface DeliveryAttemptRecord {
  attemptNumber: number;
  timestamp: number;
  classification: DeliveryFailureClassification;
  errorMessage?: string;
}

/**
 * DeliveryStatus - Final status of a delivery after all retry attempts
 */
export interface DeliveryStatus {
  pushToken: string;
  userId: string;
  eventId: string;
  finalStatus: 'delivered' | 'failed';
  totalAttempts: number;
  attempts: DeliveryAttemptRecord[];
  lastError?: string;
}

/**
 * DeliveryRetryService - Manages notification delivery with exponential backoff and failure classification
 * Provides:
 * - Configurable retry attempts (max 3) with exponential backoff timing (1s, 2s, 4s)
 * - Failure classification (token expired, rate limited, permanent, temporary)
 * - Attempt logging with classification
 * - Audit log updates with final delivery status
 *
 * Requirements: 5.4, 5.5, 5.6, 14.3, 14.4
 */
export class DeliveryRetryService {
  private eventRepository: EventRepository;
  private maxAttempts: number = 3;
  private backoffDelays: number[] = [1000, 2000, 4000]; // 1s, 2s, 4s in milliseconds

  constructor(eventRepository: EventRepository) {
    this.eventRepository = eventRepository;
  }

  /**
   * Executes a delivery operation with retry logic and exponential backoff
   * Classifies failures and updates audit log with delivery status
   *
   * @param deliveryFn - Function that attempts delivery, should throw with specific error codes
   * @param pushToken - The push token for logging purposes
   * @param userId - The user ID for logging
   * @param eventId - The event ID for audit log tracking
   * @param taskId - The task ID for context
   * @param householdId - The household ID for context
   * @returns DeliveryStatus with all attempt details and final outcome
   *
   * Requirements: 5.4, 5.5, 5.6, 14.3, 14.4
   */
  public async executeWithRetry(
    deliveryFn: () => Promise<boolean>,
    pushToken: string,
    userId: string,
    eventId: string,
    taskId: string,
    householdId: string
  ): Promise<DeliveryStatus> {
    const attempts: DeliveryAttemptRecord[] = [];
    let finalStatus: 'delivered' | 'failed' = 'failed';
    let lastError: string | undefined;

    for (let attemptNumber = 1; attemptNumber <= this.maxAttempts; attemptNumber++) {
      try {
        const success = await deliveryFn();

        if (success) {
          const record: DeliveryAttemptRecord = {
            attemptNumber,
            timestamp: Date.now(),
            classification: 'success',
          };
          attempts.push(record);
          finalStatus = 'delivered';

          // Log successful delivery
          console.log(
            `Delivery succeeded for user ${userId} on attempt ${attemptNumber}`
          );
          break;
        } else {
          // Delivery returned false but didn't throw - treat as temporary failure
          const record: DeliveryAttemptRecord = {
            attemptNumber,
            timestamp: Date.now(),
            classification: 'temporary_failure',
            errorMessage: 'Delivery function returned false',
          };
          attempts.push(record);
          lastError = 'Delivery function returned false';

          // Wait before retrying (except on last attempt)
          if (attemptNumber < this.maxAttempts) {
            await this.sleep(this.backoffDelays[attemptNumber - 1]);
          }
        }
      } catch (error) {
        const classification = this.classifyError(error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        const record: DeliveryAttemptRecord = {
          attemptNumber,
          timestamp: Date.now(),
          classification,
          errorMessage,
        };
        attempts.push(record);
        lastError = errorMessage;

        console.error(
          `Attempt ${attemptNumber} failed for user ${userId}: [${classification}] ${errorMessage}`
        );

        // Don't retry if permanent failure
        if (classification === 'permanent_failure' || classification === 'token_expired') {
          console.warn(
            `Permanent failure detected (${classification}). Stopping retry attempts.`
          );
          break;
        }

        // Wait before retrying (except on last attempt)
        if (attemptNumber < this.maxAttempts) {
          const delayMs = this.backoffDelays[attemptNumber - 1];
          console.log(
            `Retrying in ${delayMs}ms (attempt ${attemptNumber + 1}/${this.maxAttempts})`
          );
          await this.sleep(delayMs);
        }
      }
    }

    // Update audit log with final delivery status
    const deliveryStatus: DeliveryStatus = {
      pushToken,
      userId,
      eventId,
      finalStatus,
      totalAttempts: attempts.length,
      attempts,
      lastError,
    };

    try {
      await this.updateAuditLogWithDeliveryStatus(
        eventId,
        userId,
        taskId,
        householdId,
        deliveryStatus
      );
    } catch (auditError) {
      console.error('Failed to update audit log with delivery status:', auditError);
      // Don't throw - audit log update failure shouldn't fail the overall delivery
    }

    // Log final outcome
    if (finalStatus === 'delivered') {
      console.log(
        `✓ Delivery succeeded for user ${userId} on attempt ${attempts.length}/${this.maxAttempts}`
      );
    } else {
      console.log(
        `✗ Delivery failed for user ${userId} after ${attempts.length} attempts`
      );
    }

    return deliveryStatus;
  }

  /**
   * Classifies an error to determine if retry should continue
   * Returns specific classification for logging and decision-making
   *
   * @param error - The error thrown during delivery
   * @returns Classification of the error type
   *
   * Requirements: 5.6, 14.3
   */
  private classifyError(error: unknown): DeliveryFailureClassification {
    if (!(error instanceof Error)) {
      return 'temporary_failure';
    }

    const errorMessage = error.message.toLowerCase();

    // Token-related errors (permanent)
    if (
      errorMessage.includes('token') &&
      (errorMessage.includes('invalid') ||
        errorMessage.includes('expired') ||
        errorMessage.includes('not found'))
    ) {
      return 'token_expired';
    }

    // Rate limiting (temporary, should retry with backoff)
    if (
      errorMessage.includes('rate') ||
      errorMessage.includes('throttl') ||
      errorMessage.includes('quota')
    ) {
      return 'rate_limited';
    }

    // Service unavailability (temporary)
    if (
      errorMessage.includes('unavailable') ||
      errorMessage.includes('service') ||
      errorMessage.includes('500') ||
      errorMessage.includes('503')
    ) {
      return 'service_unavailable';
    }

    // Network-related errors (temporary)
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('enotfound')
    ) {
      return 'temporary_failure';
    }

    // Other errors (permanent)
    if (
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('400') ||
      errorMessage.includes('401') ||
      errorMessage.includes('403')
    ) {
      return 'permanent_failure';
    }

    // Default to temporary for unknown errors
    return 'temporary_failure';
  }

  /**
   * Updates the audit log with final delivery status
   * Logs the complete delivery attempt history and final outcome
   * This creates a new event tracking the delivery status
   *
   * @param eventId - Original event ID
   * @param userId - User who triggered the event
   * @param taskId - Task being executed
   * @param householdId - Household context
   * @param deliveryStatus - Delivery status with all attempts
   *
   * Requirements: 14.4
   */
  private async updateAuditLogWithDeliveryStatus(
    eventId: string,
    userId: string,
    taskId: string,
    householdId: string,
    deliveryStatus: DeliveryStatus
  ): Promise<void> {
    try {
      // Create a delivery tracking event in the audit log
      // This logs the final status of notification delivery for the original event
      const deliveryEvent = {
        userId,
        taskId,
        householdId,
        action: 'acknowledge' as const, // Use 'acknowledge' action to track delivery confirmation
        timestamp: Date.now(),
        metadata: {
          linkedEventId: eventId,
          deliveryStatus: deliveryStatus.finalStatus,
          totalAttempts: deliveryStatus.totalAttempts,
          attempts: deliveryStatus.attempts.map((attempt) => ({
            attemptNumber: attempt.attemptNumber,
            timestamp: attempt.timestamp,
            classification: attempt.classification,
            error: attempt.errorMessage,
          })),
          deliveryToken: this.maskToken(deliveryStatus.pushToken),
          lastError: deliveryStatus.lastError,
        },
      };

      // Log the delivery event to audit trail
      await this.eventRepository.logEvent(deliveryEvent);

      console.log(
        `Audit log updated: Delivery status for event ${eventId} logged successfully`
      );
    } catch (error) {
      console.error(
        `Failed to log delivery status for event ${eventId}:`,
        error
      );
      // Re-throw to allow caller to handle
      throw error;
    }
  }

  /**
   * Masks sensitive push token for logging
   * Shows only first 8 and last 4 characters
   *
   * @param token - The push token to mask
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
   * @param ms - Milliseconds to sleep
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gets the configured max attempts
   */
  public getMaxAttempts(): number {
    return this.maxAttempts;
  }

  /**
   * Gets the configured backoff delays
   */
  public getBackoffDelays(): number[] {
    return [...this.backoffDelays]; // Return copy to prevent external modification
  }

  /**
   * Sets custom max attempts (for testing)
   */
  public setMaxAttempts(attempts: number): void {
    if (attempts < 1 || attempts > 10) {
      throw new Error('Max attempts must be between 1 and 10');
    }
    this.maxAttempts = attempts;
  }

  /**
   * Sets custom backoff delays (for testing)
   */
  public setBackoffDelays(delays: number[]): void {
    if (delays.length === 0) {
      throw new Error('Backoff delays must not be empty');
    }
    if (delays.some((d) => d < 0)) {
      throw new Error('All backoff delays must be non-negative');
    }
    this.backoffDelays = delays;
  }
}
