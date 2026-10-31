import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { GuildSafetyPolicy } from '@/database/entities/guild-safety-policy.entity';
import { TrustedGuild } from '@/database/entities/trusted-guild.entity';
import {
  TrustSafetyReport,
  type TrustSafetyCategory,
} from '@/database/entities/trust-safety-report.entity';
import { QueuesService } from '@/queues/queues.service';

/** Platform floor — guild bundan daha gevşek yapamaz (Trusted hariç) */
export const PLATFORM_FLOOR = {
  nsfwThreshold: 0.55,
  gamblingThreshold: 0.7,
  scanScreenShare: true,
  scanAttachments: true,
  scanText: true,
  copyrightHeuristics: true,
} as const;

export type EffectiveSafetyPolicy = {
  trusted: boolean;
  nsfwThreshold: number;
  gamblingThreshold: number;
  scanScreenShare: boolean;
  scanAttachments: boolean;
  scanText: boolean;
  copyrightHeuristics: boolean;
};

@Injectable()
export class GuildSafetyService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
    private readonly queues: QueuesService,
  ) {}

  async isTrustedGuild(guildId: string | null | undefined): Promise<boolean> {
    if (!guildId) return false;
    const row = await this.em.findOne(TrustedGuild, { where: { guildId } });
    return Boolean(row);
  }

  async listTrustedGuilds() {
    return this.em.find(TrustedGuild, { order: { createdAt: 'DESC' } });
  }

  async addTrustedGuild(guildId: string, createdByUserId: string, note?: string) {
    let row = await this.em.findOne(TrustedGuild, { where: { guildId } });
    if (!row) {
      row = this.em.create(TrustedGuild, {
        guildId,
        createdByUserId,
        note: note ?? null,
      });
    } else {
      row.note = note ?? row.note;
      row.createdByUserId = createdByUserId;
    }
    await this.em.save(TrustedGuild, row);
    return row;
  }

  async removeTrustedGuild(guildId: string) {
    const row = await this.em.findOne(TrustedGuild, { where: { guildId } });
    if (!row) throw new NotFoundException('Trusted guild yok');
    await this.em.remove(TrustedGuild, row);
    return { ok: true };
  }

  async getOrCreatePolicy(guildId: string): Promise<GuildSafetyPolicy> {
    let row = await this.em.findOne(GuildSafetyPolicy, { where: { guildId } });
    if (!row) {
      row = this.em.create(GuildSafetyPolicy, {
        guildId,
        ...PLATFORM_FLOOR,
      });
      await this.em.save(GuildSafetyPolicy, row);
    }
    return row;
  }

  /**
   * Guild admin soften: eşikleri yükseltebilir (daha az sıkı) ama floor altı / feature off yok.
   * Trusted: tüm taramalar kapalı sayılır.
   */
  async getEffectivePolicy(guildId: string | null | undefined): Promise<EffectiveSafetyPolicy> {
    if (!guildId) {
      return { trusted: false, ...PLATFORM_FLOOR };
    }
    if (await this.isTrustedGuild(guildId)) {
      return {
        trusted: true,
        nsfwThreshold: 1,
        gamblingThreshold: 1,
        scanScreenShare: false,
        scanAttachments: false,
        scanText: false,
        copyrightHeuristics: false,
      };
    }
    const p = await this.getOrCreatePolicy(guildId);
    return {
      trusted: false,
      nsfwThreshold: Math.min(
        Math.max(p.nsfwThreshold, PLATFORM_FLOOR.nsfwThreshold),
        PLATFORM_FLOOR.nsfwThreshold + 0.25,
      ),
      gamblingThreshold: Math.min(
        Math.max(p.gamblingThreshold, PLATFORM_FLOOR.gamblingThreshold),
        PLATFORM_FLOOR.gamblingThreshold + 0.2,
      ),
      scanScreenShare: true,
      scanAttachments: true,
      scanText: true,
      copyrightHeuristics: true,
    };
  }

  async softenPolicy(
    guildId: string,
    patch: Partial<Pick<GuildSafetyPolicy, 'nsfwThreshold' | 'gamblingThreshold'>>,
  ) {
    if (await this.isTrustedGuild(guildId)) {
      throw new ForbiddenException('Trusted sunucuda politika gerekmez');
    }
    const p = await this.getOrCreatePolicy(guildId);
    if (typeof patch.nsfwThreshold === 'number') {
      // Daha yüksek eşik = daha gevşek; floor’un 0.25 üzerine kadar
      p.nsfwThreshold = Math.min(
        Math.max(patch.nsfwThreshold, PLATFORM_FLOOR.nsfwThreshold),
        PLATFORM_FLOOR.nsfwThreshold + 0.25,
      );
    }
    if (typeof patch.gamblingThreshold === 'number') {
      p.gamblingThreshold = Math.min(
        Math.max(patch.gamblingThreshold, PLATFORM_FLOOR.gamblingThreshold),
        PLATFORM_FLOOR.gamblingThreshold + 0.2,
      );
    }
    // Feature bayrakları floor — guild kapatamaz
    p.scanScreenShare = true;
    p.scanAttachments = true;
    p.scanText = true;
    p.copyrightHeuristics = true;
    await this.em.save(GuildSafetyPolicy, p);
    return this.getEffectivePolicy(guildId);
  }

  async createReport(
    input: {
      category: TrustSafetyCategory;
      guildId?: string | null;
      channelId?: string | null;
      messageId?: string | null;
      userId?: string | null;
      source?: string;
      score?: number;
      summary?: string;
      evidence?: Record<string, unknown>;
    },
    opts?: { enqueueScan?: boolean },
  ) {
    const row = this.em.create(TrustSafetyReport, {
      category: input.category,
      status: 'open',
      guildId: input.guildId ?? null,
      channelId: input.channelId ?? null,
      messageId: input.messageId ?? null,
      userId: input.userId ?? null,
      source: input.source ?? 'auto',
      score: input.score ?? 0,
      summary: input.summary ?? null,
      evidence: input.evidence ?? null,
    });
    await this.em.save(TrustSafetyReport, row);
    if (opts?.enqueueScan !== false) {
      await this.queues.enqueueMediaScan({
        reportId: row.id,
        category: row.category,
      });
    }
    return row;
  }

  async listOpenReports(limit = 50) {
    return this.em.find(TrustSafetyReport, {
      where: [{ status: 'open' }, { status: 'reviewing' }],
      order: { createdAt: 'DESC' },
      take: Math.min(100, Math.max(1, limit)),
    });
  }

  async resolveReport(
    id: string,
    resolverUserId: string,
    status: 'resolved' | 'dismissed',
  ) {
    const row = await this.em.findOne(TrustSafetyReport, { where: { id } });
    if (!row) throw new NotFoundException('Rapor yok');
    row.status = status;
    row.resolvedAt = new Date();
    row.resolvedByUserId = resolverUserId;
    await this.em.save(TrustSafetyReport, row);
    return row;
  }

  /**
   * İstemci NSFW filtresi kapatılabilir mi?
   * TrustedGuild · sunucu sahibi / platform admin · ALLOW_CLIENT_NSFW_OFF=true
   */
  clientNsfwOverrideAllowed(
    _guildId: string | null | undefined,
    trusted: boolean,
    opts?: { guildOwnerOrPlatformAdmin?: boolean },
  ) {
    if (trusted) return true;
    if (opts?.guildOwnerOrPlatformAdmin) return true;
    return this.config.get<string>('ALLOW_CLIENT_NSFW_OFF') === 'true';
  }
}
