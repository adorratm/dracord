import { Column, CreateDateColumn, Entity, Index, UpdateDateColumn } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** Kanal panosu sütunu (D5) */
@Entity('kanban_columns')
@Index('IDX_kanban_columns_channel', ['channelId', 'position'])
export class KanbanColumn extends CuidEntity {
  @Column({ type: 'varchar' })
  channelId!: string;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @Column({ type: 'double precision', default: 0 })
  position!: number;

  @Column({ type: 'varchar', length: 9, nullable: true })
  color!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

/** Pano kartı */
@Entity('kanban_cards')
@Index('IDX_kanban_cards_channel', ['channelId', 'columnId', 'position'])
export class KanbanCard extends CuidEntity {
  @Column({ type: 'varchar' })
  channelId!: string;

  @Column({ type: 'varchar' })
  columnId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  assigneeIds!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  labels!: string[];

  @Column({ type: 'timestamptz', nullable: true })
  dueAt!: Date | null;

  @Column({ type: 'double precision', default: 0 })
  position!: number;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
