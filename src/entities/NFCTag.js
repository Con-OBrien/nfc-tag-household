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
exports.NFCTag = void 0;
const typeorm_1 = require("typeorm");
const Household_1 = require("./Household");
const Task_1 = require("./Task");
/**
 * NFC Tag Entity - Represents a physical NFC tag associated with a task
 * Stores the NFC tag metadata, signature, and activation status
 */
let NFCTag = class NFCTag {
};
exports.NFCTag = NFCTag;
__decorate([
    (0, typeorm_1.PrimaryColumn)('varchar', { length: 255 }),
    __metadata("design:type", String)
], NFCTag.prototype, "nfcTagId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 36 }),
    __metadata("design:type", String)
], NFCTag.prototype, "householdId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 36 }),
    __metadata("design:type", String)
], NFCTag.prototype, "taskId", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 255 }),
    __metadata("design:type", String)
], NFCTag.prototype, "signature", void 0);
__decorate([
    (0, typeorm_1.Column)('boolean', { default: true }),
    __metadata("design:type", Boolean)
], NFCTag.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], NFCTag.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamp', { nullable: true }),
    __metadata("design:type", Date)
], NFCTag.prototype, "deactivatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar', { length: 255, nullable: true }),
    __metadata("design:type", String)
], NFCTag.prototype, "deactivationReason", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { nullable: true }),
    __metadata("design:type", Object)
], NFCTag.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Household_1.Household),
    (0, typeorm_1.JoinColumn)({ name: 'householdId' }),
    __metadata("design:type", Household_1.Household)
], NFCTag.prototype, "household", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Task_1.TaskEntity),
    (0, typeorm_1.JoinColumn)({ name: 'taskId' }),
    __metadata("design:type", Task_1.TaskEntity)
], NFCTag.prototype, "task", void 0);
exports.NFCTag = NFCTag = __decorate([
    (0, typeorm_1.Entity)('nfc_tags')
], NFCTag);
