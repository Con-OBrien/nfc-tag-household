"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FCMService_1 = require("../../src/services/FCMService");
describe('FCMService', () => {
    let fcmService;
    const mockProjectId = 'test-project-123';
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
    describe('constructor and initialization', () => {
        it('should initialize with valid project ID', () => {
            process.env.FIREBASE_PROJECT_ID = mockProjectId;
            fcmService = new FCMService_1.FCMService();
            expect(fcmService.isReady()).toBe(true);
            expect(fcmService.getProjectId()).toBe(mockProjectId);
        });
        it('should throw error when project ID is missing', () => {
            delete process.env.FIREBASE_PROJECT_ID;
            expect(() => {
                new FCMService_1.FCMService('', '');
            }).toThrow('Firebase project ID not configured');
        });
        it('should throw error on invalid project ID format', () => {
            expect(() => {
                new FCMService_1.FCMService('invalid PROJECT ID!', '');
            }).toThrow('Invalid Firebase project ID format');
        });
        it('should use environment variables for configuration', () => {
            process.env.FIREBASE_PROJECT_ID = 'env-project-id';
            process.env.FIREBASE_CREDENTIALS_PATH = '/path/to/creds';
            fcmService = new FCMService_1.FCMService();
            expect(fcmService.getProjectId()).toBe('env-project-id');
        });
    });
    describe('sendMessage - successful delivery', () => {
        beforeEach(() => {
            process.env.FIREBASE_PROJECT_ID = mockProjectId;
            fcmService = new FCMService_1.FCMService();
        });
        it('should successfully send message with valid FCM token', async () => {
            const validFCMToken = 'eP5jlmxfvjMxT8_zcOQBtj:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8';
            const result = await fcmService.sendMessage(validFCMToken, mockNotificationPayload);
            expect(result).toBe(true);
        });
        it('should deliver payload with correct structure', async () => {
            const validFCMToken = 'eP5jlmxfvjMxT8_zcOQBtj:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8';
            // Spy on console.log to verify payload is logged
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            await fcmService.sendMessage(validFCMToken, mockNotificationPayload);
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[FCM] Notification delivered'));
            consoleLogSpy.mockRestore();
        });
    });
    describe('sendMessage - invalid token handling', () => {
        beforeEach(() => {
            process.env.FIREBASE_PROJECT_ID = mockProjectId;
            fcmService = new FCMService_1.FCMService();
        });
        it('should throw error on empty token', async () => {
            await expect(fcmService.sendMessage('', mockNotificationPayload)).rejects.toThrow('Invalid FCM push token: token is empty');
        });
        it('should throw error on invalid token format', async () => {
            const invalidToken = 'short_token'; // Too short
            await expect(fcmService.sendMessage(invalidToken, mockNotificationPayload)).rejects.toThrow('Invalid FCM token format');
        });
        it('should throw error on token with invalid characters', async () => {
            const invalidToken = 'valid_length_token_but_with_invalid_@_characters_in_it_' + 'x'.repeat(100);
            await expect(fcmService.sendMessage(invalidToken, mockNotificationPayload)).rejects.toThrow('Invalid FCM token format');
        });
    });
    describe('sendMessage - simulated FCM errors', () => {
        beforeEach(() => {
            process.env.FIREBASE_PROJECT_ID = mockProjectId;
            fcmService = new FCMService_1.FCMService();
        });
        it('should throw token invalid error for test_fail_invalid token', async () => {
            const invalidToken = 'test_fail_invalid_zcOQBtj:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8';
            await expect(fcmService.sendMessage(invalidToken, mockNotificationPayload)).rejects.toThrow('Invalid FCM token');
        });
        it('should throw token expired error for test_fail_expired token', async () => {
            const expiredToken = 'test_fail_expired_zcOQBtj:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8';
            await expect(fcmService.sendMessage(expiredToken, mockNotificationPayload)).rejects.toThrow('Token expired in FCM');
        });
        it('should throw rate limit error for test_fail_rate token', async () => {
            const rateLimitedToken = 'test_fail_rate_zcOQBtj:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8';
            await expect(fcmService.sendMessage(rateLimitedToken, mockNotificationPayload)).rejects.toThrow('FCM rate limit');
        });
        it('should throw service unavailable error for test_fail_unavailable token', async () => {
            const unavailableToken = 'test_fail_unavailable_zcOQBtj:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8';
            await expect(fcmService.sendMessage(unavailableToken, mockNotificationPayload)).rejects.toThrow('FCM service unavailable');
        });
        it('should throw authentication error for test_fail_auth token', async () => {
            const authErrorToken = 'test_fail_auth_zcOQBtj:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8';
            await expect(fcmService.sendMessage(authErrorToken, mockNotificationPayload)).rejects.toThrow('FCM authentication failed');
        });
    });
    describe('token validation', () => {
        beforeEach(() => {
            process.env.FIREBASE_PROJECT_ID = mockProjectId;
            fcmService = new FCMService_1.FCMService();
        });
        it('should accept valid FCM token formats', async () => {
            const validTokens = [
                'eP5jlmxfvjMxT8_zcOQBtj:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8',
                'cN3kL9mN-oP2qR4sT6uV8w:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8',
                'xY1aB3cD5eF7gH9iJ1kL3m:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8',
            ];
            for (const token of validTokens) {
                const result = await fcmService.sendMessage(token, mockNotificationPayload);
                expect(result).toBe(true);
            }
        });
        it('should reject tokens with invalid characters', async () => {
            const invalidTokens = [
                'token@with$special#chars_and_length_is_long_enough_but_chars_are_invalid_tokens',
                'token/with/slashes_and_long_enough_for_validation_but_has_invalid_characters_here',
                'token with spaces_and_length_ok_but_spaces_are_not_allowed_in_tokens_validation',
            ];
            for (const token of invalidTokens) {
                await expect(fcmService.sendMessage(token, mockNotificationPayload)).rejects.toThrow('Invalid FCM token format');
            }
        });
    });
    describe('error classification', () => {
        beforeEach(() => {
            process.env.FIREBASE_PROJECT_ID = mockProjectId;
            fcmService = new FCMService_1.FCMService();
        });
        it('should classify invalid token errors correctly', async () => {
            const invalidToken = 'test_fail_invalid_zcOQBtj:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8';
            try {
                await fcmService.sendMessage(invalidToken, mockNotificationPayload);
                fail('Should have thrown an error');
            }
            catch (error) {
                expect(error instanceof Error).toBe(true);
                if (error instanceof Error) {
                    expect(error.message).toContain('Invalid FCM token');
                }
            }
        });
        it('should classify rate limit errors correctly', async () => {
            const rateLimitToken = 'test_fail_rate_zcOQBtj:APA91bFo1X-8CcqQz8_qZ9xE_5K4xR2yL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8';
            try {
                await fcmService.sendMessage(rateLimitToken, mockNotificationPayload);
                fail('Should have thrown an error');
            }
            catch (error) {
                expect(error instanceof Error).toBe(true);
                if (error instanceof Error) {
                    expect(error.message).toContain('rate limit');
                }
            }
        });
    });
    describe('isReady state check', () => {
        it('should return true after successful initialization', () => {
            process.env.FIREBASE_PROJECT_ID = mockProjectId;
            fcmService = new FCMService_1.FCMService();
            expect(fcmService.isReady()).toBe(true);
        });
        it('should throw error when initialization fails due to missing project ID', () => {
            delete process.env.FIREBASE_PROJECT_ID;
            expect(() => {
                new FCMService_1.FCMService('', '');
            }).toThrow('Firebase project ID not configured');
        });
    });
});
