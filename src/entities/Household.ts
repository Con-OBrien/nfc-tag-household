import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { TaskEntity } from './Task';
import { randomUUID } from 'crypto';

/**
 * Household Entity - Represents a logical grouping of users who share and track tasks
 * Maps to the Household interface from src/types/index.ts
 */
@Entity('households')
@Index(['createdBy'])
export class Household {
  @PrimaryColumn('uuid')
  householdId: string = randomUUID();

  @Column('varchar', { length: 255 })
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column('bigint')
  createdAtTimestamp: number;

  @Column('uuid')
  createdBy: string;

  @Column('uuid', { array: true, default: () => "'{}'" })
  members: string[];

  @Column('jsonb')
  settings: {
    defaultNotificationSettings: Record<string, unknown>;
    taskCategories: string[];
  };

  @OneToMany(() => TaskEntity, (task) => task.household, {
    cascade: true,
  })
  tasks: TaskEntity[];

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
}
