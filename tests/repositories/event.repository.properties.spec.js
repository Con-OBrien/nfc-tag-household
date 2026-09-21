"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fast_check_1 = __importDefault(require("fast-check"));
const EventRepository_1 = require("../../src/repositories/EventRepository");
const database_1 = require("../../src/config/database");
const TaskEvent_1 = require("../../src/entities/TaskEvent");
/**
 * Property-Based Tests for EventRepository Immutability
 * **Validates: Property 5 (Event Audit Trail Completeness) and Requirements 10.2, 10.3, 13.1**
 *
 * These tests use fast-check to verify that the event audit trail maintains
 * immutability across generated sequences of operations. Events cannot be
 * modified after creation, and all event details persist exactly once.
 */
describe('EventRepository Properties - Immutability', () => {
    let eventRepository;
    let repository;
    beforeAll(async () => {
        if (!database_1.AppDataSource.isInitialized) {
            await database_1.AppDataSource.initialize();
        }
        repository = database_1.AppDataSource.getRepository(TaskEvent_1.TaskEventEntity);
    });
    beforeEach(async () => {
        // Clear events before each test
        await repository.delete({});
        eventRepository = new EventRepository_1.EventRepository();
    });
    afterAll(async () => {
        if (database_1.AppDataSource.isInitialized) {
            await database_1.AppDataSource.destroy();
        }
    });
    /**
     * Property: Event audit trail maintains immutability
     * Events cannot be modified after creation
     *
     * For any sequence of events created in a household, verify that:
     * 1. Each event gets a unique eventId on creation
     * 2. All event details are persisted exactly as provided
     * 3. Retrieved events match the originally created data
     * 4. Multiple retrievals return identical data
     */
    it('should maintain immutability across generated event sequences', () => {
        return fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.array(fast_check_1.default.record({
            userId: fast_check_1.default.uuid(),
            taskId: fast_check_1.default.uuid(),
            householdId: fast_check_1.default.uuid(),
            action: fast_check_1.default.oneof(fast_check_1.default.constant('execute'), fast_check_1.default.constant('acknowledge'), fast_check_1.default.constant('undo'), fast_check_1.default.constant('comment')),
            timestamp: fast_check_1.default.integer({ min: Date.now() - 1000 * 60 * 60 * 24, max: Date.now() }),
            metadata: fast_check_1.default.option(fast_check_1.default.dictionary(fast_check_1.default.string(), fast_check_1.default.string())),
        }), { minLength: 1, maxLength: 20 }), async (eventSpecs) => {
            // Create multiple events
            const createdEvents = [];
            for (const spec of eventSpecs) {
                const created = await eventRepository.logEvent({
                    userId: spec.userId,
                    taskId: spec.taskId,
                    householdId: spec.householdId,
                    action: spec.action,
                    timestamp: spec.timestamp,
                    metadata: spec.metadata || undefined,
                });
                createdEvents.push(created);
            }
            // Verify all events were created with unique IDs
            const eventIds = createdEvents.map((e) => e.eventId);
            const uniqueIds = new Set(eventIds);
            expect(uniqueIds.size).toBe(eventIds.length); // All eventIds should be unique
            // Verify event data persistence - retrieve each event and compare
            for (const createdEvent of createdEvents) {
                // Retrieve from database using the repository
                const retrieved = await repository.findOne({
                    where: { eventId: createdEvent.eventId },
                });
                // Event must exist
                expect(retrieved !== null).toBe(true);
                if (!retrieved)
                    return;
                // All fields must match exactly
                expect(retrieved.eventId).toBe(createdEvent.eventId);
                expect(retrieved.userId).toBe(createdEvent.userId);
                expect(retrieved.taskId).toBe(createdEvent.taskId);
                expect(retrieved.householdId).toBe(createdEvent.householdId);
                expect(retrieved.action).toBe(createdEvent.action);
                expect(retrieved.timestamp).toBe(createdEvent.timestamp);
                expect(retrieved.metadata).toEqual(createdEvent.metadata);
            }
            // Verify immutability - retrieve again and ensure identical
            for (const createdEvent of createdEvents) {
                const retrieved = await repository.findOne({
                    where: { eventId: createdEvent.eventId },
                });
                fast_check_1.default.pre(retrieved !== null);
                if (!retrieved)
                    return;
                // Second retrieval must be identical
                expect(retrieved.eventId).toBe(createdEvent.eventId);
                expect(retrieved.userId).toBe(createdEvent.userId);
                expect(retrieved.taskId).toBe(createdEvent.taskId);
                expect(retrieved.action).toBe(createdEvent.action);
                expect(retrieved.timestamp).toBe(createdEvent.timestamp);
            }
            // Verify event count matches created count
            const totalCreated = createdEvents.filter((e) => e.householdId === createdEvents[0].householdId);
            const countInDb = await repository.count({
                where: { householdId: createdEvents[0].householdId },
            });
            expect(countInDb).toBeGreaterThanOrEqual(totalCreated.length);
            return true;
        }), { numRuns: 100 } // Run 100+ iterations as required
        );
    });
    /**
     * Property: All event details persist exactly once
     * Verify that event creation is idempotent at the database level:
     * Creating the same event twice with different eventIds results in 2 different records
     */
    it('should persist all event details exactly as provided', () => {
        return fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.record({
            userId: fast_check_1.default.uuid(),
            taskId: fast_check_1.default.uuid(),
            householdId: fast_check_1.default.uuid(),
            action: fast_check_1.default.oneof(fast_check_1.default.constant('execute'), fast_check_1.default.constant('acknowledge'), fast_check_1.default.constant('undo'), fast_check_1.default.constant('comment')),
            timestamp: fast_check_1.default.integer({ min: Date.now() - 1000 * 60 * 60 * 24, max: Date.now() }),
            metadata: fast_check_1.default.option(fast_check_1.default.dictionary(fast_check_1.default.string(), fast_check_1.default.string())),
        }), async (eventSpec) => {
            // Create event with specific details
            const created1 = await eventRepository.logEvent({
                userId: eventSpec.userId,
                taskId: eventSpec.taskId,
                householdId: eventSpec.householdId,
                action: eventSpec.action,
                timestamp: eventSpec.timestamp,
                metadata: eventSpec.metadata || undefined,
            });
            // Create another event with same details (but different eventId)
            const created2 = await eventRepository.logEvent({
                userId: eventSpec.userId,
                taskId: eventSpec.taskId,
                householdId: eventSpec.householdId,
                action: eventSpec.action,
                timestamp: eventSpec.timestamp,
                metadata: eventSpec.metadata || undefined,
            });
            // Both should be created but with different eventIds
            expect(created1.eventId).not.toBe(created2.eventId);
            // Both should have identical details (except eventId)
            expect(created1.userId).toBe(created2.userId);
            expect(created1.taskId).toBe(created2.taskId);
            expect(created1.householdId).toBe(created2.householdId);
            expect(created1.action).toBe(created2.action);
            expect(created1.timestamp).toBe(created2.timestamp);
            // Both should exist in database
            const found1 = await repository.findOne({ where: { eventId: created1.eventId } });
            const found2 = await repository.findOne({ where: { eventId: created2.eventId } });
            expect(found1 !== null && found2 !== null).toBe(true);
            if (!found1 || !found2)
                return;
            // Details must match exactly (except eventId)
            expect(found1.userId).toBe(found2.userId);
            expect(found1.taskId).toBe(found2.taskId);
            expect(found1.householdId).toBe(found2.householdId);
            expect(found1.action).toBe(found2.action);
            expect(found1.timestamp).toBe(found2.timestamp);
            return true;
        }), { numRuns: 100 });
    });
    /**
     * Property: Duplicate event IDs are rejected
     * Verify that each event gets a unique eventId and cannot be duplicated
     */
    it('should ensure all generated event IDs are unique', () => {
        return fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.array(fast_check_1.default.record({
            userId: fast_check_1.default.uuid(),
            taskId: fast_check_1.default.uuid(),
            householdId: fast_check_1.default.uuid(),
            action: fast_check_1.default.oneof(fast_check_1.default.constant('execute'), fast_check_1.default.constant('acknowledge'), fast_check_1.default.constant('undo'), fast_check_1.default.constant('comment')),
            timestamp: fast_check_1.default.integer({ min: Date.now() - 1000 * 60 * 60 * 24, max: Date.now() }),
        }), { minLength: 1, maxLength: 50 }), async (eventSpecs) => {
            const createdIds = new Set();
            for (const spec of eventSpecs) {
                const created = await eventRepository.logEvent({
                    userId: spec.userId,
                    taskId: spec.taskId,
                    householdId: spec.householdId,
                    action: spec.action,
                    timestamp: spec.timestamp,
                });
                // Each eventId must be unique
                expect(!createdIds.has(created.eventId)).toBe(true);
                createdIds.add(created.eventId);
            }
            // Verify all IDs in database are unique
            const allEvents = await repository.find({
                where: { householdId: eventSpecs[0].householdId },
            });
            const dbIds = new Set(allEvents.map((e) => e.eventId));
            expect(dbIds.size).toBe(allEvents.length);
            return true;
        }), { numRuns: 100 });
    });
    /**
     * Property: Events cannot be modified after creation
     * Attempting to update or delete an event always fails
     */
    it('should prevent any modification of events after creation', () => {
        return fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.record({
            userId: fast_check_1.default.uuid(),
            taskId: fast_check_1.default.uuid(),
            householdId: fast_check_1.default.uuid(),
            action: fast_check_1.default.oneof(fast_check_1.default.constant('execute'), fast_check_1.default.constant('acknowledge'), fast_check_1.default.constant('undo'), fast_check_1.default.constant('comment')),
            timestamp: fast_check_1.default.integer({ min: Date.now() - 1000 * 60 * 60 * 24, max: Date.now() }),
        }), async (eventSpec) => {
            // Create event
            const created = await eventRepository.logEvent({
                userId: eventSpec.userId,
                taskId: eventSpec.taskId,
                householdId: eventSpec.householdId,
                action: eventSpec.action,
                timestamp: eventSpec.timestamp,
            });
            // Attempt to update - should fail
            await expect(eventRepository.updateEvent()).rejects.toThrow();
            // Attempt to delete - should fail
            await expect(eventRepository.deleteEvent()).rejects.toThrow();
            // Event should still exist and be unchanged
            const found = await repository.findOne({ where: { eventId: created.eventId } });
            expect(found !== null).toBe(true);
            if (!found)
                return;
            expect(found.userId).toBe(created.userId);
            expect(found.taskId).toBe(created.taskId);
            expect(found.action).toBe(created.action);
            expect(found.timestamp).toBe(created.timestamp);
            return true;
        }), { numRuns: 100 });
    });
    /**
     * Property: Event history maintains exact data fidelity
     * Verify that retrieved event history matches created events exactly
     */
    it('should maintain exact data fidelity when retrieving event history', () => {
        return fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.tuple(fast_check_1.default.uuid(), // householdId
        fast_check_1.default.uuid(), // taskId
        fast_check_1.default.array(fast_check_1.default.record({
            userId: fast_check_1.default.uuid(),
            action: fast_check_1.default.oneof(fast_check_1.default.constant('execute'), fast_check_1.default.constant('acknowledge'), fast_check_1.default.constant('undo'), fast_check_1.default.constant('comment')),
            timestamp: fast_check_1.default.integer({ min: Date.now() - 1000 * 60 * 60 * 24, max: Date.now() }),
        }), { minLength: 1, maxLength: 10 })), async ([householdId, taskId, eventSpecs]) => {
            // Create multiple events for same task
            const created = [];
            for (const spec of eventSpecs) {
                const event = await eventRepository.logEvent({
                    userId: spec.userId,
                    taskId,
                    householdId,
                    action: spec.action,
                    timestamp: spec.timestamp,
                });
                created.push(event);
            }
            // Retrieve history
            const history = await eventRepository.getEventHistory(taskId, householdId, 100);
            // History should contain at least all created events
            expect(history.length >= created.length).toBe(true);
            // All created events should be in history
            for (const createdEvent of created) {
                const found = history.find((h) => h.eventId === createdEvent.eventId);
                expect(found !== undefined).toBe(true);
                if (!found)
                    continue;
                // Details must match exactly
                expect(found.userId).toBe(createdEvent.userId);
                expect(found.taskId).toBe(createdEvent.taskId);
                expect(found.householdId).toBe(createdEvent.householdId);
                expect(found.action).toBe(createdEvent.action);
                expect(found.timestamp).toBe(createdEvent.timestamp);
            }
            return true;
        }), { numRuns: 100 });
    });
});
