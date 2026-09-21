"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskRepository = void 0;
const database_1 = require("../config/database");
const Task_1 = require("../entities/Task");
const crypto_1 = require("crypto");
const types_1 = require("../types");
/**
 * TaskRepository - Data access layer for task operations
 * Implements household isolation and efficient querying with indexes
 */
class TaskRepository {
    constructor() {
        this.repository = database_1.AppDataSource.getRepository(Task_1.TaskEntity);
    }
    /**
     * Find a task by ID with household isolation check
     * Ensures the task belongs to the specified household
     * @param taskId - UUID of the task to find
     * @param householdId - UUID of the household (for isolation check)
     * @returns Task if found and belongs to household, null otherwise
     */
    async findTaskById(taskId, householdId) {
        if (!taskId || !householdId) {
            throw new types_1.ValidationError('taskId and householdId are required');
        }
        const taskEntity = await this.repository.findOne({
            where: {
                taskId,
                householdId,
            },
        });
        if (!taskEntity) {
            return null;
        }
        return taskEntity.toTask();
    }
    /**
     * Find all tasks for a household with optional filtering
     * @param householdId - UUID of the household
     * @param filters - Optional filters for category and active status
     * @returns Array of tasks matching criteria
     */
    async findTasksByHousehold(householdId, filters) {
        if (!householdId) {
            throw new types_1.ValidationError('householdId is required');
        }
        let query = this.repository.createQueryBuilder('task').where('task.householdId = :householdId', {
            householdId,
        });
        if (filters?.category !== undefined) {
            query = query.andWhere('task.category = :category', {
                category: filters.category,
            });
        }
        if (filters?.isActive !== undefined) {
            query = query.andWhere('task.isActive = :isActive', {
                isActive: filters.isActive,
            });
        }
        const taskEntities = await query.orderBy('task.createdAt', 'DESC').getMany();
        return taskEntities.map((entity) => entity.toTask());
    }
    /**
     * Create a new task in the database
     * Assigns unique taskId and sets creation timestamp
     * @param task - Task data (without taskId and createdAt)
     * @returns Created task with assigned taskId and timestamp
     */
    async createTask(task) {
        if (!task.name || !task.description || !task.category || !task.householdId) {
            throw new types_1.ValidationError('name, description, category, and householdId are required');
        }
        if (task.name.length < 1 || task.name.length > 100) {
            throw new types_1.ValidationError('Task name must be between 1 and 100 characters');
        }
        const newTaskEntity = this.repository.create({
            taskId: (0, crypto_1.randomUUID)(),
            name: task.name,
            description: task.description,
            category: task.category,
            householdId: task.householdId,
            createdAtTimestamp: Date.now(),
            createdBy: task.createdBy,
            isActive: task.isActive !== false,
            metadata: task.metadata,
        });
        const savedTask = await this.repository.save(newTaskEntity);
        return savedTask.toTask();
    }
    /**
     * Update task metadata
     * @param taskId - UUID of the task to update
     * @param householdId - UUID of the household (for isolation check)
     * @param updates - Partial updates to apply (excludes taskId, createdAt, householdId)
     * @returns Updated task
     */
    async updateTask(taskId, householdId, updates) {
        if (!taskId || !householdId) {
            throw new types_1.ValidationError('taskId and householdId are required');
        }
        const taskEntity = await this.repository.findOne({
            where: {
                taskId,
                householdId,
            },
        });
        if (!taskEntity) {
            throw new types_1.NotFoundError('Task');
        }
        // Apply updates (excluding protected fields)
        if (updates.name !== undefined) {
            if (updates.name.length < 1 || updates.name.length > 100) {
                throw new types_1.ValidationError('Task name must be between 1 and 100 characters');
            }
            taskEntity.name = updates.name;
        }
        if (updates.description !== undefined) {
            taskEntity.description = updates.description;
        }
        if (updates.category !== undefined) {
            taskEntity.category = updates.category;
        }
        if (updates.isActive !== undefined) {
            taskEntity.isActive = updates.isActive;
        }
        if (updates.metadata !== undefined) {
            taskEntity.metadata = updates.metadata;
        }
        const savedTask = await this.repository.save(taskEntity);
        return savedTask.toTask();
    }
    /**
     * Deactivate a task (set isActive to false)
     * Preserves all historical events for audit purposes
     * @param taskId - UUID of the task to deactivate
     * @param householdId - UUID of the household (for isolation check)
     */
    async deactivateTask(taskId, householdId) {
        if (!taskId || !householdId) {
            throw new types_1.ValidationError('taskId and householdId are required');
        }
        const taskEntity = await this.repository.findOne({
            where: {
                taskId,
                householdId,
            },
        });
        if (!taskEntity) {
            throw new types_1.NotFoundError('Task');
        }
        taskEntity.isActive = false;
        await this.repository.save(taskEntity);
    }
    /**
     * Get all tasks in a household (active only)
     * Used for listing available tasks for household members
     * @param householdId - UUID of the household
     * @returns Array of active tasks
     */
    async getActiveTasks(householdId) {
        return this.findTasksByHousehold(householdId, { isActive: true });
    }
    /**
     * Get tasks grouped by category
     * @param householdId - UUID of the household
     * @returns Map of category to tasks
     */
    async getTasksByCategory(householdId) {
        const tasks = await this.findTasksByHousehold(householdId, { isActive: true });
        const grouped = new Map();
        for (const task of tasks) {
            if (!grouped.has(task.category)) {
                grouped.set(task.category, []);
            }
            grouped.get(task.category).push(task);
        }
        return grouped;
    }
}
exports.TaskRepository = TaskRepository;
