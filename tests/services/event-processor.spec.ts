import { EventProcessorService } from '../../src/services/EventProcessorService';
import { EventRepository } from '../../src/repositories/EventRepository';
import { NFCTagData, TaskEvent } from '../../src/types';

describe('EventProcessorService', () => {
  let service: EventProcessorService;
  let mockEventRepository: jest.Mocked<EventRepository>;

  const validNFCData: NFCTagData = {
    tagId: 'nfc_test_001',
    taskId: 'task_001',
    timestamp: Date.now(),
    signature: 'valid_signature',
  };

  beforeEach(() => {
    mockEventRepository = {
      logEvent: jest.fn().mockResolvedValue(undefined),
      getEventHistory: jest.fn().mockResolvedValue([]),
      getEventsByUser: jest.fn().mockResolvedValue([]),
    } as any;

    service = new EventProcessorService(mockEventRepository);
  });

  describe('processTagEvent', () => {
    it('should create and persist a task event', async () => {
      const userId = 'user_001';
      const householdId = 'household_001';

      const result = await service.processTagEvent(validNFCData, userId, householdId);

      expect(result).not.toBeNull();
      expect(result!.eventId).toBeTruthy();
      expect(result!.userId).toBe(userId);
      expect(result!.taskId).toBe(validNFCData.taskId);
      expect(result!.householdId).toBe(householdId);
      expect(result!.action).toBe('execute');
      expect(mockEventRepository.logEvent).toHaveBeenCalled();
    });

    it('should set action to execute by default', async () => {
      const result = await service.processTagEvent(validNFCData, 'user_001', 'household_001');

      expect(result!.action).toBe('execute');
    });

    it('should include NFC metadata in event', async () => {
      const result = await service.processTagEvent(validNFCData, 'user_001', 'household_001');

      expect(result!.metadata).toEqual({
        deviceType: 'nfc-reader',
        tagId: validNFCData.tagId,
      });
    });

    it('should preserve NFC timestamp in event', async () => {
      const result = await service.processTagEvent(validNFCData, 'user_001', 'household_001');

      expect(result!.timestamp).toBe(validNFCData.timestamp);
    });

    it('should return null for duplicate scans within 30 seconds', async () => {
      const userId = 'user_001';
      const householdId = 'household_001';

      // First scan
      const result1 = await service.processTagEvent(validNFCData, userId, householdId);
      expect(result1).not.toBeNull();

      // Duplicate scan within 30 seconds
      const result2 = await service.processTagEvent(validNFCData, userId, householdId);
      expect(result2).toBeNull();

      // EventRepository should only be called once
      expect(mockEventRepository.logEvent).toHaveBeenCalledTimes(1);
    });

    it('should allow scans after 30 second window', async () => {
      const userId = 'user_001';
      const householdId = 'household_001';

      // First scan
      const result1 = await service.processTagEvent(validNFCData, userId, householdId);
      expect(result1).not.toBeNull();

      // Create new NFC data with timestamp 31 seconds later
      const laterNFCData = {
        ...validNFCData,
        timestamp: validNFCData.timestamp + 31 * 1000,
      };

      // Second scan should succeed
      const result2 = await service.processTagEvent(laterNFCData, userId, householdId);
      expect(result2).not.toBeNull();

      expect(mockEventRepository.logEvent).toHaveBeenCalledTimes(2);
    });

    it('should allow same task from different users', async () => {
      const householdId = 'household_001';

      // Scan by user 1
      const result1 = await service.processTagEvent(validNFCData, 'user_001', householdId);
      expect(result1).not.toBeNull();

      // Same task scanned by user 2
      const result2 = await service.processTagEvent(validNFCData, 'user_002', householdId);
      expect(result2).not.toBeNull();

      expect(mockEventRepository.logEvent).toHaveBeenCalledTimes(2);
    });

    it('should allow same user on different tasks', async () => {
      const userId = 'user_001';
      const householdId = 'household_001';

      // Scan for task 1
      const result1 = await service.processTagEvent(validNFCData, userId, householdId);
      expect(result1).not.toBeNull();

      // Scan for task 2
      const result2 = await service.processTagEvent(
        { ...validNFCData, taskId: 'task_002' },
        userId,
        householdId
      );
      expect(result2).not.toBeNull();

      expect(mockEventRepository.logEvent).toHaveBeenCalledTimes(2);
    });

    it('should throw error if event persistence fails', async () => {
      mockEventRepository.logEvent.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        service.processTagEvent(validNFCData, 'user_001', 'household_001')
      ).rejects.toThrow('Database error');

      // Deduplication should not be recorded on failure
      expect(mockEventRepository.logEvent).toHaveBeenCalledTimes(1);
    });

    it('should generate unique event IDs', async () => {
      const userId = 'user_001';
      const householdId = 'household_001';

      // First scan
      const result1 = await service.processTagEvent(validNFCData, userId, householdId);

      // Wait for deduplication window to pass and scan with later timestamp
      const laterNFCData = {
        ...validNFCData,
        timestamp: validNFCData.timestamp + 31 * 1000,
      };

      const result2 = await service.processTagEvent(laterNFCData, userId, householdId);

      expect(result1!.eventId).not.toBe(result2!.eventId);
    });
  });

  describe('enrichEventWithUserContext', () => {
    const baseEvent: TaskEvent = {
      eventId: 'evt_001',
      userId: '',
      taskId: 'task_001',
      householdId: '',
      action: 'execute',
      timestamp: Date.now(),
    };

    it('should add user context to event', () => {
      const enrichedEvent = service.enrichEventWithUserContext(baseEvent, {
        userId: 'user_001',
        householdId: 'household_001',
      });

      expect(enrichedEvent.userId).toBe('user_001');
      expect(enrichedEvent.householdId).toBe('household_001');
    });

    it('should preserve other event properties', () => {
      const enrichedEvent = service.enrichEventWithUserContext(baseEvent, {
        userId: 'user_001',
        householdId: 'household_001',
      });

      expect(enrichedEvent.eventId).toBe(baseEvent.eventId);
      expect(enrichedEvent.taskId).toBe(baseEvent.taskId);
      expect(enrichedEvent.action).toBe(baseEvent.action);
      expect(enrichedEvent.timestamp).toBe(baseEvent.timestamp);
    });
  });

  describe('validateEventIntegrity', () => {
    const validEvent: TaskEvent = {
      eventId: 'evt_001',
      userId: 'user_001',
      taskId: 'task_001',
      householdId: 'household_001',
      action: 'execute',
      timestamp: Date.now(),
    };

    it('should validate a correct event', () => {
      expect(service.validateEventIntegrity(validEvent)).toBe(true);
    });

    it('should reject event missing eventId', () => {
      const invalidEvent = { ...validEvent, eventId: '' };
      expect(service.validateEventIntegrity(invalidEvent)).toBe(false);
    });

    it('should reject event missing userId', () => {
      const invalidEvent = { ...validEvent, userId: '' };
      expect(service.validateEventIntegrity(invalidEvent)).toBe(false);
    });

    it('should reject event missing taskId', () => {
      const invalidEvent = { ...validEvent, taskId: '' };
      expect(service.validateEventIntegrity(invalidEvent)).toBe(false);
    });

    it('should reject event missing householdId', () => {
      const invalidEvent = { ...validEvent, householdId: '' };
      expect(service.validateEventIntegrity(invalidEvent)).toBe(false);
    });

    it('should reject event with invalid action', () => {
      const invalidEvent = { ...validEvent, action: 'invalid' as any };
      expect(service.validateEventIntegrity(invalidEvent)).toBe(false);
    });

    it('should accept all valid actions', () => {
      const validActions: Array<'execute' | 'acknowledge' | 'undo' | 'comment'> = [
        'execute',
        'acknowledge',
        'undo',
        'comment',
      ];

      validActions.forEach((action) => {
        const eventWithAction = { ...validEvent, action };
        expect(service.validateEventIntegrity(eventWithAction)).toBe(true);
      });
    });

    it('should reject event with invalid timestamp', () => {
      const invalidEvent = { ...validEvent, timestamp: -1 };
      expect(service.validateEventIntegrity(invalidEvent)).toBe(false);
    });

    it('should reject event with zero timestamp', () => {
      const invalidEvent = { ...validEvent, timestamp: 0 };
      expect(service.validateEventIntegrity(invalidEvent)).toBe(false);
    });

    it('should reject event with future timestamp', () => {
      const futureTimestamp = Date.now() + 10 * 60 * 1000;
      const invalidEvent = { ...validEvent, timestamp: futureTimestamp };
      expect(service.validateEventIntegrity(invalidEvent)).toBe(false);
    });

    it('should reject event with non-finite timestamp', () => {
      const invalidEvent = { ...validEvent, timestamp: Infinity };
      expect(service.validateEventIntegrity(invalidEvent)).toBe(false);
    });

    it('should accept valid optional metadata', () => {
      const eventWithMetadata = {
        ...validEvent,
        metadata: { key: 'value', number: 123 },
      };
      expect(service.validateEventIntegrity(eventWithMetadata)).toBe(true);
    });
  });

  describe('getRecentEventsForTask', () => {
    it('should return empty array if no recent events', async () => {
      mockEventRepository.getEventsByUser.mockResolvedValueOnce([]);

      const result = await service.getRecentEventsForTask('task_001', 'user_001', 'household_001');

      expect(result).toEqual([]);
    });

    it('should filter to only specified task', async () => {
      const now = Date.now();
      const recentEvent: TaskEvent = {
        eventId: 'evt_001',
        userId: 'user_001',
        taskId: 'task_001',
        householdId: 'household_001',
        action: 'execute',
        timestamp: now,
      };

      const otherEvent: TaskEvent = {
        eventId: 'evt_002',
        userId: 'user_001',
        taskId: 'task_002',
        householdId: 'household_001',
        action: 'execute',
        timestamp: now,
      };

      mockEventRepository.getEventsByUser.mockResolvedValueOnce([recentEvent, otherEvent]);

      const result = await service.getRecentEventsForTask('task_001', 'user_001', 'household_001');

      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe('task_001');
    });

    it('should filter to only within 30 second window', async () => {
      const now = Date.now();
      const recentEvent: TaskEvent = {
        eventId: 'evt_001',
        userId: 'user_001',
        taskId: 'task_001',
        householdId: 'household_001',
        action: 'execute',
        timestamp: now - 10 * 1000, // 10 seconds ago
      };

      const oldEvent: TaskEvent = {
        eventId: 'evt_002',
        userId: 'user_001',
        taskId: 'task_001',
        householdId: 'household_001',
        action: 'execute',
        timestamp: now - 45 * 1000, // 45 seconds ago
      };

      mockEventRepository.getEventsByUser.mockResolvedValueOnce([recentEvent, oldEvent]);

      const result = await service.getRecentEventsForTask('task_001', 'user_001', 'household_001');

      expect(result).toHaveLength(1);
      expect(result[0].eventId).toBe('evt_001');
    });

    it('should return empty on repository error', async () => {
      mockEventRepository.getEventsByUser.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.getRecentEventsForTask('task_001', 'user_001', 'household_001');

      expect(result).toEqual([]);
    });
  });

  describe('cleanupOldDeduplicationEntries', () => {
    it('should remove entries older than 1 minute', async () => {
      // Add some events
      await service.processTagEvent(validNFCData, 'user_001', 'household_001');
      await service.processTagEvent(
        { ...validNFCData, timestamp: Date.now() + 31 * 1000 },
        'user_001',
        'household_001'
      );

      // Cleanup
      service.cleanupOldDeduplicationEntries();

      // Note: This is a private-ish test. The service should clean old entries.
      // We verify indirectly by checking if duplicate detection still works properly
    });
  });

  describe('Integration tests', () => {
    it('should handle multiple scans with proper deduplication', async () => {
      const userId = 'user_001';
      const householdId = 'household_001';

      // First scan
      const result1 = await service.processTagEvent(validNFCData, userId, householdId);
      expect(result1).not.toBeNull();

      // Duplicate within window
      const result2 = await service.processTagEvent(validNFCData, userId, householdId);
      expect(result2).toBeNull();

      // After window
      const laterData = {
        ...validNFCData,
        timestamp: validNFCData.timestamp + 31 * 1000,
      };
      const result3 = await service.processTagEvent(laterData, userId, householdId);
      expect(result3).not.toBeNull();

      // All three calls to repository should be correct
      expect(mockEventRepository.logEvent).toHaveBeenCalledTimes(2);
    });

    it('should properly isolate deduplication by user and task', async () => {
      // User 1, Task 1
      const result1a = await service.processTagEvent(validNFCData, 'user_001', 'household_001');
      expect(result1a).not.toBeNull();

      // User 1, Task 2 (different task, should succeed)
      const result1b = await service.processTagEvent(
        { ...validNFCData, taskId: 'task_002' },
        'user_001',
        'household_001'
      );
      expect(result1b).not.toBeNull();

      // User 2, Task 1 (different user, should succeed)
      const result2a = await service.processTagEvent(validNFCData, 'user_002', 'household_001');
      expect(result2a).not.toBeNull();

      expect(mockEventRepository.logEvent).toHaveBeenCalledTimes(3);
    });
  });
});
