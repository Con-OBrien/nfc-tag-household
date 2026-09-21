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
exports.Household = void 0;
const typeorm_1 = require("typeorm");
const Task_1 = require("./Task");
const crypto_1 = require("crypto");
/**
 * Household Entity - Represents a logical grouping of users who share and track tasks
 * Maps to the Household interface from src/types/index.ts
 */
let Household = class Household {
    constructor() {
        this.householdId = (0, crypto_1.randomUUID)();
    }
    /**
     * Converts database entity to Household interface
     */
    toHousehold() {
        return {
            householdId: this.householdId,
            name: this.name,
            createdAt: this.createdAtTimestamp,
            createdBy: this.createdBy,
            members: this.members,
            settings: this.settings,
        };
    }
};
exports.Household = Household;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], Household.prototype, "householdId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 255 }),
    __metadata("design:type", String)
], Household.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Household.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint'),
    __metadata("design:type", Number)
], Household.prototype, "createdAtTimestamp", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], Household.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid', { array: true, default: () => "'{}'" }),
    __metadata("design:type", Array)
], Household.prototype, "members", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb'),
    __metadata("design:type", Object)
], Household.prototype, "settings", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Task_1.TaskEntity, (task) => task.household, {
        cascade: true,
    }),
    __metadata("design:type", Array)
], Household.prototype, "tasks", void 0);
exports.Household = Household = __decorate([
    (0, typeorm_1.Entity)('households'),
    (0, typeorm_1.Index)(['createdBy'])
], Household);
