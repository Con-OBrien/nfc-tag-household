import { Request, Response, NextFunction } from 'express';
import { TaskRepository } from '../repositories/TaskRepository';
import { UserRepository } from '../repositories/UserRepository';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  CreateTaskRequest,
  ApiResponse,
  Task,
} from '../types';

/**
 * TaskController - Handles all task management HTTP requests
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 19.1-19.6
 *
 * Manages:
 * - Task creation with validation
 * - Task updates (owner only)
 * - Task deactivation (preserves events)
 * - Task listing with filtering and pagination
 * - Single task retrieval
 */
export class TaskController {
  private taskRepository: TaskRepository;
  private userRepository: UserRepository;

  constructor() {
    this.taskRepository = new TaskRepository();
    this.userRepository = new UserRepository();
  }

  /**
   * POST /api/households/:householdId/tasks
   * Create a new task in a household
   *
   * Path params:
   * - householdId: UUID of household
   *
   * Request body:
   * {
   *   name: string (required, 1-100 chars),
   *   description: string (required, max 500 chars),
   *   category: string (required),
   *   metadata?: object (optional task-specific data)
   * }
   *
   * Response: 201 Created
   * {
   *   taskId: string,
   *   name: string,
   *   description: string,
   *   category: string,
   *   householdId: string,
   *   createdBy: string,
   *   isActive: true,
   *   createdAt: number,
   *   metadata?: object
   * }
   *
   * Error responses:
   * - 400: Missing required fields, validation fails
   * - 401: Not authenticated
   * - 403: Not a member of household
   * - 404: Household doesn't exist
   *
   * Requirements: 7.1, 7.2, 7.3, 7.4, 19.1, 19.2
   */
  async createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract user ID from authenticated request
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      // Extract householdId from URL parameters
      const householdId = req.params.householdId as string;
      if (!householdId) {
        throw new ValidationError('householdId is required');
      }

      // Parse and validate request body
      const { name, description, category, metadata } = req.body as CreateTaskRequest;

      // Validate required fields
      if (!name || !description || !category) {
        throw new ValidationError('name, description, and category are required');
      }

      // Validate name length (1-100 chars)
      if (typeof name !== 'string' || name.length < 1 || name.length > 100) {
        throw new ValidationError('Task name must be between 1 and 100 characters');
      }

      // Validate description (optional max, but enforce reasonable limit)
      if (typeof description !== 'string' || description.length < 1 || description.length > 500) {
        throw new ValidationError('Task description must be between 1 and 500 characters');
      }

      // Validate category is non-empty string
      if (typeof category !== 'string' || category.length < 1) {
        throw new ValidationError('Task category must be a non-empty string');
      }

      // Verify user is member of household (household isolation)
      const userInHousehold = await this.userRepository.isUserInHousehold(userId, householdId as string);
      if (!userInHousehold) {
        throw new ForbiddenError('User is not a member of this household');
      }

      // Create the task with validated data
      const newTask = await this.taskRepository.createTask({
        name,
        description,
        category,
        householdId: householdId as string,
        createdBy: userId,
        isActive: true,
        metadata,
      });

