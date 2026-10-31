import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import type { TrustSafetyCategory } from '@/database/entities/trust-safety-report.entity';
import { GuildSafetyService } from './guild-safety.service';

const ALLOWED: TrustSafetyCategory[] = [
  'csam',
  'sexual',
  'drugs',
  'violence',
  'gambling',
  'copyright',
  'other',
];

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly safety: GuildSafetyService) {}

  /** Kullanıcı şikayeti → T&S kuyruğu */
  @Post()
  async create(
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: {
      category?: string;
      guildId?: string | null;
      channelId?: string | null;
      messageId?: string | null;
      targetUserId?: string | null;
      reason?: string;
    },
  ) {
    const raw = (body?.category ?? 'other').toLowerCase();
    const category = (ALLOWED.includes(raw as TrustSafetyCategory)
      ? raw
      : 'other') as TrustSafetyCategory;
    const row = await this.safety.createReport(
      {
        category,
        guildId: body?.guildId ?? null,
        channelId: body?.channelId ?? null,
        messageId: body?.messageId ?? null,
        userId: body?.targetUserId ?? null,
        source: `user:${user.sub}`,
        score: category === 'csam' ? 1 : 0.5,
        summary: (body?.reason ?? 'Kullanıcı şikayeti').slice(0, 500),
        evidence: { reporterId: user.sub },
      },
      { enqueueScan: category !== 'csam' },
    );
    return { id: row.id, status: row.status, category: row.category };
  }
}
