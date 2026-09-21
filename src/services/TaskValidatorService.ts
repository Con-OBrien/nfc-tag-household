import { Task, HouseholdUser, TaskValidationResult } from '../types';
import { TaskRepository } from '../repositories/TaskRepository';
import { UserRepository } from '../repositories/UserRepository';

/**
 * TaskValidatorService - Validates tasks and enforces permission controls
 * Ensures users can only interact with tasks they have authorization for
 * Enforces household isolation and business rule validation
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export class TaskValidatorService {
  private taskRepository: TaskRepository;
  private userRepository: UserRepository;

  constructor(taskRepository: TaskRepository, userRepository: UserRepository) {
    this.taskRepository = taskRepository;
    this.userRepository = userRepository;
  }

  /**
   * Validates whether a user can execute a specific task
   * Performs comprehensive permission and business rule checks
   *
   * @param userId - The user attempting to execute the task
   * @param taskId - The task ID to execute
   * @param householdId - The household ID context
   * @returns Detailed validation result with errors and allowed users
   *
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
   */
  public async validateTaskCanExecute(
    userId: string,
    taskId: string,
    householdId: string
  ): Promise<TaskValidationResult> {
    const errors: string[] = [];
    let task: Task | null = null;
    let allowedUsers: HouseholdUser[] = [];

    try {
      // Step 1: Check user exists and belongs to household
      const user = await this.userRepository.findUserById(userId, householdId);
      if (!user) {
        errors.push('User not found or does not belong to household');
        return { isValid: false, errors };
      }

      // Step 2: Check task exists
      task = await this.taskRepository.findTaskById(taskId, householdId);
      if (!task) {
        errors.push('Task not found');
        return { isValid: false, errors };
      }

      // Step 3: Verify task belongs to same household (household isolation)
      if (task.householdId !== householdId) {
        errors.push('Unauthorized household access');
        return { isValid: false, errors };
      }

      // Step 4: Check task is active
      if (!task.isActive) {
        errors.push('Task is not active');
        return { isValid: false, errors };
      }

      // Step 5: Check user has execute permission
      const hasPermission = this.userHasPermission(user, 'task.execute');
      if (!hasPermission) {
        errors.push('User lacks required permissions');
        return { isValid: false, errors };
      }

      // Step 6: Get all allowed users in household (for notification dispatch)
      allowedUsers = await this.userRepository.findUsersInHousehold(householdId);

      // All validations passed
      return {
        isValid: true,
        errors: [],
        task,
        allowedUsers,
      };
    } catch (error) {
      console.error('Validation error:', error);
      errors.push('Validation check failed');
      return { isValid: false, errors };
    }
  }

  /**
   * Checks if a specific task exists
   *
   * @param taskId - The task ID to find
   * @param householdId - The household ID context
   * @returns The task if found, null otherwise
   *
   * Requirements: 3.1
   */
  public async validateTaskExists(taskId: string, householdId: string): Promise<Task | null> {
    try {
      return await this.taskRepository.findTaskById(taskId, householdId);
    } catch (error) {
      console.error('Failed to validate task existence:', error);
      return null;
    }
  }

  /**
   * Checks if a user has permission to execute a task
   *
   * @param userId - The user ID
   * @param taskId - The task ID
   * @param householdId - The household ID
   * @returns true if user has execute permission, false otherwise
   *
   * Requirements: 3.3, 3.7
   */
  public async validateUserPermission(
    userId: string,
    taskId: string,
    householdId: string
  ): Promise<boolean> {
    try {
      // Get user
      const user = await this.userRepository.findUserById(userId, householdId);
      if (!user) {
        return false;
      }

      // Get task
      const task = await this.taskRepository.findTaskById(taskId, householdId);
      if (!task) {
        return false;
      }

      // Verify household isolation
      if (task.householdId !== householdId || user.householdId !== householdId) {
        return false;
      }

      // Check permission
      return this.userHasPermission(user, 'task.execute');
    } catch (error) {
      console.error('Failed to validate user permission:', error);
      return false;
    }
  }

  /**
   * Lists all tasks available for a user to execute in a household
   * Respects household isolation
   *
   * @param userId - The user ID
   * @param householdId - The household ID
   * @returns Array of tasks the user can execute
   *
   * Requirements: 7.7, 6.1
   */
  public async listAvailableTasks(userId: string, householdId: string): Promise<Task[]> {
    try {
      // Check user belongs to household
      const user = await this.userRepository.findUserById(userId, householdId);
      if (!user) {
        return [];
      }

      // Check user has permission to execute tasks
      if (!this.userHasPermission(user, 'task.execute')) {
        return [];
      }

      // Get all active tasks in household
      const allTasks = await this.taskRepository.findTasksByHousehold(householdId, {
        isActive: true,
      });

      // Only return tasks that are active and in same household
      return allTasks.filter((task) => task.isActive && task.householdId === householdId);
    } catch (error) {
      console.error('Failed to list available tasks:', error);
      return [];
    }
  }

  /**
   * Gets all household members authorized to receive notifications for a task
   * Used by notification service to determine recipients
   *
   * @param taskId - The task ID
   * @param householdId - The household ID
   * @param excludeUserId - Optional user ID to exclude (e.g., the executor)
   * @returns Array of authorized household members
   *
   * Requirements: 4.1, 4.2, 6.1
   */
  public async getAuthorizedHouseholdMembers(
    taskId: string,
    householdId: string,
    excludeUserId?: string
  ): Promise<HouseholdUser[]> {
    try {
      // Verify task exists and belongs to household
      const task = await this.taskRepository.findTaskById(taskId, householdId);
      if (!task) {
        return [];
      }

      // Get all household members
      const members = await this.userRepository.findUsersInHousehold(householdId);

      // Filter out excluded user
      return members.filter((member) => member.userId !== excludeUserId);
    } catch (error) {
      console.error('Failed to get authorized household members:', error);
      return [];
    }
  }

  /**
   * Validates that all required fields for a task execution are present
   *
   * @param userId - The user ID
   * @param taskId - The task ID
   * @param householdId - The household ID
   * @returns true if all required fields are valid, false otherwise
   */
  public validateRequiredFields(userId: string, taskId: string, householdId: string): boolean {
    // Check all fields are non-empty strings
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return false;
    }

    if (!taskId || typeof taskId !== 'string' || taskId.trim().length === 0) {
      return false;
    }

    if (!householdId || typeof householdId !== 'string' || householdId.trim().length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Checks if a user has a specific permission
   * Handles both explicit permissions and role-based permissions
   *
   * @param user - The household user
   * @param permission - The permission to check for
   * @returns true if user has the permission, false otherwise
   *
   * Requirements: 3.3, 11.4, 11.5
   */
  private userHasPermission(user: HouseholdUser, permission: string): boolean {
    if (!user || !user.permissions) {
      return false;
    }

    // Owner role has all permissions implicitly
    if (user.role === 'owner') {
      return true;
    }

    // Check explicit permissions list
    return user.permissions.includes(permission) || user.permissions.includes('admin');
  }
}
