"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const PreferencesController_1 = require("./PreferencesController");
const UserRepository_1 = require("../repositories/UserRepository");
const TaskRepository_1 = require("../repositories/TaskRepository");
const EventRepository_1 = require("../repositories/EventRepository");
const HouseholdRepository_1 = require("../repositories/HouseholdRepository");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Initialize repositories and controller
const userRepository = new UserRepository_1.UserRepository();
const taskRepository = new TaskRepository_1.TaskRepository();
const eventRepository = new EventRepository_1.EventRepository();
const householdRepository = new HouseholdRepository_1.HouseholdRepository();
const preferencesController = new PreferencesController_1.PreferencesController(userRepository, taskRepository, eventRepository, householdRepository);
/**
 * Async error handling wrapper
 * Catches errors from async route handlers and passes to Express error middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
};
/**
 * GET /api/users/me/notification-preferences
 * Get current user's notification preferences
 */
router.get('/me/notification-preferences', auth_1.authMiddleware, asyncHandler((req, res) => preferencesController.getPreferences(req, res)));
/**
 * PATCH /api/users/me/notification-preferences
 * Update user's notification preferences
 */
router.patch('/me/notification-preferences', auth_1.authMiddleware, asyncHandler((req, res) => preferencesController.updatePreferences(req, res)));
/**
 * POST /api/users/me/notification-preferences/mute-task
 * Mute notifications for a specific task
 */
router.post('/me/notification-preferences/mute-task', auth_1.authMiddleware, asyncHandler((req, res) => preferencesController.muteTask(req, res)));
/**
 * DELETE /api/users/me/notification-preferences/mute-task/:taskId
 * Unmute notifications for a specific task
 */
router.delete('/me/notification-preferences/mute-task/:taskId', auth_1.authMiddleware, asyncHandler((req, res) => preferencesController.unmuteTask(req, res)));
exports.default = router;
