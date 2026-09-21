/**
 * NFC Tag Data Interface - Data extracted from physical NFC tag
 */
export interface NFCTagData {
  tagId: string;
  taskId: string;
  timestamp: number;
  signature?: string;
}

/**
 * Task Event Interface - Structured record of a task-related action
 */
export interface TaskEvent {
  eventId: string;
  userId: string;
  taskId: string;
  householdId: string;
  action: 'execute' | 'acknowledge' | 'undo' | 'comment';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Task Interface - A discrete unit of work assigned within a household
 */
export interface Task {
  taskId: string;
  name: string;
  description: string;
  category: string;
  householdId: string;
  createdAt: number;
  createdBy: string;
  isActive: boolean;
  metadata?: {
    recurrence?: 'daily' | 'weekly' | 'monthly' | 'one-time';
    dueDate?: number;
    estimatedMinutes?: number;
    [key: string]: unknown;
  };
}

/**
 * Household User Interface - A user who belongs to a household
 */
export interface HouseholdUser {
  userId: string;
  householdId: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
  pushToken: string;
  permissions: string[];
  preferences: {
    notificationsEnabled: boolean;
    mutedTasks: string[];
    quietHours?: {
      start: number;
      end: number;
    };
    channels: ('push' | 'email' | 'sms')[];
  };
  createdAt: number;
  lastActiveAt?: number;
}

/**
 * Household Interface - A logical grouping of users
 */
export interface Household {
  householdId: string;
  name: string;
  createdAt: number;
  createdBy: string;
  members: string[];
  settings: {
    defaultNotificationSettings: Record<string, unknown>;
    taskCategories: string[];
  };
}

/**
 * Notification Payload - Data sent to push notification service
 */
export interface NotificationPayload {
  title: string;
  body: string;
  data: {
    taskId: string;
    eventId: string;
    eventType: string;
    timestamp: number;
  };
  deepLink?: string;
}

/**
 * API Request/Response Types
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: number;
}

export interface CreateTaskRequest {
  name: string;
  description: string;
  category: string;
  metadata?: Task['metadata'];
}

export interface CreateHouseholdRequest {
  name: string;
  description?: string;
}

export interface UpdateUserPreferencesRequest {
  notificationsEnabled?: boolean;
  mutedTasks?: string[];
  quietHours?: {
    start: number;
    end: number;
  };
  channels?: ('push' | 'email' | 'sms')[];
}

export interface InviteUserRequest {
  email: string;
  role?: 'member' | 'owner';
}

export interface TagScanRequest {
  tagId: string;
  taskId: string;
  timestamp: number;
  signature?: string;
}

/**
 * Error Types
 */
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', 400, message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', 404, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', 401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', 403, message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Validation Results
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: unknown;
}

export interface TaskValidationResult extends ValidationResult {
  task?: Task;
  allowedUsers?: HouseholdUser[];
}