      // Return success response with 201 Created
      const response: ApiResponse<Task> = {
        success: true,
        data: newTask,
        timestamp: Date.now(),
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/households/:householdId/tasks/:taskId
   * Update an existing task
   *
   * Path params:
   * - householdId: UUID of household
   * - taskId: UUID of task
   *
   * Request body (all optional):
   * {
   *   name?: string (1-100 chars),
   *   description?: string (max 500 chars),
   *   category?: string
   * }
   *
   * Response: 200 OK
   * {
   *   taskId: string,
   *   name: string,
   *   description: string,
   *   category: string,
   *   householdId: string,
   *   createdBy: string,
   *   isActive: boolean,
   *   createdAt: number,
   *   metadata?: object
   * }
   *
   * Error responses:
   * - 400: Validation fails
   * - 401: Not authenticated
   * - 403: Not owner of task or not a member of household
   * - 404: Task or household doesn't exist
   *
   * Requirements: 7.4, 19.3
   */
  async updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract user ID from authenticated request
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      // Extract IDs from URL parameters
      const householdId = req.params.householdId as string;
      const taskId = req.params.taskId as string;
      if (!householdId || !taskId) {
        throw new ValidationError('householdId and taskId are required');
      }

      // Verify user is member of household
      const userInHousehold = await this.userRepository.isUserInHousehold(userId, householdId);
      if (!userInHousehold) {
        throw new ForbiddenError('User is not a member of this household');
      }

      // Retrieve the existing task
      const existingTask = await this.taskRepository.findTaskById(taskId, householdId);
      if (!existingTask) {
        throw new NotFoundError('Task');
      }

      // Verify user is the owner of the task (owner can update)
      if (existingTask.createdBy !== userId) {
        throw new ForbiddenError('Only the task owner can update this task');
      }

      // Parse request body for updates
      const { name, description, category } = req.body;

      // Validate name if provided
      if (name !== undefined) {
        if (typeof name !== 'string' || name.length < 1 || name.length > 100) {
          throw new ValidationError('Task name must be between 1 and 100 characters');
        }
      }

      // Validate description if provided
      if (description !== undefined) {
        if (typeof description !== 'string' || description.length < 1 || description.length > 500) {
          throw new ValidationError('Task description must be between 1 and 500 characters');
        }
      }

      // Validate category if provided
      if (category !== undefined) {
        if (typeof category !== 'string' || category.length < 1) {
          throw new ValidationError('Task category must be a non-empty string');
        }
      }

      // Update the task with provided fields
      const updates = {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
      };

      const updatedTask = await this.taskRepository.updateTask(
        taskId,
        householdId,
        updates
      );

      // Return success response
      const response: ApiResponse<Task> = {
        success: true,
        data: updatedTask,
        timestamp: Date.now(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/households/:householdId/tasks/:taskId
   * Deactivate a task (soft delete, preserves events)
   *
   * Path params:
   * - householdId: UUID of household
   * - taskId: UUID of task
   *
   * Response: 204 No Content
   *
   * Error responses:
   * - 401: Not authenticated
   * - 403: Not owner of task or not a member of household
   * - 404: Task or household doesn't exist
   *
   * Requirements: 7.5, 7.6, 19.4
   */
  async deactivateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract user ID from authenticated request
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      // Extract IDs from URL parameters
      const householdId = req.params.householdId as string;
      const taskId = req.params.taskId as string;
      if (!householdId || !taskId) {
        throw new ValidationError('householdId and taskId are required');
      }

      // Verify user is member of household
      const userInHousehold = await this.userRepository.isUserInHousehold(userId, householdId);
      if (!userInHousehold) {
        throw new ForbiddenError('User is not a member of this household');
      }

      // Retrieve the existing task
      const existingTask = await this.taskRepository.findTaskById(taskId, householdId);
      if (!existingTask) {
        throw new NotFoundError('Task');
      }

      // Verify user is the owner of the task (owner can deactivate)
      if (existingTask.createdBy !== userId) {
        throw new ForbiddenError('Only the task owner can deactivate this task');
      }

      // Deactivate the task
      await this.taskRepository.deactivateTask(taskId, householdId);

      // Return 204 No Content (successful deletion/deactivation)
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/households/:householdId/tasks
   * List tasks in a household with optional filtering and pagination
   *
   * Path params:
   * - householdId: UUID of household
   *
   * Query params (all optional):
   * - active: boolean (true/false, filter by active status)
   * - category: string (filter by category)
   * - skip: number (default 0, for pagination)
   * - limit: number (default 50, max 100, for pagination)
   *
   * Response: 200 OK
   * {
   *   tasks: Task[],
   *   total: number,
   *   skip: number,
   *   limit: number
   * }
   *
   * Error responses:
   * - 401: Not authenticated
   * - 403: Not a member of household
   * - 404: Household doesn't exist
   *
   * Requirements: 7.7, 19.5
   */
  async listTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract user ID from authenticated request
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      // Extract householdId from URL parameters
      const householdId = req.params.householdId as string;
      if (!householdId) {
        throw new ValidationError('householdId is required');
      }

      // Verify user is member of household (household isolation)
      const userInHousehold = await this.userRepository.isUserInHousehold(userId, householdId);
      if (!userInHousehold) {
        throw new ForbiddenError('User is not a member of this household');
      }

      // Parse and validate query parameters
      const activeStr = req.query.active as string | undefined;
      const category = req.query.category as string | undefined;
      const skipStr = (req.query.skip as string) || '0';
      const limitStr = (req.query.limit as string) || '50';

      // Parse skip and limit
      let skip = 0;
      let limit = 50;

      try {
        skip = Math.max(0, parseInt(skipStr, 10));
        limit = Math.max(1, Math.min(100, parseInt(limitStr, 10))); // Max 100 per request
      } catch (e) {
        throw new ValidationError('skip and limit must be valid integers');
      }

      // Parse active filter (optional)
      let isActive: boolean | undefined;
      if (activeStr !== undefined) {
        if (activeStr === 'true') {
          isActive = true;
        } else if (activeStr === 'false') {
          isActive = false;
        } else {
          throw new ValidationError('active parameter must be true or false');
        }
      }

      // Build filter object
      const filters: {
        category?: string;
        isActive?: boolean;
      } = {};

      if (category !== undefined && category.length > 0) {
        filters.category = category;
      }

      if (isActive !== undefined) {
        filters.isActive = isActive;
      }

      // Query tasks with filters
      const allTasks = await this.taskRepository.findTasksByHousehold(householdId, filters);

      // Apply pagination in-memory (or could be done at DB level)
      const paginatedTasks = allTasks.slice(skip, skip + limit);

      // Return response with pagination info
      const response: ApiResponse<{
        tasks: Task[];
        total: number;
        skip: number;
        limit: number;
      }> = {
        success: true,
        data: {
          tasks: paginatedTasks,
          total: allTasks.length,
          skip,
          limit,
        },
        timestamp: Date.now(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/households/:householdId/tasks/:taskId
   * Get a single task by ID
   *
   * Path params:
   * - householdId: UUID of household
   * - taskId: UUID of task
   *
   * Response: 200 OK
   * {
   *   taskId: string,
   *   name: string,
   *   description: string,
   *   category: string,
   *   householdId: string,
   *   createdBy: string,
   *   isActive: boolean,
   *   createdAt: number,
   *   metadata?: object
   * }
   *
   * Error responses:
   * - 401: Not authenticated
   * - 403: Not a member of household
   * - 404: Task or household doesn't exist
   *
   * Requirements: 7.1, 7.2, 19.6
   */
  async getTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract user ID from authenticated request
      const userId = (req as any).userId;
      if (!userId) {
        throw new ValidationError('User not authenticated');
      }

      // Extract IDs from URL parameters
      const householdId = req.params.householdId as string;
      const taskId = req.params.taskId as string;
      if (!householdId || !taskId) {
        throw new ValidationError('householdId and taskId are required');
      }

      // Verify user is member of household (household isolation)
      const userInHousehold = await this.userRepository.isUserInHousehold(userId, householdId);
      if (!userInHousehold) {
        throw new ForbiddenError('User is not a member of this household');
      }

      // Retrieve the task
      const task = await this.taskRepository.findTaskById(taskId, householdId);
      if (!task) {
        throw new NotFoundError('Task');
      }

      // Return success response
      const response: ApiResponse<Task> = {
        success: true,
        data: task,
        timestamp: Date.now(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export default TaskController;
