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
exports.TaskEntity = void 0;
const typeorm_1 = require("typeorm");
const Household_1 = require("./Household");
const crypto_1 = require("crypto");
/**
 * Task Entity - Represents a discrete unit of work assigned within a household
 * Maps to the Task interface from src/types/index.ts
 */
let TaskEntity = class TaskEntity {
    constructor() {
        this.taskId = (0, crypto_1.randomUUID)();
    }
    /**
     * Converts database entity to Task interface
     */
    toTask() {
        return {
            taskId: this.taskId,
            name: this.name,
            description: this.description,
            category: this.category,
            householdId: this.householdId,
            createdAt: this.createdAtTimestamp,
            createdBy: this.createdBy,
            isActive: this.isActive,
            metadata: this.metadata,
        };
    }
};
exports.TaskEntity = TaskEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], TaskEntity.prototype, "taskId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 100 }),
    __metadata("design:type", String)
], TaskEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], TaskEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 100 }),
    __metadata("design:type", String)
], TaskEntity.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], TaskEntity.prototype, "householdId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Household_1.Household, (household) => household.tasks, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'householdId' }),
    __metadata("design:type", Household_1.Household)
], TaskEntity.prototype, "household", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TaskEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint'),
    __metadata("design:type", Number)
], TaskEntity.prototype, "createdAtTimestamp", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], TaskEntity.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)('boolean', { default: true }),
    __metadata("design:type", Boolean)
], TaskEntity.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { nullable: true }),
    __metadata("design:type", Object)
], TaskEntity.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], TaskEntity.prototype, "updatedAt", void 0);
exports.TaskEntity = TaskEntity = __decorate([
    (0, typeorm_1.Entity)('tasks'),
    (0, typeorm_1.Index)(['householdId', 'isActive']),
    (0, typeorm_1.Index)(['householdId', 'taskId']),
    (0, typeorm_1.Index)(['createdBy', 'householdId'])
], TaskEntity);
