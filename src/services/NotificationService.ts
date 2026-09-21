import { TaskEvent, HouseholdUser, Task, NotificationPayload, ForbiddenError } from '../types';
import { UserRepository } from '../repositories/UserRepository';
import { HouseholdRepository } from '../repositories/HouseholdRepository';
import { TaskRepository } from '../repositories/TaskRepository';
import { EventRepository } from '../repositories/EventRepository';
import { DeliveryRetryService } from './DeliveryRetryService';
import { PushServiceFactory } from './PushServiceFactory';

/**
 * NotificationService - Handles push notification delivery to household members
 * Routes notifications to FCM (Android) and APNs (iOS) based on token format
 * Respects user preferences (enabled/disabled, muted tasks, quiet hours)
 * Handles retry logic with exponential backoff and failure classification
 *
 * Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 14.3, 14.4
 */
export class NotificationService {
  private userRepository: UserRepository;
  private householdRepository: HouseholdRepository;
  private taskRepository: TaskRepository;
  private eventRepository: EventRepository;
  private retryService: DeliveryRetryService;

  constructor(
    userRepository: UserRepository,
    householdRepository: HouseholdRepository,
    taskRepository: TaskRepository,
    eventRepository: EventRepository
  ) {
    this.userRepository = userRepository;
    this.householdRepository = householdRepository;
    this.taskRepository = taskRepository;
    this.eventRepository = eventRepository;
    this.retryService = new DeliveryRetryService(eventRepository);
  }

  /**
   * Sends a notification to specified recipients with retry logic and failure classification
   * Routes to FCM (Android) or APNs (iOS) based on token format
   * Implements exponential backoff for failed deliveries with proper classification
   * Updates audit log with delivery status for each attempt
   *
   * @param payload - Notification payload with task details and deep link
   * @param recipients - Array of recipient users with push tokens and preferences
   * @param eventId - The event ID triggering these notifications (for audit logging)
   * @param taskId - The task ID for context (for audit logging)
   * @param householdId - The household ID for context (for audit logging)
   * @returns Object with delivered and failed recipient IDs
   *
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 14.3, 14.4
   */
  public async sendNotification(
    payload: NotificationPayload,
    recipients: HouseholdUser[],
    eventId?: string,
    taskId?: string,
    householdId?: string
  ): Promise<{ delivered: string[]; failed: string[] }> {
    if (!payload || !recipients || recipients.length === 0) {
      return { delivered: [], failed: [] };
    }

    const delivered: string[] = [];
    const failed: string[] = [];

    for (const recipient of recipients) {
      if (!recipient.pushToken) {
        failed.push(recipient.userId);
        continue;
      }

      try {
        // Create delivery function that will be retried
        const deliveryFn = async () =>
          this.deliverNotification(payload, recipient.pushToken, this.detectPlatform(recipient.pushToken));

        // Execute with retry logic and failure classification
        // Use provided event context or defaults for audit logging
        const deliveryStatus = await this.retryService.executeWithRetry(
          deliveryFn,
          recipient.pushToken,
          recipient.userId,
          eventId || 'unknown-event',
          taskId || 'unknown-task',
          householdId || 'unknown-household'
        );

        if (deliveryStatus.finalStatus === 'delivered') {
          delivered.push(recipient.userId);
        } else {
          failed.push(recipient.userId);
        }
      } catch (error) {
        console.error(`Failed to send notification to ${recipient.userId}:`, error);
        failed.push(recipient.userId);
      }
    }

    return { delivered, failed };
  }

  /**
   * Sends notifications to all non-executing household members
   * Identifies eligible recipients and respects their preferences
   * Excludes the user who triggered the event
   *
   * @param taskId - The task ID
   * @param event - The task event that triggered notifications
   * @param excludeUser - User ID to exclude from notifications (the executor)
   *
   * Requirements: 4.1, 4.2, 4.3, 5.4, 5.5, 5.6, 14.3, 14.4
   */
  public async sendToHouseholdMembers(
    taskId: string,
    event: TaskEvent,
    excludeUser?: string
  ): Promise<void> {
    try {
      // Get the task to retrieve task details
      const task = await this.taskRepository.findTaskById(taskId, event.householdId);
      if (!task) {
        console.warn(`Task ${taskId} not found for notification delivery`);
        return;
      }

      // Get all household members
      const householdMembers = await this.userRepository.findUsersInHousehold(
        event.householdId
      );

      if (!householdMembers || householdMembers.length === 0) {
        console.warn(`No household members found for household ${event.householdId}`);
        return;
      }

      // Filter eligible recipients (exclude executor)
      const eligibleRecipients = householdMembers.filter(
        (member) => member.userId !== excludeUser && member.pushToken
      );

      if (eligibleRecipients.length === 0) {
        console.log(
          `No eligible recipients for notification in household ${event.householdId}`
        );
        return;
      }

      // Apply preference filters and get final recipients
      const filteredRecipients = this.filterByPreferences(eligibleRecipients, task);

      if (filteredRecipients.length === 0) {
        console.log(
          `All recipients filtered out by preferences for task ${taskId}`
        );
        return;
      }

      // Format notification payload
      const payload = this.formatNotificationPayload(task, event);

      // Send notification with retry logic and audit logging
      // Pass event context for audit trail tracking
      const result = await this.sendNotification(
        payload,
        filteredRecipients,
        event.eventId,
        task.taskId,
        event.householdId
      );

      console.log(
        `Notification sent: ${result.delivered.length} delivered, ${result.failed.length} failed`
      );
    } catch (error) {
      console.error('Error sending notifications to household members:', error);
      throw error;
    }
  }

