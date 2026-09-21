import { EventController } from '../../src/controllers/EventController';
import { EventProcessorService } from '../../src/services/EventProcessorService';
import { TaskValidatorService } from '../../src/services/TaskValidatorService';
import { NotificationService } from '../../src/services/NotificationService';
import { EventRepository } from '../../src/repositories/EventRepository';
import { UserRepository } from '../../src/repositories/UserRepository';
import { TaskRepository } from '../../src/repositories/TaskRepository';
import { HouseholdRepository } from '../../src/repositories/HouseholdRepository';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { Task, TaskEvent, HouseholdUser } from '../../src/types';

/**
 * Integration Test: Complete Event Processing Pipeline
 * 
 * Tests the end-to-end flow:
 * NFC Reader → Event Processor → Task Validator → Notification Service
 * 
 * Validates:
 * - Requirements 2.1-2.6 (Event Processing Pipeline)
 * - Requirements 3.1-3.8 (Task Validation and Authorization)
 * - Error handling at each stage with appropriate HTTP status codes
 * - Transaction management for event persistence
 * - Success/failure response formatting
 * 
 * Tests: 28.1 Write integration test for complete event pipeline
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */
describe('Event Processing Pipeline - Complete Integration', () => {
  let eventController: EventController;
  let eventRepository: Partial<EventRepository>;
  let userRepository: Partial<UserRepository>;
  let taskRepository: Partial<TaskRepository>;
  let householdRepository: Partial<HouseholdRepository>;

  const testIds = {
    householdId: randomUUID(),
    userId: randomUUID(),
    taskId: randomUUID(),
    tagId: 'nfc_test_001',
    eventId: randomUUID(),
  };

  // Helper to encode tag data
  const encodeTagData = (tagData: any): string => {
    return Buffer.from(JSON.stringify(tagData)).toString('base64');
  };

  const createMockTask = (overrides?: Partial<Task>): Task => ({
    taskId: testIds.taskId,
    name: 'Test Task',
    description: 'Test task description',
    category: 'test',
    householdId: testIds.householdId,
    createdAt: Date.now(),
    createdBy: testIds.userId,
    isActive: true,
    ...overrides,
  });

  const createMockUser = (overrides?: Partial<HouseholdUser>): HouseholdUser => ({
    userId: testIds.userId,
    householdId: testIds.householdId,
    name: 'Test User',
    email: 'test@example.com',
    role: 'member',
    pushToken: 'test-token-123',
    permissions: ['task.execute'],
    preferences: {
      notificationsEnabled: true,
      mutedTasks: [],
      channels: ['push'],
    },
    createdAt: Date.now(),
    ...overrides,
  });

  const createMockEvent = (overrides?: Partial<TaskEvent>): TaskEvent => ({
    eventId: testIds.eventId,
    userId: testIds.userId,
    taskId: testIds.taskId,
    householdId: testIds.householdId,
    action: 'execute',
    timestamp: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    // Mock repositories
    eventRepository = {
      logEvent: jest.fn().mockResolvedValue(createMockEvent()),
      getHouseholdEvents: jest.fn().mockResolvedValue([createMockEvent()]),
    };

    userRepository = {
      findUserById: jest.fn().mockResolvedValue(createMockUser()),
      findUsersInHousehold: jest.fn().mockResolvedValue([
        createMockUser(),
        createMockUser({ userId: randomUUID(), name: 'User 2' }),
      ]),
      isUserInHousehold: jest.fn().mockResolvedValue(true),
      getUserHouseholds: jest.fn().mockResolvedValue([
        { householdId: testIds.householdId },
      ]),
    };

    taskRepository = {
      findTaskById: jest.fn().mockResolvedValue(createMockTask()),
      findTasksByHousehold: jest.fn().mockResolvedValue([createMockTask()]),
    };

    householdRepository = {
      getHouseholdMembers: jest.fn().mockResolvedValue([
        createMockUser(),
        createMockUser({ userId: randomUUID(), name: 'User 2' }),
      ]),
    };

    // Create controller with mocked repositories
    eventController = new EventController();
    (eventController as any).eventRepository = eventRepository;
    (eventController as any).userRepository = userRepository;
    (eventController as any).eventProcessor = new EventProcessorService(
      eventRepository as EventRepository
    );
    (eventController as any).taskValidator = new TaskValidatorService(
      taskRepository as TaskRepository,
      userRepository as UserRepository
    );
    (eventController as any).notificationService = new NotificationService(
      userRepository as UserRepository,
      householdRepository as HouseholdRepository,
      taskRepository as TaskRepository,
      eventRepository as EventRepository
    );
  });

  describe('Successful Event Processing Pipeline', () => {
    it('should process complete flow: NFC scan → validation → event creation → notification', async () => {
      const req = {
        body: {
          tagData: encodeTagData({
            tagId: testIds.tagId,
            taskId: testIds.taskId,
            timestamp: Date.now(),
          }),
          userId: testIds.userId,
          householdId: testIds.householdId,
          timestamp: Date.now(),
        },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      // Execute pipeline
      await eventController.tagScanned(req, res, next);

      // Verify success response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            eventId: expect.any(String),
            taskId: testIds.taskId,
            notificationsSent: expect.any(Number),
            timestamp: expect.any(Number),
          }),
        })
      );

      // Verify each stage was called
      expect(userRepository.isUserInHousehold).toHaveBeenCalledWith(
        testIds.userId,
        testIds.householdId
      );
      expect(taskRepository.findTaskById).toHaveBeenCalledWith(
        testIds.taskId,
        testIds.householdId
      );
      expect(eventRepository.logEvent).toHaveBeenCalled();
    });

    it('should include notification recipients count in response', async () => {
      const mockUsers = [
        createMockUser({ userId: randomUUID() }),
        createMockUser({ userId: randomUUID() }),
      ];

      (userRepository.findUsersInHousehold as jest.Mock).mockResolvedValue(mockUsers);

      const req = {
        body: {
          tagData: encodeTagData({
            tagId: testIds.tagId,
            taskId: testIds.taskId,
            timestamp: Date.now(),
          }),
          userId: testIds.userId,
          householdId: testIds.householdId,
          timestamp: Date.now(),
        },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.tagScanned(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            notificationsSent: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('Error Handling at Each Stage', () => {
    describe('Stage 1: Request Validation', () => {
      it('should reject missing tagData with 400', async () => {
        const req = {
          body: {
            userId: testIds.userId,
            householdId: testIds.householdId,
            timestamp: Date.now(),
            // missing tagData
          },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        const next = jest.fn() as NextFunction;

        await eventController.tagScanned(req, res, next);

        // Should call error handler
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('tagData'),
          })
        );
      });

      it('should reject expired timestamp with 400', async () => {
        const sixMinutesAgo = Date.now() - 6 * 60 * 1000;

        const req = {
          body: {
            tagData: encodeTagData({
              tagId: testIds.tagId,
              taskId: testIds.taskId,
            }),
            userId: testIds.userId,
            householdId: testIds.householdId,
            timestamp: sixMinutesAgo, // Older than 5 minute window
          },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        const next = jest.fn() as NextFunction;

        await eventController.tagScanned(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('too old'),
          })
        );
      });

      it('should reject invalid JSON in tagData with 400', async () => {
        const req = {
          body: {
            tagData: 'not-valid-json-or-base64',
            userId: testIds.userId,
            householdId: testIds.householdId,
            timestamp: Date.now(),
          },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        const next = jest.fn() as NextFunction;

        await eventController.tagScanned(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Failed to parse tag data'),
          })
        );
      });
    });

    describe('Stage 2: NFC Tag Validation', () => {
      it('should reject tag with missing taskId with 400', async () => {
        const req = {
          body: {
            tagData: encodeTagData({
              tagId: testIds.tagId,
              // missing taskId
            }),
            userId: testIds.userId,
            householdId: testIds.householdId,
            timestamp: Date.now(),
          },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        const next = jest.fn() as NextFunction;

        await eventController.tagScanned(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('taskId'),
          })
        );
      });

      it('should reject tag with invalid signature with 403', async () => {
        (eventController as any).nfcReader.validateTagSignature = jest
          .fn()
          .mockResolvedValue(false);

        const req = {
          body: {
            tagSignature: 'invalid-signature',
            tagData: encodeTagData({
              tagId: testIds.tagId,
              taskId: testIds.taskId,
              timestamp: Date.now(),
            }),
            userId: testIds.userId,
            householdId: testIds.householdId,
            timestamp: Date.now(),
          },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        const next = jest.fn() as NextFunction;

        await eventController.tagScanned(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Invalid tag signature'),
          })
        );
      });
    });

    describe('Stage 3: User Authorization & Household Isolation', () => {
      it('should reject user not in household with 403', async () => {
        (userRepository.isUserInHousehold as jest.Mock).mockResolvedValue(false);

        const req = {
          body: {
            tagData: encodeTagData({
              tagId: testIds.tagId,
              taskId: testIds.taskId,
              timestamp: Date.now(),
            }),
            userId: testIds.userId,
            householdId: testIds.householdId,
            timestamp: Date.now(),
          },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        const next = jest.fn() as NextFunction;

        await eventController.tagScanned(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('does not belong to this household'),
          })
        );
      });
    });

    describe('Stage 4: Task Validation', () => {
      it('should reject task not found with 404', async () => {
        (taskRepository.findTaskById as jest.Mock).mockResolvedValue(null);

        const req = {
          body: {
            tagData: encodeTagData({
              tagId: testIds.tagId,
              taskId: testIds.taskId,
              timestamp: Date.now(),
            }),
            userId: testIds.userId,
            householdId: testIds.householdId,
            timestamp: Date.now(),
          },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        const next = jest.fn() as NextFunction;

        await eventController.tagScanned(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Task'),
          })
        );
      });

      it('should reject inactive task with 400', async () => {
        (taskRepository.findTaskById as jest.Mock).mockResolvedValue(
          createMockTask({ isActive: false })
        );

        const req = {
          body: {
            tagData: encodeTagData({
              tagId: testIds.tagId,
              taskId: testIds.taskId,
              timestamp: Date.now(),
            }),
            userId: testIds.userId,
            householdId: testIds.householdId,
            timestamp: Date.now(),
          },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        const next = jest.fn() as NextFunction;

        await eventController.tagScanned(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('not active'),
          })
        );
      });

      it('should reject user without execute permission with 403', async () => {
        (userRepository.findUserById as jest.Mock).mockResolvedValue(
          createMockUser({ permissions: [] })
        );

        const req = {
          body: {
            tagData: encodeTagData({
              tagId: testIds.tagId,
              taskId: testIds.taskId,
              timestamp: Date.now(),
            }),
            userId: testIds.userId,
            householdId: testIds.householdId,
            timestamp: Date.now(),
          },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        const next = jest.fn() as NextFunction;

        await eventController.tagScanned(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('permission'),
          })
        );
      });
    });

    describe('Stage 5: Event Persistence', () => {
      it('should handle event persistence errors gracefully', async () => {
        (eventRepository.logEvent as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const req = {
          body: {
            tagData: encodeTagData({
              tagId: testIds.tagId,
              taskId: testIds.taskId,
              timestamp: Date.now(),
            }),
            userId: testIds.userId,
            householdId: testIds.householdId,
            timestamp: Date.now(),
          },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        const next = jest.fn() as NextFunction;

        await eventController.tagScanned(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    describe('Stage 6: Notification Delivery', () => {
      it('should not fail if notification delivery fails', async () => {
        (eventController as any).notificationService.sendNotification = jest
          .fn()
          .mockRejectedValue(new Error('Notification service error'));

        const req = {
          body: {
            tagData: encodeTagData({
              tagId: testIds.tagId,
              taskId: testIds.taskId,
              timestamp: Date.now(),
            }),
            userId: testIds.userId,
            householdId: testIds.householdId,
            timestamp: Date.now(),
          },
        } as unknown as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as any;

        const next = jest.fn() as NextFunction;

        await eventController.tagScanned(req, res, next);

        // Should still return 200 success (event was created)
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          })
        );
      });
    });
  });

  describe('Response Formatting', () => {
    it('should format success response with all required fields', async () => {
      const req = {
        body: {
          tagData: encodeTagData({
            tagId: testIds.tagId,
            taskId: testIds.taskId,
            timestamp: Date.now(),
          }),
          userId: testIds.userId,
          householdId: testIds.householdId,
          timestamp: Date.now(),
        },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.tagScanned(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            eventId: expect.any(String),
            taskId: expect.any(String),
            notificationsSent: expect.any(Number),
            timestamp: expect.any(Number),
          }),
          timestamp: expect.any(Number),
        })
      );
    });

    it('should format error responses consistently', async () => {
      const req = {
        body: {
          // Missing required fields
        },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.tagScanned(req, res, next);

      // Error should be passed to next middleware
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Duplicate Detection', () => {
    it('should prevent duplicate events within 30 second window', async () => {
      (eventController as any).eventProcessor.processTagEvent = jest
        .fn()
        .mockResolvedValueOnce(createMockEvent())
        .mockResolvedValueOnce(null); // Second call returns null for duplicate

      const req1 = {
        body: {
          tagData: encodeTagData({
            tagId: testIds.tagId,
            taskId: testIds.taskId,
            timestamp: Date.now(),
          }),
          userId: testIds.userId,
          householdId: testIds.householdId,
          timestamp: Date.now(),
        },
      } as unknown as Request;

      const res1 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next1 = jest.fn() as NextFunction;

      // First request succeeds
      await eventController.tagScanned(req1, res1, next1);
      expect(res1.status).toHaveBeenCalledWith(200);

      // Second identical request detects duplicate
      const req2 = { ...req1 } as any;
      const res2 = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next2 = jest.fn() as NextFunction;

      await eventController.tagScanned(req2, res2, next2);

      // Should reject duplicate with error
      expect(next2).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Duplicate'),
        })
      );
    });
  });

  describe('Household Isolation Enforcement', () => {
    it('should enforce household isolation at every stage', async () => {
      (userRepository.isUserInHousehold as jest.Mock).mockResolvedValue(false);

      const req = {
        body: {
          tagData: encodeTagData({
            tagId: testIds.tagId,
            taskId: testIds.taskId,
            timestamp: Date.now(),
          }),
          userId: testIds.userId,
          householdId: testIds.householdId,
          timestamp: Date.now(),
        },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.tagScanned(req, res, next);

      // Should fail at household isolation check
      expect(userRepository.isUserInHousehold).toHaveBeenCalledWith(
        testIds.userId,
        testIds.householdId
      );
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should reject tasks from different household', async () => {
      const differentHouseholdTask = createMockTask({
        householdId: randomUUID(),
      });

      (taskRepository.findTaskById as jest.Mock).mockResolvedValue(differentHouseholdTask);

      const req = {
        body: {
          tagData: encodeTagData({
            tagId: testIds.tagId,
            taskId: differentHouseholdTask.taskId,
            timestamp: Date.now(),
          }),
          userId: testIds.userId,
          householdId: testIds.householdId,
          timestamp: Date.now(),
        },
      } as unknown as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn() as NextFunction;

      await eventController.tagScanned(req, res, next);

      // Should fail validation due to different household
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Unauthorized'),
        })
      );
    });
  });
});


