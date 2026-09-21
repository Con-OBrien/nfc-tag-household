"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PushServiceFactory_1 = require("../../src/services/PushServiceFactory");
const FCMService_1 = require("../../src/services/FCMService");
const APNsService_1 = require("../../src/services/APNsService");
describe('PushServiceFactory', () => {
    const mockNotificationPayload = {
        title: 'Task Update',
        body: 'Alice fed Lenny dinner',
        data: {
            taskId: 'task_001',
            eventId: 'evt_001',
            eventType: 'execute',
            timestamp: Date.now(),
        },
        deepLink: 'app://task/task_001',
    };
    beforeEach(() => {
        // Reset factory state before each test
        PushServiceFactory_1.PushServiceFactory.reset();
    });
    describe('detectPlatform', () => {
        it('should detect APNs tokens (64 hex characters)', () => {
            const apnsTokens = [
                'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
                'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789',
                'aAbBcCdDeEfF0011223344556677889900aAbBcCdDeEfF0011223344556677',
            ];
            for (const token of apnsTokens) {
                expect(PushServiceFactory_1.PushServiceFactory.detectPlatform(token)).toBe('apns');
            }
        });
        it('should detect FCM tokens (non-64 hex, valid base64-url format)', () => {
            const fcmTokens = [
                'eP5jlmxfvjMxT8_zcOQBtj:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8',
                'cN3kL9mN-oP2qR4sT6uV8w:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8',
                'xY1aB3cD5eF7gH9iJ1kL3m:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8',
            ];
            for (const token of fcmTokens) {
                expect(PushServiceFactory_1.PushServiceFactory.detectPlatform(token)).toBe('fcm');
            }
        });
        it('should default to FCM for ambiguous tokens', () => {
            const ambiguousTokens = [
                'short_token_but_still_long_enough_for_validation_purposes_here',
                'token-with-dashes-and-length-ok-for-fcm-detection-purposes-here',
                'token_with_underscores_and_length_ok_for_fcm_detection_purposes_here',
            ];
            for (const token of ambiguousTokens) {
                expect(PushServiceFactory_1.PushServiceFactory.detectPlatform(token)).toBe('fcm');
            }
        });
        it('should throw error on empty token', () => {
            expect(() => {
                PushServiceFactory_1.PushServiceFactory.detectPlatform('');
            }).toThrow('Cannot detect platform: push token is empty');
        });
        it('should handle null-like token values gracefully', () => {
            expect(() => {
                PushServiceFactory_1.PushServiceFactory.detectPlatform(null);
            }).toThrow();
        });
    });
    describe('initializeServices', () => {
        it('should initialize both FCM and APNs services', () => {
            process.env.FIREBASE_PROJECT_ID = 'test-project';
            process.env.IOS_BUNDLE_ID = 'com.example.app';
            PushServiceFactory_1.PushServiceFactory.initializeServices();
            expect(PushServiceFactory_1.PushServiceFactory.isFCMReady()).toBe(true);
            expect(PushServiceFactory_1.PushServiceFactory.isAPNsReady()).toBe(true);
        });
        it('should handle FCM initialization failure gracefully', () => {
            delete process.env.FIREBASE_PROJECT_ID;
            process.env.IOS_BUNDLE_ID = 'com.example.app';
            // Should not throw, just warn
            expect(() => {
                PushServiceFactory_1.PushServiceFactory.initializeServices();
            }).not.toThrow();
            expect(PushServiceFactory_1.PushServiceFactory.isFCMReady()).toBe(false);
            expect(PushServiceFactory_1.PushServiceFactory.isAPNsReady()).toBe(true);
        });
        it('should handle APNs initialization failure gracefully', () => {
            process.env.FIREBASE_PROJECT_ID = 'test-project';
            delete process.env.IOS_BUNDLE_ID;
            // Should not throw, just warn
            expect(() => {
                PushServiceFactory_1.PushServiceFactory.initializeServices();
            }).not.toThrow();
            expect(PushServiceFactory_1.PushServiceFactory.isFCMReady()).toBe(true);
            expect(PushServiceFactory_1.PushServiceFactory.isAPNsReady()).toBe(false);
        });
        it('should track initialization errors', () => {
            delete process.env.FIREBASE_PROJECT_ID;
            process.env.IOS_BUNDLE_ID = 'com.example.app';
            PushServiceFactory_1.PushServiceFactory.initializeServices();
            const errors = PushServiceFactory_1.PushServiceFactory.getInitializationErrors();
            expect(errors.has('fcm')).toBe(true);
            expect(errors.has('apns')).toBe(false);
        });
    });
    describe('sendPushNotification', () => {
        beforeEach(() => {
            process.env.FIREBASE_PROJECT_ID = 'test-project';
            process.env.IOS_BUNDLE_ID = 'com.example.app';
            PushServiceFactory_1.PushServiceFactory.initializeServices();
        });
        it('should route APNs tokens to APNs service', async () => {
            const apnsToken = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a';
            const result = await PushServiceFactory_1.PushServiceFactory.sendPushNotification(apnsToken, mockNotificationPayload);
            expect(result).toBe(true);
        });
        it('should route FCM tokens to FCM service', async () => {
            const fcmToken = 'eP5jlmxfvjMxT8_zcOQBtj:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8';
            const result = await PushServiceFactory_1.PushServiceFactory.sendPushNotification(fcmToken, mockNotificationPayload);
            expect(result).toBe(true);
        });
        it('should throw error if target platform service is not initialized', async () => {
            PushServiceFactory_1.PushServiceFactory.reset();
            // Initialize only APNs
            process.env.FIREBASE_PROJECT_ID = ''; // Fail FCM init
            process.env.IOS_BUNDLE_ID = 'com.example.app';
            PushServiceFactory_1.PushServiceFactory.initializeServices();
            // Try to send to FCM token when FCM is not initialized
            const fcmToken = 'eP5jlmxfvjMxT8_zcOQBtj:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8';
            await expect(PushServiceFactory_1.PushServiceFactory.sendPushNotification(fcmToken, mockNotificationPayload)).rejects.toThrow('FCM service not initialized');
        });
        it('should propagate service-specific errors', async () => {
            const invalidAPNsToken = 'test_fail_expired_e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0';
            await expect(PushServiceFactory_1.PushServiceFactory.sendPushNotification(invalidAPNsToken, mockNotificationPayload)).rejects.toThrow('APNs delivery failed');
        });
    });
    describe('service access methods', () => {
        beforeEach(() => {
            process.env.FIREBASE_PROJECT_ID = 'test-project';
            process.env.IOS_BUNDLE_ID = 'com.example.app';
            PushServiceFactory_1.PushServiceFactory.initializeServices();
        });
        it('should provide access to FCM service instance', () => {
            const fcmService = PushServiceFactory_1.PushServiceFactory.getFCMService();
            expect(fcmService).not.toBeNull();
            expect(fcmService).toBeInstanceOf(FCMService_1.FCMService);
        });
        it('should provide access to APNs service instance', () => {
            const apnsService = PushServiceFactory_1.PushServiceFactory.getAPNsService();
            expect(apnsService).not.toBeNull();
            expect(apnsService).toBeInstanceOf(APNsService_1.APNsService);
        });
        it('should return null for uninitialized services', () => {
            PushServiceFactory_1.PushServiceFactory.reset();
            delete process.env.FIREBASE_PROJECT_ID;
            delete process.env.IOS_BUNDLE_ID;
            expect(PushServiceFactory_1.PushServiceFactory.getFCMService()).toBeNull();
            expect(PushServiceFactory_1.PushServiceFactory.getAPNsService()).toBeNull();
        });
    });
    describe('ready state checks', () => {
        it('should correctly report FCM ready state', () => {
            PushServiceFactory_1.PushServiceFactory.reset();
            expect(PushServiceFactory_1.PushServiceFactory.isFCMReady()).toBe(false);
            process.env.FIREBASE_PROJECT_ID = 'test-project';
            PushServiceFactory_1.PushServiceFactory.initializeServices();
            expect(PushServiceFactory_1.PushServiceFactory.isFCMReady()).toBe(true);
        });
        it('should correctly report APNs ready state', () => {
            PushServiceFactory_1.PushServiceFactory.reset();
            expect(PushServiceFactory_1.PushServiceFactory.isAPNsReady()).toBe(false);
            process.env.IOS_BUNDLE_ID = 'com.example.app';
            PushServiceFactory_1.PushServiceFactory.initializeServices();
            expect(PushServiceFactory_1.PushServiceFactory.isAPNsReady()).toBe(true);
        });
    });
    describe('platform detection accuracy', () => {
        it('should not confuse similar length tokens', () => {
            // This token is exactly 64 hex chars but starts with unusual pattern
            const hexTokenLike = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
            const result = PushServiceFactory_1.PushServiceFactory.detectPlatform(hexTokenLike);
            // Should detect as APNs because it's 64 hex chars
            expect(result).toBe('apns');
        });
        it('should handle case-insensitive APNs tokens', () => {
            const lowercaseToken = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a';
            const uppercaseToken = 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A';
            const mixedToken = 'aAbBcCdDeEfF0011223344556677889900aAbBcCdDeEfF0011223344556677';
            expect(PushServiceFactory_1.PushServiceFactory.detectPlatform(lowercaseToken)).toBe('apns');
            expect(PushServiceFactory_1.PushServiceFactory.detectPlatform(uppercaseToken)).toBe('apns');
            expect(PushServiceFactory_1.PushServiceFactory.detectPlatform(mixedToken)).toBe('apns');
        });
    });
    describe('initialization error handling', () => {
        it('should handle partial initialization correctly', () => {
            PushServiceFactory_1.PushServiceFactory.reset();
            process.env.FIREBASE_PROJECT_ID = 'test-project';
            delete process.env.IOS_BUNDLE_ID;
            PushServiceFactory_1.PushServiceFactory.initializeServices();
            expect(PushServiceFactory_1.PushServiceFactory.isFCMReady()).toBe(true);
            expect(PushServiceFactory_1.PushServiceFactory.isAPNsReady()).toBe(false);
            expect(PushServiceFactory_1.PushServiceFactory.getInitializationErrors().size).toBeGreaterThan(0);
        });
    });
    describe('reset functionality', () => {
        it('should clear all services on reset', () => {
            process.env.FIREBASE_PROJECT_ID = 'test-project';
            process.env.IOS_BUNDLE_ID = 'com.example.app';
            PushServiceFactory_1.PushServiceFactory.initializeServices();
            expect(PushServiceFactory_1.PushServiceFactory.isFCMReady()).toBe(true);
            expect(PushServiceFactory_1.PushServiceFactory.isAPNsReady()).toBe(true);
            PushServiceFactory_1.PushServiceFactory.reset();
            expect(PushServiceFactory_1.PushServiceFactory.getFCMService()).toBeNull();
            expect(PushServiceFactory_1.PushServiceFactory.getAPNsService()).toBeNull();
            expect(PushServiceFactory_1.PushServiceFactory.isFCMReady()).toBe(false);
            expect(PushServiceFactory_1.PushServiceFactory.isAPNsReady()).toBe(false);
        });
        it('should clear initialization errors on reset', () => {
            delete process.env.FIREBASE_PROJECT_ID;
            process.env.IOS_BUNDLE_ID = 'com.example.app';
            PushServiceFactory_1.PushServiceFactory.initializeServices();
            expect(PushServiceFactory_1.PushServiceFactory.getInitializationErrors().size).toBeGreaterThan(0);
            PushServiceFactory_1.PushServiceFactory.reset();
            expect(PushServiceFactory_1.PushServiceFactory.getInitializationErrors().size).toBe(0);
        });
    });
});
