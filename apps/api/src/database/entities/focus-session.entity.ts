import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** D6 — kanal başına ortak odak zamanlayıcısı */
@Entity('focus_sessions')
export class FocusSession {
  @PrimaryColumn({ type: 'varchar' })
  channelId!: string;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'int', default: 25 })
  focusMin!: number;

  @Column({ type: 'int', default: 5 })
  breakMin!: number;

  @Column({ type: 'int', default: 15 })
  longBreakMin!: number;

  @Column({ type: 'int', default: 4 })
  longEvery!: number;

  @Column({ type: 'varchar', nullable: true })
  startedBy!: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