  /**
   * Filters recipients based on their notification preferences
   * Implements comprehensive preference evaluation with early exit optimizations
   * Checks: notifications enabled, task muting, quiet hours
   *
   * @param recipients - Array of potential recipients
   * @param task - The task being notified about
   * @returns Filtered array of recipients who should receive notification
   *
   * Requirements: 4.3, 4.4, 4.5, 4.6, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
   */
  private filterByPreferences(
    recipients: HouseholdUser[],
    task: Task
  ): HouseholdUser[] {
    // Early exit: no recipients to filter
    if (!recipients || recipients.length === 0) {
      console.log('No recipients provided for preference filtering');
      return [];
    }

    // Early exit: no task context
    if (!task || !task.taskId) {
      console.log('Invalid task provided for preference filtering');
      return [];
    }

    const filteredRecipients: HouseholdUser[] = [];

    for (const recipient of recipients) {
      // Early exit: invalid recipient
      if (!recipient || !recipient.userId) {
        console.warn('Invalid recipient skipped in preference filtering');
        continue;
      }

      // Early exit: preferences not defined
      if (!recipient.preferences) {
        console.warn(
          `No preferences found for user ${recipient.userId}, skipping notification`
        );
        continue;
      }

      // Check 1: Notifications enabled (fail fast on first condition)
      if (!this.isNotificationEnabled(recipient)) {
        console.log(
          `[PREFERENCE] Notifications disabled for user ${recipient.userId}`
        );
        continue; // Early exit to next recipient
      }

      // Check 2: Task not muted (fail fast on second condition)
      if (!this.isTaskNotMuted(recipient, task.taskId)) {
        console.log(
          `[PREFERENCE] Task ${task.taskId} is muted for user ${recipient.userId}`
        );
        continue; // Early exit to next recipient
      }

      // Check 3: Not in quiet hours (fail fast on third condition)
      if (!this.isOutsideQuietHours(recipient)) {
        console.log(
          `[PREFERENCE] User ${recipient.userId} is in quiet hours (no notification sent)`
        );
        continue; // Early exit to next recipient
      }

      // All preference checks passed: add to filtered list
      console.log(
        `[PREFERENCE] User ${recipient.userId} passes all preference checks - notification eligible`
      );
      filteredRecipients.push(recipient);
    }

    return filteredRecipients;
  }

  /**
   * Evaluates if notifications are enabled for a recipient
   * Handles null/undefined preferences gracefully
   *
   * @param recipient - The household user to check
   * @returns true if notifications enabled, false otherwise
   *
   * Requirements: 9.2
   */
  private isNotificationEnabled(recipient: HouseholdUser): boolean {
    // Handle missing or null preferences
    if (!recipient || !recipient.preferences) {
      return false;
    }

    // Check if notificationsEnabled is explicitly false
    // Default to true if undefined (backward compatibility)
    const isEnabled = recipient.preferences.notificationsEnabled !== false;

    return isEnabled;
  }

  /**
   * Evaluates if a specific task is NOT muted for a recipient
   * Handles null/undefined muted tasks list gracefully
   *
   * @param recipient - The household user to check
   * @param taskId - The task ID to check against muted list
   * @returns true if task is not muted, false if muted
   *
   * Requirements: 9.3, 9.4
   */
  private isTaskNotMuted(recipient: HouseholdUser, taskId: string): boolean {
    // Handle missing or null preferences
    if (!recipient || !recipient.preferences) {
      return true; // Default: task not muted if preferences unavailable
    }

    // Handle missing or null muted tasks list
    if (!recipient.preferences.mutedTasks) {
      return true; // Default: task not muted if list unavailable
    }

    // Check if task is in the muted tasks list
    const isTaskMuted = recipient.preferences.mutedTasks.includes(taskId);

    return !isTaskMuted; // Return true if NOT muted
  }

