"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const EventController_1 = require("../../src/controllers/EventController");
const EventProcessorService_1 = require("../../src/services/EventProcessorService");
const TaskValidatorService_1 = require("../../src/services/TaskValidatorService");
const NotificationService_1 = require("../../src/services/NotificationService");
const crypto_1 = require("crypto");
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
    let eventController;
    let eventRepository;
    let userRepository;
    let taskRepository;
    let householdRepository;
    const testIds = {
        householdId: (0, crypto_1.randomUUID)(),
        userId: (0, crypto_1.randomUUID)(),
        taskId: (0, crypto_1.randomUUID)(),
        tagId: 'nfc_test_001',
        eventId: (0, crypto_1.randomUUID)(),
    };
    // Helper to encode tag data
    const encodeTagData = (tagData) => {
        return Buffer.from(JSON.stringify(tagData)).toString('base64');
    };
    const createMockTask = (overrides) => ({
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
    const createMockUser = (overrides) => ({
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
    const createMockEvent = (overrides) => ({
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
                createMockUser({ userId: (0, crypto_1.randomUUID)(), name: 'User 2' }),
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
                createMockUser({ userId: (0, crypto_1.randomUUID)(), name: 'User 2' }),
            ]),
        };
        // Create controller with mocked repositories
        eventController = new EventController_1.EventController();
        eventController.eventRepository = eventRepository;
        eventController.userRepository = userRepository;
        eventController.eventProcessor = new EventProcessorService_1.EventProcessorService(eventRepository);
        eventController.taskValidator = new TaskValidatorService_1.TaskValidatorService(taskRepository, userRepository);
        eventController.notificationService = new NotificationService_1.NotificationService(userRepository, householdRepository, taskRepository, eventRepository);
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
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            const next = jest.fn();
            // Execute pipeline
            await eventController.tagScanned(req, res, next);
            // Verify success response
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    eventId: expect.any(String),
                    taskId: testIds.taskId,
                    notificationsSent: expect.any(Number),
                    timestamp: expect.any(Number),
                }),
            }));
            // Verify each stage was called
            expect(userRepository.isUserInHousehold).toHaveBeenCalledWith(testIds.userId, testIds.householdId);
            expect(taskRepository.findTaskById).toHaveBeenCalledWith(testIds.taskId, testIds.householdId);
            expect(eventRepository.logEvent).toHaveBeenCalled();
        });
        it('should include notification recipients count in response', async () => {
            const mockUsers = [
                createMockUser({ userId: (0, crypto_1.randomUUID)() }),
                createMockUser({ userId: (0, crypto_1.randomUUID)() }),
            ];
            userRepository.findUsersInHousehold.mockResolvedValue(mockUsers);
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
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            const next = jest.fn();
            await eventController.tagScanned(req, res, next);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    notificationsSent: expect.any(Number),
                }),
            }));
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
                };
                const res = {
                    status: jest.fn().mockReturnThis(),
                    json: jest.fn(),
                };
                const next = jest.fn();
                await eventController.tagScanned(req, res, next);
                // Should call error handler
                expect(next).toHaveBeenCalledWith(expect.objectContaining({
                    message: expect.stringContaining('tagData'),
                }));
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
                };
                const res = {
                    status: jest.fn().mockReturnThis(),
                    json: jest.fn(),
                };
                const next = jest.fn();
                await eventController.tagScanned(req, res, next);
                expect(next).toHaveBeenCalledWith(expect.objectContaining({
                    message: expect.stringContaining('too old'),
                }));
            });
            it('should reject invalid JSON in tagData with 400', async () => {
                const req = {
                    body: {
                        tagData: 'not-valid-json-or-base64',
                        userId: testIds.userId,
                        householdId: testIds.householdId,
                        timestamp: Date.now(),
                    },
                };
                const res = {
                    status: jest.fn().mockReturnThis(),
                    json: jest.fn(),
                };
                const next = jest.fn();
                await eventController.tagScanned(req, res, next);
                expect(next).toHaveBeenCalledWith(expect.objectContaining({
                    message: expect.stringContaining('Failed to parse tag data'),
                }));
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
                };
                const res = {
                    status: jest.fn().mockReturnThis(),
                    json: jest.fn(),
                };
                const next = jest.fn();
                await eventController.tagScanned(req, res, next);
                expect(next).toHaveBeenCalledWith(expect.objectContaining({
                    message: expect.stringContaining('taskId'),
                }));
            });
            it('should reject tag with invalid signature with 403', async () => {
                eventController.nfcReader.validateTagSignature = jest
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
                };
                const res = {
                    status: jest.fn().mockReturnThis(),
                    json: jest.fn(),
                };
                const next = jest.fn();
                await eventController.tagScanned(req, res, next);
                expect(next).toHaveBeenCalledWith(expect.objectContaining({
                    message: expect.stringContaining('Invalid tag signature'),
                }));
            });
        });
        describe('Stage 3: User Authorization & Household Isolation', () => {
            it('should reject user not in household with 403', async () => {
                userRepository.isUserInHousehold.mockResolvedValue(false);
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
                };
                const res = {
                    status: jest.fn().mockReturnThis(),
                    json: jest.fn(),
                };
                const next = jest.fn();
                await eventController.tagScanned(req, res, next);
                expect(next).toHaveBeenCalledWith(expect.objectContaining({
                    message: expect.stringContaining('does not belong to this household'),
                }));
            });
        });
        describe('Stage 4: Task Validation', () => {
            it('should reject task not found with 404', async () => {
                taskRepository.findTaskById.mockResolvedValue(null);
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
                };
                const res = {
                    status: jest.fn().mockReturnThis(),
                    json: jest.fn(),
                };
                const next = jest.fn();
                await eventController.tagScanned(req, res, next);
                expect(next).toHaveBeenCalledWith(expect.objectContaining({
                    message: expect.stringContaining('Task'),
                }));
            });
            it('should reject inactive task with 400', async () => {
                taskRepository.findTaskById.mockResolvedValue(createMockTask({ isActive: false }));
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
                };
                const res = {
                    status: jest.fn().mockReturnThis(),
                    json: jest.fn(),
                };
                const next = jest.fn();
                await eventController.tagScanned(req, res, next);
                expect(next).toHaveBeenCalledWith(expect.objectContaining({
                    message: expect.stringContaining('not active'),
                }));
            });
            it('should reject user without execute permission with 403', async () => {
                userRepository.findUserById.mockResolvedValue(createMockUser({ permissions: [] }));
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
                };
                const res = {
                    status: jest.fn().mockReturnThis(),
                    json: jest.fn(),
                };
                const next = jest.fn();
                await eventController.tagScanned(req, res, next);
                expect(next).toHaveBeenCalledWith(expect.objectContaining({
                    message: expect.stringContaining('permission'),
                }));
            });
        });
        describe('Stage 5: Event Persistence', () => {
            it('should handle event persistence errors gracefully', async () => {
                eventRepository.logEvent.mockRejectedValue(new Error('Database connection failed'));
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
                };
                const res = {
                    status: jest.fn().mockReturnThis(),
                    json: jest.fn(),
                };
                const next = jest.fn();
                await eventController.tagScanned(req, res, next);
                expect(next).toHaveBeenCalledWith(expect.any(Error));
            });
        });
        describe('Stage 6: Notification Delivery', () => {
            it('should not fail if notification delivery fails', async () => {
                eventController.notificationService.sendNotification = jest
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
                };
                const res = {
                    status: jest.fn().mockReturnThis(),
                    json: jest.fn(),
                };
                const next = jest.fn();
                await eventController.tagScanned(req, res, next);
                // Should still return 200 success (event was created)
                expect(res.status).toHaveBeenCalledWith(200);
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                    success: true,
                }));
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
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            const next = jest.fn();
            await eventController.tagScanned(req, res, next);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    eventId: expect.any(String),
                    taskId: expect.any(String),
                    notificationsSent: expect.any(Number),
                    timestamp: expect.any(Number),
                }),
                timestamp: expect.any(Number),
            }));
        });
        it('should format error responses consistently', async () => {
            const req = {
                body: {
                // Missing required fields
                },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            const next = jest.fn();
            await eventController.tagScanned(req, res, next);
            // Error should be passed to next middleware
            expect(next).toHaveBeenCalledWith(expect.any(Error));
        });
    });
    describe('Duplicate Detection', () => {
        it('should prevent duplicate events within 30 second window', async () => {
            eventController.eventProcessor.processTagEvent = jest
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
            };
            const res1 = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            const next1 = jest.fn();
            // First request succeeds
            await eventController.tagScanned(req1, res1, next1);
            expect(res1.status).toHaveBeenCalledWith(200);
            // Second identical request detects duplicate
            const req2 = { ...req1 };
            const res2 = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            const next2 = jest.fn();
            await eventController.tagScanned(req2, res2, next2);
            // Should reject duplicate with error
            expect(next2).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Duplicate'),
            }));
        });
    });
    describe('Household Isolation Enforcement', () => {
        it('should enforce household isolation at every stage', async () => {
            userRepository.isUserInHousehold.mockResolvedValue(false);
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
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            const next = jest.fn();
            await eventController.tagScanned(req, res, next);
            // Should fail at household isolation check
            expect(userRepository.isUserInHousehold).toHaveBeenCalledWith(testIds.userId, testIds.householdId);
            expect(next).toHaveBeenCalledWith(expect.any(Error));
        });
        it('should reject tasks from different household', async () => {
            const differentHouseholdTask = createMockTask({
                householdId: (0, crypto_1.randomUUID)(),
            });
            taskRepository.findTaskById.mockResolvedValue(differentHouseholdTask);
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
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            const next = jest.fn();
            await eventController.tagScanned(req, res, next);
            // Should fail validation due to different household
            expect(next).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Unauthorized'),
            }));
        });
    });
});
