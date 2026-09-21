import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Household } from './Household';
import { randomUUID } from 'crypto';

/**
 * User Entity - Represents a user who belongs to a household
 * Maps to the HouseholdUser interface from src/types/index.ts
 */
@Entity('users')
@Index(['householdId'])
@Index(['email', 'householdId'], { unique: true })
@Index(['householdId', 'role'])
export class UserEntity {
  @PrimaryColumn('uuid')
  userId: string = randomUUID();

  @Column('uuid')
  householdId: string;

  @ManyToOne(() => Household, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'householdId' })
  household: Household;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('varchar', { length: 255 })
  email: string;

  @Column('varchar', { length: 255 })
  passwordHash: string;

  @Column('varchar', { length: 50 })
  role: 'owner' | 'member';

  @Column('varchar', { length: 500, nullable: true })
  pushToken?: string;

  @Column('varchar', { array: true, default: () => "'{}'" })
  pushTokens: string[];

  @Column('varchar', { array: true, default: () => "'{}'" })
  permissions: string[];

  @Column('jsonb')
  preferences: {
    notificationsEnabled: boolean;
    mutedTasks: string[];
    quietHours?: {
      start: number;
      end: number;
    };
    channels: ('push' | 'email' | 'sms')[];
  };

  @CreateDateColumn()
  createdAt: Date;

  @Column('bigint')
  createdAtTimestamp: number;

  @UpdateDateColumn()
  lastActiveAt: Date;

  @Column('bigint', { nullable: true })
  lastActiveAtTimestamp?: number;

  @Column('bigint', { nullable: true })
  pushTokenLastChangedAt?: number;

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
}