  /**
   * Evaluates if recipient is currently OUTSIDE quiet hours
   * Handles null/undefined quiet hours gracefully
   * Supports midnight-wrapping quiet hours (e.g., 22:00-06:00)
   *
   * @param recipient - The household user to check
   * @returns true if outside quiet hours (can receive notification), false if in quiet hours
   *
   * Requirements: 9.5, 9.6, 9.7
   */
  private isOutsideQuietHours(recipient: HouseholdUser): boolean {
    // Handle missing or null preferences
    if (!recipient || !recipient.preferences) {
      return true; // Default: outside quiet hours if preferences unavailable
    }

    // Handle missing quiet hours configuration
    if (!recipient.preferences.quietHours) {
      return true; // No quiet hours configured: can receive notification
    }

    // Validate quiet hours format before checking
    if (!this.isValidQuietHours(recipient.preferences.quietHours)) {
      console.warn(
        `Invalid quiet hours configuration for user ${recipient.userId}: ${JSON.stringify(
          recipient.preferences.quietHours
        )}`
      );
      return true; // Default to allowing notification if hours are invalid
    }

    // Check if currently outside quiet hours
    const isInQuietHours = this.isCurrentlyInQuietHours(
      recipient.preferences.quietHours
    );

    return !isInQuietHours; // Return true if NOT in quiet hours
  }

  /**
   * Validates quiet hours format (24-hour format, 0-23)
   * Handles null/undefined gracefully
   *
   * @param quietHours - The quiet hours object to validate
   * @returns true if valid format, false otherwise
   *
   * Requirements: 9.5
   */
  private isValidQuietHours(quietHours: any): boolean {
    // Handle null or undefined
    if (!quietHours) {
      return false;
    }

    // Check start and end properties exist and are numbers
    if (typeof quietHours.start !== 'number' || typeof quietHours.end !== 'number') {
      return false;
    }

    // Check values are in valid 24-hour range (0-23)
    if (quietHours.start < 0 || quietHours.start > 23) {
      return false;
    }

    if (quietHours.end < 0 || quietHours.end > 23) {
      return false;
    }

    return true;
  }

  /**
   * Checks if current time is within user's quiet hours
   * Quiet hours use 24-hour format (0-23)
   *
   * @param quietHours - Object with start and end times
   * @returns true if current time is within quiet hours, false otherwise
   *
   * Requirements: 4.6, 9.6
   */
  private isCurrentlyInQuietHours(quietHours: {
    start: number;
    end: number;
  }): boolean {
    const now = new Date();
    const currentHour = now.getHours();

    // Handle case where quiet hours don't wrap around midnight (e.g., 22 to 6)
    if (quietHours.start <= quietHours.end) {
      return currentHour >= quietHours.start && currentHour < quietHours.end;
    } else {
      // Quiet hours wrap around midnight (e.g., 22 to 6)
      return currentHour >= quietHours.start || currentHour < quietHours.end;
    }
  }

  /**
   * Formats a notification payload with task details and deep link
   * Creates rich notification with task context
   *
   * @param task - The task being notified about
   * @param event - The event that triggered the notification
   * @returns Formatted notification payload
   *
   * Requirements: 5.1, 5.2
   */
  private formatNotificationPayload(
    task: Task,
    event: TaskEvent
  ): NotificationPayload {
    const title = `Task Update: ${task.name}`;
    const body = `A household member has executed "${task.name}"`;

    return {
      title,
      body,
      data: {
        taskId: task.taskId,
        eventId: event.eventId,
        eventType: event.action,
        timestamp: event.timestamp,
      },
      deepLink: `app://task/${task.taskId}`,
    };
  }

  /**
   * Detects push token platform (FCM for Android, APNs for iOS)
   * FCM tokens typically start with specific patterns
   * APNs tokens are hex strings of specific length
   *
   * @param pushToken - The push token to analyze
   * @returns 'fcm' or 'apns'
   *
   * Requirements: 5.3
   */
  public detectPlatform(pushToken: string): 'fcm' | 'apns' {
    return PushServiceFactory.detectPlatform(pushToken);
  }

  /**
   * Delivers a notification to the push service
   * Routes to FCM or APNs based on platform using PushServiceFactory
   *
   * @param payload - Notification payload
   * @param pushToken - Push token
   * @param platform - Target platform (fcm or apns)
   * @returns true if delivery succeeded, false otherwise
   * @throws Error with specific error codes for classification
   *
   * Requirements: 5.3, 5.4, 5.5, 5.6
   */
  private async deliverNotification(
    payload: NotificationPayload,
    pushToken: string,
    platform: 'fcm' | 'apns'
  ): Promise<boolean> {
    try {
      // Use PushServiceFactory to route to appropriate platform service
      return await PushServiceFactory.sendPushNotification(pushToken, payload);
    } catch (error) {
      console.error(`Failed to deliver via ${platform}:`, error);
      throw error;
    }
  }

  /**
   * Utility function to sleep for a specified duration
   * @param ms - Milliseconds to sleep
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
