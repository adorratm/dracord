import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** G3 — beyaz tahtadaki bir çizgi (kanal başına bir tahta) */
@Entity('whiteboard_strokes')
@Index(['channelId', 'createdAt'])
export class WhiteboardStrokeRow extends CuidEntity {
  @Column({ type: 'varchar' })
  channelId!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar', length: 12 })
  tool!: string;

  @Column({ type: 'varchar', length: 9 })
  color!: string;

  @Column({ type: 'real' })
  width!: number;

  @Column({ type: 'jsonb' })
  points!: number[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
