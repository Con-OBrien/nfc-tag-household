import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { randomUUID } from 'crypto';

/**
 * TaskEvent Entity - Immutable audit trail log for all task-related actions
 * READ-ONLY: Events can only be inserted, never updated or deleted
 * Maps to the TaskEvent interface from src/types/index.ts
 */
@Entity('task_events')
@Index(['householdId', 'taskId', 'userId', 'timestamp'])
@Index(['householdId', 'taskId', 'timestamp'])
@Index(['userId', 'householdId', 'timestamp'])
@Index(['householdId', 'timestamp'])
export class TaskEventEntity {
  @PrimaryColumn('uuid')
  eventId: string = randomUUID();

  @Column('uuid')
  userId: string;

  @Column('uuid')
  taskId: string;

  @Column('uuid')
  householdId: string;

  @Column('varchar', { length: 50 })
  action: 'execute' | 'acknowledge' | 'undo' | 'comment';

  @Column('bigint')
  timestamp: number;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

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
  validateImmutability(): void {
    // This method is called before any update operation
    throw new Error(
      `Cannot modify task event ${this.eventId}. Events are immutable. ` +
        `Events can only be created, never updated or deleted.`
    );
  }
}
