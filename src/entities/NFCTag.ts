import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Household } from './Household';
import { TaskEntity } from './Task';

/**
 * NFC Tag Entity - Represents a physical NFC tag associated with a task
 * Stores the NFC tag metadata, signature, and activation status
 */
@Entity('nfc_tags')
export class NFCTag {
  /**
   * Unique NFC tag identifier (e.g., NFC chip serial number)
   */
  @PrimaryColumn('varchar', { length: 255 })
  nfcTagId: string;

  /**
   * Household this NFC tag belongs to
   */
  @Column('varchar', { length: 36 })
  householdId: string;

  /**
   * Task this NFC tag is associated with
   */
  @Column('varchar', { length: 36 })
  taskId: string;

  /**
   * HMAC signature for tag authenticity verification
   * Generated using household-specific key and tag data
   */
  @Column('varchar', { length: 255 })
  signature: string;

  /**
   * Whether this NFC tag is currently active and accepted
   * Deactivated tags will be rejected even if signature is valid
   */
  @Column('boolean', { default: true })
  isActive: boolean;

  /**
   * Timestamp when this NFC tag was created
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Timestamp when this NFC tag was deactivated (if applicable)
   */
  @Column('timestamp', { nullable: true })
  deactivatedAt?: Date;

  /**
   * Optional reason for deactivation
   */
  @Column('varchar', { length: 255, nullable: true })
  deactivationReason?: string;

  /**
   * Optional metadata for the NFC tag
   */
  @Column('jsonb', { nullable: true })
  metadata?: Record<string, unknown>;

  // Relations (optional for this implementation, kept for future use)
  @ManyToOne(() => Household)
  @JoinColumn({ name: 'householdId' })
  household?: Household;

  @ManyToOne(() => TaskEntity)
  @JoinColumn({ name: 'taskId' })
  task?: TaskEntity;
}
