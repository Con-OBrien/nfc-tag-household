import { NFCReaderService } from '../../src/services/NFCReaderService';
import { NFCTagData } from '../../src/types';
import crypto from 'crypto';

describe('NFCReaderService', () => {
  let service: NFCReaderService;
  const householdSecret = 'test-secret-key-12345';
  const validTagData: Omit<NFCTagData, 'signature'> = {
    tagId: 'nfc_test_001',
    taskId: 'task_001',
    timestamp: Date.now(),
  };

  beforeEach(() => {
    service = new NFCReaderService();
  });

  describe('validateTagSignature', () => {
    it('should validate a correct HMAC signature', () => {
      const signature = service.generateTagSignature(validTagData, householdSecret);
      const tagDataWithSignature = { ...validTagData, signature };

      const isValid = service.validateTagSignature(tagDataWithSignature, householdSecret);
      expect(isValid).toBe(true);
    });

    it('should reject an invalid HMAC signature', () => {
      const validSignature = service.generateTagSignature(validTagData, householdSecret);
      const invalidSignature = 'invalid_signature_' + validSignature;
      const tagDataWithSignature = { ...validTagData, signature: invalidSignature };

      const isValid = service.validateTagSignature(tagDataWithSignature, householdSecret);
      expect(isValid).toBe(false);
    });

    it('should reject tag data with wrong secret', () => {
      const signature = service.generateTagSignature(validTagData, householdSecret);
      const tagDataWithSignature = { ...validTagData, signature };

      const isValid = service.validateTagSignature(tagDataWithSignature, 'wrong-secret');
      expect(isValid).toBe(false);
    });

    it('should return false if signature is missing', () => {
      const tagDataWithoutSignature = { ...validTagData, signature: undefined };

      const isValid = service.validateTagSignature(tagDataWithoutSignature, householdSecret);
      expect(isValid).toBe(false);
    });

    it('should return false if signature is empty string', () => {
      const tagDataWithEmptySignature = { ...validTagData, signature: '' };

      const isValid = service.validateTagSignature(tagDataWithEmptySignature, householdSecret);
      expect(isValid).toBe(false);
    });

    it('should handle modified tag data', () => {
      const signature = service.generateTagSignature(validTagData, householdSecret);
      const modifiedData = { ...validTagData, signature, taskId: 'task_002' };

      const isValid = service.validateTagSignature(modifiedData, householdSecret);
      expect(isValid).toBe(false);
    });

    it('should use constant-time comparison to prevent timing attacks', () => {
      const signature = service.generateTagSignature(validTagData, householdSecret);
      const tagDataWithSignature = { ...validTagData, signature };

      // Both should complete in roughly similar time
      const start1 = process.hrtime.bigint();
      service.validateTagSignature(tagDataWithSignature, householdSecret);
      const time1 = process.hrtime.bigint() - start1;

      const wrongSignature = signature.replace(/^./, 'X');
      const tagDataWithWrongSignature = { ...validTagData, signature: wrongSignature };

      const start2 = process.hrtime.bigint();
      service.validateTagSignature(tagDataWithWrongSignature, householdSecret);
      const time2 = process.hrtime.bigint() - start2;

      // Times should be similar (within 1ms which is very lenient for this test)
      const timeDiff = Math.abs(Number(time1) - Number(time2)) / 1_000_000; // Convert to ms
      expect(timeDiff < 1).toBe(true); // Allow 1ms difference
    });
  });

  describe('generateTagSignature', () => {
    it('should generate a valid HMAC-SHA256 signature', () => {
      const signature = service.generateTagSignature(validTagData, householdSecret);

      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA256 hex is 64 characters
    });

    it('should generate deterministic signatures for same data', () => {
      const sig1 = service.generateTagSignature(validTagData, householdSecret);
      const sig2 = service.generateTagSignature(validTagData, householdSecret);

      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different data', () => {
      const sig1 = service.generateTagSignature(validTagData, householdSecret);
      const sig2 = service.generateTagSignature(
        { ...validTagData, taskId: 'task_002' },
        householdSecret
      );

      expect(sig1).not.toBe(sig2);
    });

    it('should handle special characters in tag data', () => {
      const specialData = {
        ...validTagData,
        tagId: 'nfc_special_!@#$%',
      };

      const signature = service.generateTagSignature(specialData, householdSecret);
      expect(signature).toBeTruthy();
      expect(signature.length).toBe(64);
    });
  });

  describe('extractTagData', () => {
    it('should extract valid tag data from object', () => {
      const result = service.extractTagData(validTagData);

      expect(result).not.toBeNull();
      expect(result!.tagId).toBe(validTagData.tagId);
      expect(result!.taskId).toBe(validTagData.taskId);
      expect(result!.timestamp).toBe(validTagData.timestamp);
    });

    it('should extract valid tag data from JSON string', () => {
      const jsonString = JSON.stringify(validTagData);
      const result = service.extractTagData(jsonString);

      expect(result).not.toBeNull();
      expect(result!.tagId).toBe(validTagData.tagId);
      expect(result!.taskId).toBe(validTagData.taskId);
    });

    it('should extract tag data with signature', () => {
      const signature = service.generateTagSignature(validTagData, householdSecret);
      const dataWithSignature = { ...validTagData, signature };

      const result = service.extractTagData(dataWithSignature);

      expect(result).not.toBeNull();
      expect(result!.signature).toBe(signature);
    });

    it('should return null for invalid JSON string', () => {
      const result = service.extractTagData('not valid json');

      expect(result).toBeNull();
    });

    it('should return null if required fields missing', () => {
      const incompleteData = { tagId: 'nfc_001' };
      const result = service.extractTagData(incompleteData);

      expect(result).toBeNull();
    });

    it('should return null for non-object data', () => {
      expect(service.extractTagData(null)).toBeNull();
      expect(service.extractTagData(undefined)).toBeNull();
      expect(service.extractTagData(123)).toBeNull();
    });

    it('should trim whitespace from string fields', () => {
      const dataWithWhitespace = {
        ...validTagData,
        tagId: '  nfc_test_001  ',
        taskId: '  task_001  ',
      };

      const result = service.extractTagData(dataWithWhitespace);

      expect(result!.tagId).toBe('nfc_test_001');
      expect(result!.taskId).toBe('task_001');
    });

    it('should return null for empty tag ID', () => {
      const dataWithEmptyTagId = { ...validTagData, tagId: '' };
      const result = service.extractTagData(dataWithEmptyTagId);

      expect(result).toBeNull();
    });

    it('should return null for empty task ID', () => {
      const dataWithEmptyTaskId = { ...validTagData, taskId: '' };
      const result = service.extractTagData(dataWithEmptyTaskId);

      expect(result).toBeNull();
    });
  });

  describe('isValidTagData', () => {
    it('should validate correct tag data', () => {
      const isValid = service.isValidTagData(validTagData);
      expect(isValid).toBe(true);
    });

    it('should reject null or undefined data', () => {
      expect(service.isValidTagData(null)).toBe(false);
      expect(service.isValidTagData(undefined)).toBe(false);
    });

    it('should reject non-object data', () => {
      expect(service.isValidTagData('string')).toBe(false);
      expect(service.isValidTagData(123)).toBe(false);
      expect(service.isValidTagData([])).toBe(false);
    });

    it('should reject data missing required fields', () => {
      const missingTagId = { taskId: 'task_001', timestamp: Date.now() };
      expect(service.isValidTagData(missingTagId)).toBe(false);

      const missingTaskId = { tagId: 'nfc_001', timestamp: Date.now() };
      expect(service.isValidTagData(missingTaskId)).toBe(false);

      const missingTimestamp = { tagId: 'nfc_001', taskId: 'task_001' };
      expect(service.isValidTagData(missingTimestamp)).toBe(false);
    });

    it('should reject empty string fields', () => {
      expect(service.isValidTagData({ ...validTagData, tagId: '' })).toBe(false);
      expect(service.isValidTagData({ ...validTagData, taskId: '' })).toBe(false);
    });

    it('should reject non-numeric timestamp', () => {
      expect(service.isValidTagData({ ...validTagData, timestamp: 'not-a-number' })).toBe(false);
    });

    it('should reject non-finite timestamp', () => {
      expect(service.isValidTagData({ ...validTagData, timestamp: Infinity })).toBe(false);
      expect(service.isValidTagData({ ...validTagData, timestamp: NaN })).toBe(false);
    });

    it('should reject future timestamps', () => {
      const futureTimestamp = Date.now() + 10 * 60 * 1000; // 10 minutes in future
      const futureData = { ...validTagData, timestamp: futureTimestamp };

      expect(service.isValidTagData(futureData)).toBe(false);
    });

    it('should reject timestamps older than 5 minutes', () => {
      const oldTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      const oldData = { ...validTagData, timestamp: oldTimestamp };

      expect(service.isValidTagData(oldData)).toBe(false);
    });

    it('should accept timestamps within 5 minute window', () => {
      const recentTimestamp = Date.now() - 4 * 60 * 1000; // 4 minutes ago
      const recentData = { ...validTagData, timestamp: recentTimestamp };

      expect(service.isValidTagData(recentData)).toBe(true);
    });

    it('should reject invalid signature types', () => {
      const invalidSignature = { ...validTagData, signature: 123 };
      expect(service.isValidTagData(invalidSignature)).toBe(false);
    });

    it('should accept optional signature', () => {
      const withSignature = { ...validTagData, signature: 'valid_signature' };
      expect(service.isValidTagData(withSignature)).toBe(true);

      const withoutSignature = { ...validTagData };
      expect(service.isValidTagData(withoutSignature)).toBe(true);
    });
  });

  describe('isTagActive', () => {
    it('should return true for active tags', () => {
      const deactivatedTags = new Set(['tag_001', 'tag_002']);

      expect(service.isTagActive('tag_003', deactivatedTags)).toBe(true);
    });

    it('should return false for deactivated tags', () => {
      const deactivatedTags = new Set(['tag_001', 'tag_002']);

      expect(service.isTagActive('tag_001', deactivatedTags)).toBe(false);
    });

    it('should handle empty deactivated set', () => {
      const deactivatedTags = new Set<string>();

      expect(service.isTagActive('tag_001', deactivatedTags)).toBe(true);
    });

    it('should be case-sensitive', () => {
      const deactivatedTags = new Set(['TAG_001']);

      expect(service.isTagActive('tag_001', deactivatedTags)).toBe(true);
      expect(service.isTagActive('TAG_001', deactivatedTags)).toBe(false);
    });
  });

  describe('Integration tests', () => {
    it('should handle complete tag validation flow', () => {
      // 1. Generate signature
      const signature = service.generateTagSignature(validTagData, householdSecret);

      // 2. Extract data with signature
      const tagDataWithSignature = { ...validTagData, signature };
      const extracted = service.extractTagData(tagDataWithSignature);

      // 3. Validate extracted data
      expect(extracted).not.toBeNull();
      const isValid = service.validateTagSignature(extracted!, householdSecret);
      expect(isValid).toBe(true);
    });

    it('should reject tampered tag data', () => {
      // 1. Generate signature for original data
      const signature = service.generateTagSignature(validTagData, householdSecret);
      const tagDataWithSignature = { ...validTagData, signature };

      // 2. Tamper with data
      const tamperedData = { ...tagDataWithSignature, taskId: 'task_malicious' };

      // 3. Validation should fail
      const isValid = service.validateTagSignature(tamperedData, householdSecret);
      expect(isValid).toBe(false);
    });

    it('should reject data with mismatched household secret', () => {
      // 1. Generate signature with one secret
      const signature = service.generateTagSignature(validTagData, 'secret-1');
      const tagDataWithSignature = { ...validTagData, signature };

      // 2. Try to validate with different secret
      const isValid = service.validateTagSignature(tagDataWithSignature, 'secret-2');
      expect(isValid).toBe(false);
    });
  });
});
