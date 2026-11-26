import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Günlük aktiflik serisi (mesaj veya ses) — kullanıcı başına tek satır */
@Entity('user_streaks')
export class UserStreak {
  @PrimaryColumn({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'int', default: 0 })
  current!: number;

  @Column({ type: 'int', default: 0 })
  best!: number;

  /** İstanbul gününe göre son aktif gün (YYYY-MM-DD) */
  @Column({ type: 'varchar', length: 10, nullable: true })
  lastDay!: string | null;

  /** Kaçırılan bir günü kurtaran dondurucu (7 günde 1, en fazla 2) */
  @Column({ type: 'int', default: 0 })
  freezes!: number;

  @Column({ type: 'int', default: 0 })
  freezesUsed!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
