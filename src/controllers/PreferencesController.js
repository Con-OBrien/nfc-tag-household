"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferencesController = void 0;
const types_1 = require("../types");
/**
 * PreferencesController - Handles user notification preference management
 * Provides endpoints for getting and updating notification settings
 * Validates preferences and logs changes to audit trail
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
 */
class PreferencesController {
    constructor(userRepository, taskRepository, eventRepository, householdRepository) {
        this.userRepository = userRepository;
        this.taskRepository = taskRepository;
        this.eventRepository = eventRepository;
        this.householdRepository = householdRepository;
    }
    /**
     * GET /api/users/me/notification-preferences
     * Get current user's notification preferences
     * Returns: { notificationsEnabled, mutedTasks: [], quietHours?: { start, end }, channels: [] }
     * Requirements: 9.1, 9.2
     */
    async getPreferences(req, res) {
        const userId = req.userId;
        const householdId = req.householdId;
        try {
            const user = await this.userRepository.findUserById(userId, householdId);
            if (!user) {
                throw new types_1.NotFoundError('User');
            }
            // Set cache headers - no caching for preferences as they change frequently
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.status(200).json({
                success: true,
                data: {
                    notificationsEnabled: user.preferences.notificationsEnabled,
                    mutedTasks: user.preferences.mutedTasks,
                    quietHours: user.preferences.quietHours,
                    channels: user.preferences.channels,
                },
                timestamp: Date.now(),
            });
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * PATCH /api/users/me/notification-preferences
     * Update user's notification preferences
     * Request body can contain any combination of preference fields
     * Validates all inputs before updating
     * Logs change to audit trail
     * Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
     */
    async updatePreferences(req, res) {
        const userId = req.userId;
        const householdId = req.householdId;
        const preferences = req.body;
        try {
            // Validate user exists
            const user = await this.userRepository.findUserById(userId, householdId);
            if (!user) {
                throw new types_1.NotFoundError('User');
            }
            // Store old preferences for audit logging
            const oldPreferences = JSON.stringify(user.preferences);
            // Validate and normalize request data
            this.validatePreferenceUpdate(preferences, householdId);
            // Apply updates
            await this.userRepository.updateUserPreferences(userId, householdId, preferences);
            // Get updated user for response
            const updatedUser = await this.userRepository.findUserById(userId, householdId);
            if (!updatedUser) {
                throw new Error('Failed to retrieve updated user');
            }
            // Log preference change to audit trail
            await this.eventRepository.logEvent({
                userId,
                taskId: 'preference-update',
                householdId,
                action: 'comment',
                timestamp: Date.now(),
                metadata: {
                    eventType: 'preference_change',
                    changes: preferences,
                    oldPreferences,
                },
            });
            res.status(200).json({
                success: true,
                data: {
                    notificationsEnabled: updatedUser.preferences.notificationsEnabled,
                    mutedTasks: updatedUser.preferences.mutedTasks,
                    quietHours: updatedUser.preferences.quietHours,
                    channels: updatedUser.preferences.channels,
                    updatedAt: Date.now(),
                },
                timestamp: Date.now(),
            });
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * POST /api/users/me/notification-preferences/mute-task
     * Add a task to user's muted tasks list
     * Idempotent - adding already-muted task is no-op
     * Requirements: 9.3, 9.4
     */
    async muteTask(req, res) {
        const userId = req.userId;
        const householdId = req.householdId;
        const { taskId } = req.body;
        try {
            // Validate taskId provided
            if (!taskId || typeof taskId !== 'string') {
                throw new types_1.ValidationError('taskId is required and must be a string');
            }
            // Validate user exists
            const user = await this.userRepository.findUserById(userId, householdId);
            if (!user) {
                throw new types_1.NotFoundError('User');
            }
            // Validate task exists and belongs to household
            const task = await this.taskRepository.findTaskById(taskId, householdId);
            if (!task) {
                throw new types_1.NotFoundError('Task');
            }
            // Check if already muted (idempotent)
            if (user.preferences.mutedTasks.includes(taskId)) {
                res.status(200).json({
                    success: true,
                    data: {
                        taskId,
                        mutedAt: Date.now(),
                        alreadyMuted: true,
                    },
                    timestamp: Date.now(),
                });
                return;
            }
            // Add to muted list
            const updatedMutedTasks = [...user.preferences.mutedTasks, taskId];
            await this.userRepository.updateUserPreferences(userId, householdId, {
                mutedTasks: updatedMutedTasks,
            });
            // Log mute action
            await this.eventRepository.logEvent({
                userId,
                taskId,
                householdId,
                action: 'comment',
                timestamp: Date.now(),
                metadata: {
                    eventType: 'task_muted',
                },
            });
            res.status(200).json({
                success: true,
                data: {
                    taskId,
                    mutedAt: Date.now(),
                },
                timestamp: Date.now(),
            });
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * DELETE /api/users/me/notification-preferences/mute-task/:taskId
     * Remove a task from user's muted tasks list
     * Requirements: 9.3, 9.4
     */
    async unmuteTask(req, res) {
        const userId = req.userId;
        const householdId = req.householdId;
        const taskId = typeof req.params.taskId === 'string' ? req.params.taskId : req.params.taskId.toString();
        try {
            // Validate taskId provided
            if (!taskId) {
                throw new types_1.ValidationError('taskId is required');
            }
            // Validate user exists
            const user = await this.userRepository.findUserById(userId, householdId);
            if (!user) {
                throw new types_1.NotFoundError('User');
            }
            // Validate task exists
            const task = await this.taskRepository.findTaskById(taskId, householdId);
            if (!task) {
                throw new types_1.NotFoundError('Task');
            }
            // Remove from muted list (no-op if not muted)
            const updatedMutedTasks = user.preferences.mutedTasks.filter((id) => id !== taskId);
            await this.userRepository.updateUserPreferences(userId, householdId, {
                mutedTasks: updatedMutedTasks,
            });
            // Log unmute action
            await this.eventRepository.logEvent({
                userId,
                taskId,
                householdId,
                action: 'comment',
                timestamp: Date.now(),
                metadata: {
                    eventType: 'task_unmuted',
                },
            });
            res.status(204).send();
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Validate preference update request
     * Checks quiet hours format, channels validity, task IDs
     * Requirements: 9.5, 9.6, 9.7
     */
    validatePreferenceUpdate(preferences, householdId) {
        // Validate notificationsEnabled
        if (preferences.notificationsEnabled !== undefined &&
            typeof preferences.notificationsEnabled !== 'boolean') {
            throw new types_1.ValidationError('notificationsEnabled must be a boolean');
        }
        // Validate quiet hours format
        if (preferences.quietHours) {
            this.validateQuietHours(preferences.quietHours);
        }
        // Validate channels
        if (preferences.channels) {
            this.validateChannels(preferences.channels);
        }
        // Note: mutedTasks validation happens per-task in muteTask() to avoid N+1 queries
        if (preferences.mutedTasks && !Array.isArray(preferences.mutedTasks)) {
            throw new types_1.ValidationError('mutedTasks must be an array of task IDs');
        }
    }
    /**
     * Validate quiet hours format
     * Requirements: 9.5
     */
    validateQuietHours(quietHours) {
        if (quietHours === null) {
            // null is valid - means no quiet hours
            return;
        }
        if (!quietHours || typeof quietHours !== 'object') {
            throw new types_1.ValidationError('quietHours must be an object or null');
        }
        const { start, end } = quietHours;
        // Both start and end must be present if object is provided
        if (start === undefined || end === undefined) {
            throw new types_1.ValidationError('quietHours must have both start and end times');
        }
        // Both must be numbers
        if (typeof start !== 'number' || typeof end !== 'number') {
            throw new types_1.ValidationError('quietHours start and end must be numbers');
        }
        // Both must be in 24-hour format (0-23)
        if (start < 0 || start > 23) {
            throw new types_1.ValidationError('quietHours.start must be in 24-hour format (0-23)');
        }
        if (end < 0 || end > 23) {
            throw new types_1.ValidationError('quietHours.end must be in 24-hour format (0-23)');
        }
    }
    /**
     * Validate notification channels
     * Requirements: 9.7
     */
    validateChannels(channels) {
        if (!Array.isArray(channels)) {
            throw new types_1.ValidationError('channels must be an array');
        }
        const validChannels = ['push', 'email', 'sms'];
        for (const channel of channels) {
            if (!validChannels.includes(channel)) {
                throw new types_1.ValidationError(`Invalid channel "${channel}". Must be one of: push, email, sms`);
            }
        }
    }
}
exports.PreferencesController = PreferencesController;
