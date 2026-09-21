"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushServiceFactory = void 0;
const FCMService_1 = require("./FCMService");
const APNsService_1 = require("./APNsService");
/**
 * PushServiceFactory - Routes push notifications to appropriate platform service
 *
 * Factory pattern implementation that:
 * - Detects platform from push token format (FCM vs APNs)
 * - Creates appropriate service instance
 * - Handles service initialization errors
 * - Provides unified interface for notification delivery
 *
 * Requirements: 5.3, 21.1, 21.2, 21.3
 */
class PushServiceFactory {
    /**
     * Initializes push services (FCM and APNs) with credentials
     * Should be called once on application startup
     *
     * @throws Error if neither service can be initialized (optional - for Phase 4)
     */
    static initializeServices() {
        try {
            // Initialize FCM service
            try {
                this.fcmService = new FCMService_1.FCMService();
                console.log('[PushServiceFactory] FCM service initialized successfully');
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.warn(`[PushServiceFactory] FCM initialization warning: ${errorMsg}`);
                this.initializationErrors.set('fcm', error instanceof Error ? error : new Error(String(error)));
                // Don't throw - FCM is optional if APNs is available
            }
            // Initialize APNs service
            try {
                this.apnsService = new APNsService_1.APNsService();
                console.log('[PushServiceFactory] APNs service initialized successfully');
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.warn(`[PushServiceFactory] APNs initialization warning: ${errorMsg}`);
                this.initializationErrors.set('apns', error instanceof Error ? error : new Error(String(error)));
                // Don't throw - APNs is optional if FCM is available
            }
            // For Phase 4 mock implementation, we allow partial initialization
            // In production, at least one service should be initialized
            if (!this.fcmService && !this.apnsService) {
                console.warn('[PushServiceFactory] Warning: No push services could be initialized. Using mock delivery only.');
            }
        }
        catch (error) {
            console.error('[PushServiceFactory] Critical error during initialization:', error);
            throw new Error('Failed to initialize push services');
        }
    }
    /**
     * Detects push token platform (FCM for Android, APNs for iOS)
     *
     * Detection logic:
     * - APNs tokens are exactly 64 hex characters
     * - FCM tokens are longer and contain URL-safe base64 characters
     *
     * @param pushToken - The push token to analyze
     * @returns 'fcm' for Android tokens, 'apns' for iOS tokens
     */
    static detectPlatform(pushToken) {
        if (!pushToken) {
            throw new Error('Cannot detect platform: push token is empty');
        }
        // APNs tokens are exactly 64 hex characters (32 bytes in hex format)
        if (pushToken.length === 64 && /^[a-f0-9]{64}$/i.test(pushToken)) {
            return 'apns';
        }
        // FCM tokens typically:
        // - Are 152+ characters
        // - Contain URL-safe base64 characters (a-z, A-Z, 0-9, -, _, :)
        // - May contain colons (used in older FCM token formats)
        if (pushToken.length > 50 && /^[a-zA-Z0-9_:-]+$/.test(pushToken)) {
            return 'fcm';
        }
        // Default to FCM for tokens that don't clearly match APNs format
        console.warn(`[PushServiceFactory] Token format not clearly identified. Defaulting to FCM. Token (masked): ${this.maskToken(pushToken)}`);
        return 'fcm';
    }
    /**
     * Sends a push notification to the appropriate platform
     *
     * @param pushToken - The push token for the device
     * @param payload - Notification payload
     * @returns true if delivery succeeded, false otherwise
     * @throws Error if the appropriate service is not initialized or delivery fails
     *
     * Requirements: 5.3, 21.1, 21.2, 21.3
     */
    static async sendPushNotification(pushToken, payload) {
        const platform = this.detectPlatform(pushToken);
        if (platform === 'apns') {
            return this.sendViaAPNs(pushToken, payload);
        }
        else {
            return this.sendViaFCM(pushToken, payload);
        }
    }
    /**
     * Sends notification via Firebase Cloud Messaging (Android)
     *
     * @param pushToken - FCM push token
     * @param payload - Notification payload
     * @returns true if delivery succeeded
     * @throws Error if FCM is not initialized or delivery fails
     */
    static async sendViaFCM(pushToken, payload) {
        if (!this.fcmService) {
            const error = this.initializationErrors.get('fcm');
            if (error) {
                throw new Error(`FCM service not initialized: ${error.message}`);
            }
            throw new Error('FCM service not initialized. Ensure FIREBASE_PROJECT_ID is set.');
        }
        try {
            return await this.fcmService.sendMessage(pushToken, payload);
        }
        catch (error) {
            // Re-throw with platform context
            if (error instanceof Error) {
                throw new Error(`FCM delivery failed: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Sends notification via Apple Push Notification service (iOS)
     *
     * @param pushToken - APNs push token (device token)
     * @param payload - Notification payload
     * @returns true if delivery succeeded
     * @throws Error if APNs is not initialized or delivery fails
     */
    static async sendViaAPNs(pushToken, payload) {
        if (!this.apnsService) {
            const error = this.initializationErrors.get('apns');
            if (error) {
                throw new Error(`APNs service not initialized: ${error.message}`);
            }
            throw new Error('APNs service not initialized. Ensure IOS_BUNDLE_ID is set.');
        }
        try {
            return await this.apnsService.sendNotification(pushToken, payload);
        }
        catch (error) {
            // Re-throw with platform context
            if (error instanceof Error) {
                throw new Error(`APNs delivery failed: ${error.message}`);
            }
            throw error;
        }
    }
    /**
     * Gets the FCM service instance for testing/direct access
     *
     * @returns FCM service instance or null if not initialized
     */
    static getFCMService() {
        return this.fcmService;
    }
    /**
     * Gets the APNs service instance for testing/direct access
     *
     * @returns APNs service instance or null if not initialized
     */
    static getAPNsService() {
        return this.apnsService;
    }
    /**
     * Resets the factory (for testing purposes)
     */
    static reset() {
        this.fcmService = null;
        this.apnsService = null;
        this.initializationErrors.clear();
    }
    /**
     * Gets initialization errors for diagnostic purposes
     *
     * @returns Map of platform to initialization error
     */
    static getInitializationErrors() {
        return new Map(this.initializationErrors);
    }
    /**
     * Checks if FCM service is initialized
     *
     * @returns true if FCM service is ready
     */
    static isFCMReady() {
        return this.fcmService?.isReady() ?? false;
    }
    /**
     * Checks if APNs service is initialized
     *
     * @returns true if APNs service is ready
     */
    static isAPNsReady() {
        return this.apnsService?.isReady() ?? false;
    }
    /**
     * Masks sensitive push token for logging
     * Shows only first 8 and last 4 characters
     *
     * @param token - The token to mask
     * @returns Masked token for safe logging
     */
    static maskToken(token) {
        if (token.length <= 12) {
            return '***';
        }
        return token.substring(0, 8) + '...' + token.substring(token.length - 4);
    }
}
exports.PushServiceFactory = PushServiceFactory;
PushServiceFactory.fcmService = null;
PushServiceFactory.apnsService = null;
PushServiceFactory.initializationErrors = new Map();
