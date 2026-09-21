import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { TaskEntity } from '../entities/Task';
import { Task } from '../types';
import { randomUUID } from 'crypto';
import { ForbiddenError, NotFoundError, ValidationError } from '../types';

/**
 * TaskRepository - Data access layer for task operations
 * Implements household isolation and efficient querying with indexes
 */
export class TaskRepository {
  private repository: Repository<TaskEntity>;

  constructor() {
    this.repository = AppDataSource.getRepository(TaskEntity);
  }

  /**
   * Find a task by ID with household isolation check
   * Ensures the task belongs to the specified household
   * @param taskId - UUID of the task to find
   * @param householdId - UUID of the household (for isolation check)
   * @returns Task if found and belongs to household, null otherwise
   */
  async findTaskById(taskId: string, householdId: string): Promise<Task | null> {
    if (!taskId || !householdId) {
      throw new ValidationError('taskId and householdId are required');
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
  async findTasksByHousehold(
    householdId: string,
    filters?: {
      category?: string;
      isActive?: boolean;
    }
  ): Promise<Task[]> {
    if (!householdId) {
      throw new ValidationError('householdId is required');
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
  async createTask(task: Omit<Task, 'taskId' | 'createdAt'>): Promise<Task> {
    if (!task.name || !task.description || !task.category || !task.householdId) {
      throw new ValidationError('name, description, category, and householdId are required');
    }

    if (task.name.length < 1 || task.name.length > 100) {
      throw new ValidationError('Task name must be between 1 and 100 characters');
    }

    const newTaskEntity = this.repository.create({
      taskId: randomUUID(),
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
  async updateTask(
    taskId: string,
    householdId: string,
    updates: Partial<Omit<Task, 'taskId' | 'createdAt' | 'householdId' | 'createdBy'>>
  ): Promise<Task> {
    if (!taskId || !householdId) {
      throw new ValidationError('taskId and householdId are required');
    }

    const taskEntity = await this.repository.findOne({
      where: {
        taskId,
        householdId,
      },
    });

    if (!taskEntity) {
      throw new NotFoundError('Task');
    }

    // Apply updates (excluding protected fields)
    if (updates.name !== undefined) {
      if (updates.name.length < 1 || updates.name.length > 100) {
        throw new ValidationError('Task name must be between 1 and 100 characters');
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
  async deactivateTask(taskId: string, householdId: string): Promise<void> {
    if (!taskId || !householdId) {
      throw new ValidationError('taskId and householdId are required');
    }

    const taskEntity = await this.repository.findOne({
      where: {
        taskId,
        householdId,
      },
    });

    if (!taskEntity) {
      throw new NotFoundError('Task');
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
  async getActiveTasks(householdId: string): Promise<Task[]> {
    return this.findTasksByHousehold(householdId, { isActive: true });
  }

  /**
   * Get tasks grouped by category
   * @param householdId - UUID of the household
   * @returns Map of category to tasks
   */
  async getTasksByCategory(householdId: string): Promise<Map<string, Task[]>> {
    const tasks = await this.findTasksByHousehold(householdId, { isActive: true });

    const grouped = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!grouped.has(task.category)) {
        grouped.set(task.category, []);
      }
      grouped.get(task.category)!.push(task);
    }

    return grouped;
  }
}
