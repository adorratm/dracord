import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** B5 — bu üye katılış ekranını tamamladı (üye ayrılınca silinir) */
@Entity('guild_onboarding_completions')
export class GuildOnboardingCompletion {
  @PrimaryColumn({ type: 'varchar' })
  guildId!: string;

  @PrimaryColumn({ type: 'varchar' })
  userId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  completedAt!: Date;
}
