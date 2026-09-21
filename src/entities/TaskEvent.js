"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskEventEntity = void 0;
const typeorm_1 = require("typeorm");
const crypto_1 = require("crypto");
/**
 * TaskEvent Entity - Immutable audit trail log for all task-related actions
 * READ-ONLY: Events can only be inserted, never updated or deleted
 * Maps to the TaskEvent interface from src/types/index.ts
 */
let TaskEventEntity = class TaskEventEntity {
    constructor() {
        this.eventId = (0, crypto_1.randomUUID)();
    }
    /**
     * Converts database entity to TaskEvent interface
     */
    toTaskEvent() {
        return {
            eventId: this.eventId,
            userId: this.userId,
            taskId: this.taskId,
            householdId: this.householdId,
            action: this.action,
            timestamp: this.timestamp,
            metadata: this.metadata,
        };
    }
    /**
     * Prevents any modification of this event
     * This is enforced at the application level to catch programming errors early
     */
    validateImmutability() {
        // This method is called before any update operation
        throw new Error(`Cannot modify task event ${this.eventId}. Events are immutable. ` +
            `Events can only be created, never updated or deleted.`);
    }
};
exports.TaskEventEntity = TaskEventEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], TaskEventEntity.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], TaskEventEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], TaskEventEntity.prototype, "taskId", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], TaskEventEntity.prototype, "householdId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 50 }),
    __metadata("design:type", String)
], TaskEventEntity.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint'),
    __metadata("design:type", Number)
], TaskEventEntity.prototype, "timestamp", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { nullable: true }),
    __metadata("design:type", Object)
], TaskEventEntity.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TaskEventEntity.prototype, "createdAt", void 0);
exports.TaskEventEntity = TaskEventEntity = __decorate([
    (0, typeorm_1.Entity)('task_events'),
    (0, typeorm_1.Index)(['householdId', 'taskId', 'userId', 'timestamp']),
    (0, typeorm_1.Index)(['householdId', 'taskId', 'timestamp']),
    (0, typeorm_1.Index)(['userId', 'householdId', 'timestamp']),
    (0, typeorm_1.Index)(['householdId', 'timestamp'])
], TaskEventEntity);
