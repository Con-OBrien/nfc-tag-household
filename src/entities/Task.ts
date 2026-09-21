import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Household } from './Household';
import { randomUUID } from 'crypto';

/**
 * Task Entity - Represents a discrete unit of work assigned within a household
 * Maps to the Task interface from src/types/index.ts
 */
@Entity('tasks')
@Index(['householdId', 'isActive'])
@Index(['householdId', 'taskId'])
@Index(['createdBy', 'householdId'])
export class TaskEntity {
  @PrimaryColumn('uuid')
  taskId: string = randomUUID();

  @Column('varchar', { length: 100 })
  name: string;

  @Column('text')
  description: string;

  @Column('varchar', { length: 100 })
  category: string;

  @Column('uuid')
  householdId: string;

  @ManyToOne(() => Household, (household) => household.tasks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'householdId' })
  household: Household;

  @CreateDateColumn()
  createdAt: Date;

  @Column('bigint')
  createdAtTimestamp: number;

  @Column('uuid')
  createdBy: string;

  @Column('boolean', { default: true })
  isActive: boolean;

  @Column('jsonb', { nullable: true })
  metadata?: {
    recurrence?: 'daily' | 'weekly' | 'monthly' | 'one-time';
    dueDate?: number;
    estimatedMinutes?: number;
    [key: string]: unknown;
  };

  @UpdateDateColumn()
  updatedAt: Date;

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
}
