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
exports.UserEntity = void 0;
const typeorm_1 = require("typeorm");
const Household_1 = require("./Household");
const crypto_1 = require("crypto");
/**
 * User Entity - Represents a user who belongs to a household
 * Maps to the HouseholdUser interface from src/types/index.ts
 */
let UserEntity = class UserEntity {
    constructor() {
        this.userId = (0, crypto_1.randomUUID)();
    }
    /**
     * Converts database entity to HouseholdUser interface
     */
    toHouseholdUser() {
        return {
            userId: this.userId,
            householdId: this.householdId,
            name: this.name,
            email: this.email,
            role: this.role,
            pushToken: this.pushToken || '',
            permissions: this.permissions,
            preferences: this.preferences,
            createdAt: this.createdAtTimestamp,
            lastActiveAt: this.lastActiveAtTimestamp,
        };
    }
};
exports.UserEntity = UserEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], UserEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)('uuid'),
    __metadata("design:type", String)
], UserEntity.prototype, "householdId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Household_1.Household, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'householdId' }),
    __metadata("design:type", Household_1.Household)
], UserEntity.prototype, "household", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 255 }),
    __metadata("design:type", String)
], UserEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 255 }),
    __metadata("design:type", String)
], UserEntity.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 255 }),
    __metadata("design:type", String)
], UserEntity.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 50 }),
    __metadata("design:type", String)
], UserEntity.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 500, nullable: true }),
    __metadata("design:type", String)
], UserEntity.prototype, "pushToken", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { array: true, default: () => "'{}'" }),
    __metadata("design:type", Array)
], UserEntity.prototype, "pushTokens", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { array: true, default: () => "'{}'" }),
    __metadata("design:type", Array)
], UserEntity.prototype, "permissions", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb'),
    __metadata("design:type", Object)
], UserEntity.prototype, "preferences", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint'),
    __metadata("design:type", Number)
], UserEntity.prototype, "createdAtTimestamp", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], UserEntity.prototype, "lastActiveAt", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint', { nullable: true }),
    __metadata("design:type", Number)
], UserEntity.prototype, "lastActiveAtTimestamp", void 0);
__decorate([
    (0, typeorm_1.Column)('bigint', { nullable: true }),
    __metadata("design:type", Number)
], UserEntity.prototype, "pushTokenLastChangedAt", void 0);
exports.UserEntity = UserEntity = __decorate([
    (0, typeorm_1.Entity)('users'),
    (0, typeorm_1.Index)(['householdId']),
    (0, typeorm_1.Index)(['email', 'householdId'], { unique: true }),
    (0, typeorm_1.Index)(['householdId', 'role'])
], UserEntity);
