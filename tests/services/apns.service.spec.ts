import { APNsService } from '../../src/services/APNsService';
import { NotificationPayload } from '../../src/types';

describe('APNsService', () => {
  let apnsService: APNsService;

  const mockBundleId = 'com.example.nfctag';
  const mockTeamId = 'ABCDE12345';
  const mockKeyId = 'KEY123456';

  const mockNotificationPayload: NotificationPayload = {
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
    it('should initialize with valid bundle ID', () => {
      process.env.IOS_BUNDLE_ID = mockBundleId;
      apnsService = new APNsService();

      expect(apnsService.isReady()).toBe(true);
      expect(apnsService.getBundleId()).toBe(mockBundleId);
    });

    it('should use environment variables for configuration', () => {
      process.env.IOS_BUNDLE_ID = 'com.myapp.ios';
      process.env.APPLE_TEAM_ID = mockTeamId;
      process.env.APNS_KEY_ID = mockKeyId;

      apnsService = new APNsService();

      expect(apnsService.getBundleId()).toBe('com.myapp.ios');
    });

    it('should throw error when bundle ID is missing', () => {
      delete process.env.IOS_BUNDLE_ID;

      expect(() => {
        new APNsService('', '', '', '', '');
      }).toThrow('iOS bundle ID not configured');
    });

    it('should throw error on invalid bundle ID format', () => {
      expect(() => {
        new APNsService('', '', '', '', 'invalid_bundle_id_no_dots');
      }).toThrow('Invalid iOS bundle ID format');
    });

    it('should accept valid bundle ID formats', () => {
      process.env.IOS_BUNDLE_ID = mockBundleId;
      apnsService = new APNsService();

      expect(apnsService.getBundleId()).toBe(mockBundleId);
    });
  });

  describe('sendNotification - successful delivery', () => {
    beforeEach(() => {
      process.env.IOS_BUNDLE_ID = mockBundleId;
      apnsService = new APNsService();
    });

    it('should successfully send notification with valid APNs token', async () => {
      const validAPNsToken = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f';

      const result = await apnsService.sendNotification(validAPNsToken, mockNotificationPayload);

      expect(result).toBe(true);
    });

    it('should accept uppercase hex tokens', async () => {
      const validAPNsToken = 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6A7B8C9D0E1F';

      const result = await apnsService.sendNotification(validAPNsToken, mockNotificationPayload);

      expect(result).toBe(true);
    });

    it('should deliver payload with correct structure', async () => {
      const validAPNsToken = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f';

      // Spy on console.log to verify payload is logged
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await apnsService.sendNotification(validAPNsToken, mockNotificationPayload);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[APNs] Notification delivered')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('sendNotification - invalid token handling', () => {
    beforeEach(() => {
      process.env.IOS_BUNDLE_ID = mockBundleId;
      apnsService = new APNsService();
    });

    it('should throw error on empty token', async () => {
      await expect(apnsService.sendNotification('', mockNotificationPayload)).rejects.toThrow(
        'Invalid APNs push token: token is empty'
      );
    });

    it('should throw error on token with incorrect length', async () => {
      const tooShortToken = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'; // 32 hex chars instead of 64

      await expect(
        apnsService.sendNotification(tooShortToken, mockNotificationPayload)
      ).rejects.toThrow('Invalid APNs token format');
    });

    it('should throw error on token with non-hex characters', async () => {
      const invalidToken = 'z1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f'; // 'z' is not hex

      await expect(
        apnsService.sendNotification(invalidToken, mockNotificationPayload)
      ).rejects.toThrow('Invalid APNs token format');
    });

    it('should throw error on token with incorrect length but valid hex', async () => {
      const tooLongToken = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f00'; // 65 chars

      await expect(
        apnsService.sendNotification(tooLongToken, mockNotificationPayload)
      ).rejects.toThrow('Invalid APNs token format');
    });
  });

  describe('sendNotification - simulated APNs errors', () => {
    beforeEach(() => {
      process.env.IOS_BUNDLE_ID = mockBundleId;
      apnsService = new APNsService();
    });

    it('should throw token invalid error for test_fail_invalid token', async () => {
      const invalidToken = 'test_fail_invalid_0123456789abcdef0123456789abcdef0123456789abcdef01';

      await expect(
        apnsService.sendNotification(invalidToken, mockNotificationPayload)
      ).rejects.toThrow('Invalid APNs token');
    });

    it('should throw token expired error for test_fail_expired token', async () => {
      const expiredToken = 'test_fail_expiredabcdef0123456789abcdef0123456789abcdef012345';

      await expect(
        apnsService.sendNotification(expiredToken, mockNotificationPayload)
      ).rejects.toThrow('Token expired in APNs');
    });

    it('should throw rate limit error for test_fail_rate token', async () => {
      const rateLimitedToken = 'test_fail_rate__0123456789abcdef0123456789abcdef0123456789abcdef0';

      await expect(
        apnsService.sendNotification(rateLimitedToken, mockNotificationPayload)
      ).rejects.toThrow('APNs rate limit');
    });

    it('should throw service unavailable error for test_fail_unavailable token', async () => {
      const unavailableToken =
        'test_fail_unavailab0123456789abcdef0123456789abcdef0123456789abcdef';

      await expect(
        apnsService.sendNotification(unavailableToken, mockNotificationPayload)
      ).rejects.toThrow('APNs service unavailable');
    });

    it('should throw authentication error for test_fail_auth token', async () => {
      const authErrorToken = 'test_fail_auth__abcdef0123456789abcdef0123456789abcdef0123456789abcd';

      await expect(
        apnsService.sendNotification(authErrorToken, mockNotificationPayload)
      ).rejects.toThrow('APNs authentication failed');
    });
  });

  describe('token validation', () => {
    beforeEach(() => {
      process.env.IOS_BUNDLE_ID = mockBundleId;
      apnsService = new APNsService();
    });

    it('should accept valid 64-character hex tokens', async () => {
      const validTokens = [
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a', // lowercase
        'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9F0A', // uppercase
        'aAbBcCdDeEfF0011223344556677889900aAbBcCdDeEfF0011223344556677', // mixed
      ];

      for (const token of validTokens) {
        const result = await apnsService.sendNotification(token, mockNotificationPayload);
        expect(result).toBe(true);
      }
    });

    it('should reject non-64-character tokens', async () => {
      const invalidTokens = [
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f', // 63 chars
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1', // 65 chars
        '', // empty
      ];

      for (const token of invalidTokens) {
        await expect(
          apnsService.sendNotification(token, mockNotificationPayload)
        ).rejects.toThrow();
      }
    });

    it('should reject tokens with non-hex characters', async () => {
      const invalidTokens = [
        'g1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a', // 'g' not hex
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0z', // 'z' not hex
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0@', // '@' not hex
      ];

      for (const token of invalidTokens) {
        await expect(
          apnsService.sendNotification(token, mockNotificationPayload)
        ).rejects.toThrow('Invalid APNs token format');
      }
    });
  });

  describe('error classification', () => {
    beforeEach(() => {
      process.env.IOS_BUNDLE_ID = mockBundleId;
      apnsService = new APNsService();
    });

    it('should classify token expired errors correctly', async () => {
      const expiredToken = 'test_fail_expiredabcdef0123456789abcdef0123456789abcdef012345';

      try {
        await apnsService.sendNotification(expiredToken, mockNotificationPayload);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        if (error instanceof Error) {
          expect(error.message).toContain('Token expired in APNs');
        }
      }
    });

    it('should classify authentication errors correctly', async () => {
      const authToken = 'test_fail_auth__abcdef0123456789abcdef0123456789abcdef0123456789abcd';

      try {
        await apnsService.sendNotification(authToken, mockNotificationPayload);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        if (error instanceof Error) {
          expect(error.message).toContain('APNs authentication failed');
        }
      }
    });

    it('should classify rate limit errors correctly', async () => {
      const rateLimitToken = 'test_fail_rate__0123456789abcdef0123456789abcdef0123456789abcdef0';

      try {
        await apnsService.sendNotification(rateLimitToken, mockNotificationPayload);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        if (error instanceof Error) {
          expect(error.message).toContain('APNs rate limit');
        }
      }
    });
  });

  describe('isReady state check', () => {
    it('should return true after successful initialization', () => {
      process.env.IOS_BUNDLE_ID = mockBundleId;
      apnsService = new APNsService();

      expect(apnsService.isReady()).toBe(true);
    });
  });

  describe('getBundleId method', () => {
    it('should return the configured bundle ID', () => {
      process.env.IOS_BUNDLE_ID = 'com.custom.bundle.id';
      apnsService = new APNsService();

      expect(apnsService.getBundleId()).toBe('com.custom.bundle.id');
    });
  });
});
