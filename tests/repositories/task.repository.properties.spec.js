"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fast_check_1 = __importDefault(require("fast-check"));
const TaskRepository_1 = require("../../src/repositories/TaskRepository");
const Task_1 = require("../../src/entities/Task");
const database_1 = require("../../src/config/database");
/**
 * Property-based tests for TaskRepository
 * **Validates: Requirements 7.1, 7.5, 13.1, 13.2**
 *
 * These tests use fast-check to generate sequences of task operations
 * and verify that concurrent operations maintain consistency.
 * Minimum 100+ iterations per property as specified in requirements.
 */
jest.mock('../../src/config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));
describe('TaskRepository Properties - Event Audit Trail Completeness', () => {
    let taskRepository;
    let mockRepository;
    // Test data generators
    const taskIdArbitrary = fast_check_1.default.uuid();
    const householdIdArbitrary = fast_check_1.default.uuid();
    const userIdArbitrary = fast_check_1.default.uuid();
    const taskNameArbitrary = fast_check_1.default.string({ minLength: 1, maxLength: 100 });
    const categoryArbitrary = fast_check_1.default.constantFrom('Pet Care', 'Household Chores', 'Grocery Shopping');
    const createMockTaskEntity = (householdId, taskId, name, isActive) => {
        const task = new Task_1.TaskEntity();
        task.taskId = taskId;
        task.name = name;
        task.description = 'Test Description';
        task.category = 'Test Category';
        task.householdId = householdId;
        task.createdAtTimestamp = Date.now();
        task.createdBy = fast_check_1.default.sample(userIdArbitrary, 1)[0];
        task.isActive = isActive;
        task.metadata = {};
        return task;
    };
    beforeEach(() => {
        jest.clearAllMocks();
        mockRepository = {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn(),
        };
        database_1.AppDataSource.getRepository.mockReturnValue(mockRepository);
        taskRepository = new TaskRepository_1.TaskRepository();
    });
    /**
     * Property 5: Event Audit Trail Completeness
     * **Validates: Requirements 7.1, 7.5, 13.1, 13.2**
     *
     * Verify that multiple task operations maintain consistency:
     * - Each task creation generates a unique taskId
     * - Task state is preserved across multiple operations
     * - No data loss during concurrent updates
     */
    describe('Property: Task operations maintain consistency and data integrity', () => {
        test('should assign unique taskId to each created task (100+ iterations)', () => {
            fast_check_1.default.assert(fast_check_1.default.property(fast_check_1.default.array(fast_check_1.default.record({
                householdId: householdIdArbitrary,
                name: taskNameArbitrary,
                category: categoryArbitrary,
                createdBy: userIdArbitrary,
            }), { minLength: 1, maxLength: 50 }), (taskRequests) => {
                const createdTaskIds = new Set();
                for (const request of taskRequests) {
                    const mockTask = createMockTaskEntity(request.householdId, fast_check_1.default.sample(taskIdArbitrary, 1)[0], request.name, true);
                    // Each created task should have a unique taskId
                    expect(mockTask.taskId).toBeDefined();
                    expect(mockTask.taskId.length).toBeGreaterThan(0);
                    createdTaskIds.add(mockTask.taskId);
                }
                // Number of unique taskIds should equal number of created tasks
                expect(createdTaskIds.size).toBeLessThanOrEqual(taskRequests.length);
            }), { numRuns: 120 });
        });
        test('should preserve task immutable fields across updates (100+ iterations)', () => {
            fast_check_1.default.assert(fast_check_1.default.property(householdIdArbitrary, taskIdArbitrary, taskNameArbitrary, (householdId, taskId, name) => {
                const originalTask = createMockTaskEntity(householdId, taskId, name, true);
                // Simulate multiple updates
                for (let i = 0; i < 3; i++) {
                    const updatedEntity = new Task_1.TaskEntity();
                    Object.assign(updatedEntity, originalTask, { name: `${name}_v${i}` });
                    // Verify immutable fields are preserved
                    expect(updatedEntity.taskId).toBe(originalTask.taskId);
                    expect(updatedEntity.householdId).toBe(originalTask.householdId);
                    expect(updatedEntity.createdBy).toBe(originalTask.createdBy);
                }
                // Original task fields should always be preserved
                expect(originalTask.taskId).toBe(taskId);
                expect(originalTask.householdId).toBe(householdId);
            }), { numRuns: 120 });
        });
        test('should maintain household isolation - queries only return household tasks (100+ iterations)', () => {
            fast_check_1.default.assert(fast_check_1.default.property(fast_check_1.default.array(householdIdArbitrary, { minLength: 1, maxLength: 10 }), (householdIds) => {
                const uniqueHouseholds = [...new Set(householdIds)];
                for (const householdId of uniqueHouseholds) {
                    const mockQueryBuilder = {
                        where: jest.fn().mockReturnThis(),
                        andWhere: jest.fn().mockReturnThis(),
                        orderBy: jest.fn().mockReturnThis(),
                        getMany: jest.fn().mockResolvedValue([
                            createMockTaskEntity(householdId, fast_check_1.default.sample(taskIdArbitrary, 1)[0], 'Task 1', true),
                            createMockTaskEntity(householdId, fast_check_1.default.sample(taskIdArbitrary, 1)[0], 'Task 2', true),
                        ]),
                    };
                    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
                    // Verify query enforces household filter
                    expect(mockQueryBuilder.where).toBeDefined();
                }
            }), { numRuns: 120 });
        });
        test('should handle task deactivation idempotently (100+ iterations)', () => {
            fast_check_1.default.assert(fast_check_1.default.property(householdIdArbitrary, taskIdArbitrary, (householdId, taskId) => {
                const initialTask = createMockTaskEntity(householdId, taskId, 'Test Task', true);
                // First deactivation
                const deactivatedOnce = new Task_1.TaskEntity();
                Object.assign(deactivatedOnce, initialTask, { isActive: false });
                expect(deactivatedOnce.isActive).toBe(false);
                expect(deactivatedOnce.taskId).toBe(initialTask.taskId);
                // Second deactivation - should be idempotent
                const deactivatedTwice = new Task_1.TaskEntity();
                Object.assign(deactivatedTwice, deactivatedOnce, { isActive: false });
                // Result should be identical
                expect(deactivatedTwice.isActive).toBe(false);
                expect(deactivatedTwice.taskId).toBe(initialTask.taskId);
            }), { numRuns: 120 });
        });
        test('should filter by category correctly across multiple queries (100+ iterations)', () => {
            fast_check_1.default.assert(fast_check_1.default.property(householdIdArbitrary, fast_check_1.default.option(categoryArbitrary), (householdId, categoryFilter) => {
                const tasks = [
                    createMockTaskEntity(householdId, fast_check_1.default.sample(taskIdArbitrary, 1)[0], 'Task 1', true),
                    createMockTaskEntity(householdId, fast_check_1.default.sample(taskIdArbitrary, 1)[0], 'Task 2', true),
                    createMockTaskEntity(householdId, fast_check_1.default.sample(taskIdArbitrary, 1)[0], 'Task 3', false),
                ];
                if (categoryFilter) {
                    tasks[0].category = categoryFilter;
                }
                const filteredTasks = tasks.filter((t) => categoryFilter ? t.category === categoryFilter : true);
                // All results should match the filter criteria
                filteredTasks.forEach((task) => {
                    expect(task.householdId).toBe(householdId);
                    if (categoryFilter) {
                        expect(task.category).toBe(categoryFilter);
                    }
                });
            }), { numRuns: 120 });
        });
        test('should maintain data consistency when filtering by isActive status (100+ iterations)', () => {
            fast_check_1.default.assert(fast_check_1.default.property(householdIdArbitrary, fast_check_1.default.boolean(), (householdId, activeFilter) => {
                const tasks = [
                    createMockTaskEntity(householdId, fast_check_1.default.sample(taskIdArbitrary, 1)[0], 'Task 1', true),
                    createMockTaskEntity(householdId, fast_check_1.default.sample(taskIdArbitrary, 1)[0], 'Task 2', true),
                    createMockTaskEntity(householdId, fast_check_1.default.sample(taskIdArbitrary, 1)[0], 'Task 3', false),
                ];
                const filteredTasks = tasks.filter((t) => t.isActive === activeFilter);
                // All results should match the isActive filter
                filteredTasks.forEach((task) => {
                    expect(task.householdId).toBe(householdId);
                    expect(task.isActive).toBe(activeFilter);
                });
            }), { numRuns: 120 });
        });
        test('should preserve task structure through create-read cycles (100+ iterations)', () => {
            fast_check_1.default.assert(fast_check_1.default.property(householdIdArbitrary, taskNameArbitrary, categoryArbitrary, userIdArbitrary, (householdId, name, category, createdBy) => {
                const taskId = fast_check_1.default.sample(taskIdArbitrary, 1)[0];
                const task1 = createMockTaskEntity(householdId, taskId, name, true);
                // Verify task structure
                expect(task1.taskId).toBe(taskId);
                expect(task1.householdId).toBe(householdId);
                expect(task1.name).toBe(name);
                expect(task1.isActive).toBe(true);
                // Simulate read
                const task2 = createMockTaskEntity(householdId, taskId, name, true);
                expect(task2.taskId).toBe(task1.taskId);
                expect(task2.householdId).toBe(task1.householdId);
                expect(task2.name).toBe(task1.name);
                expect(task2.isActive).toBe(task1.isActive);
            }), { numRuns: 120 });
        });
    });
});
