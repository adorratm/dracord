import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { EntityManager, In } from 'typeorm';
import {
  AUTOMOD_DEFAULTS,
  AUTOMOD_LIMITS,
  AUTOMOD_REASON_TR,
  DRACORD_BOT_USER_ID,
  automodCheckContent,
  isSafeAutomodRegex,
  type AutomodEventDto,
  type AutomodReason,
  type GuildAutomodConfigDto,
} from '@dracord/types';
import { GuildPermissions } from '@/common/permissions';
import { Guild } from '@/database/entities/guild.entity';
import { GuildAutomodConfig, GuildAutomodEvent } from '@/database/entities/guild-automod.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { GuildMemberRole } from '@/database/entities/guild-member-role.entity';
import { User } from '@/database/entities/user.entity';
import { GuildsService } from '@/guilds/guilds.service';

const clampInt = (v: unknown, min: number, max: number, d: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

/**
 * Sunucu bazlı otomatik moderasyon (D2): yönetici kuralları + spam sezgileri.
 * Model yok; durum (hız/tekrar) süreç belleğinde tutulur (tek API örneği varsayımı;
 * çok örnekte her örnek kendi penceresini sayar — en kötü durumda gevşek sınır).
 */
@Injectable()
export class AutomodRulesService {
  private readonly log = new Logger(AutomodRulesService.name);
  private readonly cache = new Map<string, { at: number; cfg: GuildAutomodConfigDto }>();
  /** guild:user → son mesaj zamanları + içerikleri */
  private readonly recent = new Map<string, Array<{ t: number; h: string }>>();
  private readonly violations = new Map<string, number[]>();

  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
  ) {}

  async getConfig(guildId: string): Promise<GuildAutomodConfigDto> {
    const hit = this.cache.get(guildId);
    if (hit && Date.now() - hit.at < 60_000) return hit.cfg;
    const row = await this.em.findOne(GuildAutomodConfig, { where: { guildId } });
    const cfg = this.sanitize(guildId, row?.config ?? {});
    this.cache.set(guildId, { at: Date.now(), cfg });
    if (this.cache.size > 5000) this.cache.clear();
    return cfg;
  }

  private sanitize(guildId: string, raw: Partial<Omit<GuildAutomodConfigDto, 'guildId'>>, strict = false): GuildAutomodConfigDto {
    const d = AUTOMOD_DEFAULTS;
    const rules = (Array.isArray(raw.rules) ? raw.rules : []).slice(0, AUTOMOD_LIMITS.rules).flatMap((r) => {
      const kind = r?.kind === 'regex' ? 'regex' : 'word';
      const pattern = String(r?.pattern ?? '').trim().slice(0, AUTOMOD_LIMITS.patternMax);
      if (!pattern) return [];
      if (kind === 'regex' && !isSafeAutomodRegex(pattern)) {
        if (strict) throw new BadRequestException(`Güvensiz ya da geçersiz düzenli ifade: ${pattern}`);
        return [];
      }
      return [{ id: typeof r?.id === 'string' && r.id.length <= 32 ? r.id : createId(), kind, pattern } as const];
    });
    const sp = (raw.spam ?? {}) as Partial<GuildAutomodConfigDto['spam']>;
    const to = (raw.timeout ?? {}) as Partial<GuildAutomodConfigDto['timeout']>;
    const ids = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map(String).filter((x) => x.length <= 64))].slice(0, AUTOMOD_LIMITS.exempt);
    return {
      guildId,
      enabled: raw.enabled === true,
      rules,
      spam: {
        enabled: sp.enabled !== false,
        maxPerTenSeconds: clampInt(sp.maxPerTenSeconds, 0, 60, d.spam.maxPerTenSeconds),
        maxDuplicates: clampInt(sp.maxDuplicates, 0, 20, d.spam.maxDuplicates),
        maxMentions: clampInt(sp.maxMentions, 0, 50, d.spam.maxMentions),
        maxLinks: clampInt(sp.maxLinks, 0, 50, d.spam.maxLinks),
        capsRatio: Math.min(1, Math.max(0.5, Number(sp.capsRatio) || d.spam.capsRatio)),
        blockInvites: sp.blockInvites === true,
        blockZalgo: sp.blockZalgo !== false,
      },
      timeout: {
        enabled: to.enabled === true,
        violations: clampInt(to.violations, 1, 20, d.timeout.violations),
        windowMinutes: clampInt(to.windowMinutes, 1, 120, d.timeout.windowMinutes),
        minutes: clampInt(to.minutes, 1, 60 * 24 * 7, d.timeout.minutes),
      },
      exemptRoleIds: ids(raw.exemptRoleIds),
      exemptChannelIds: ids(raw.exemptChannelIds),
    };
  }

  async updateConfig(guildId: string, actorId: string, patch: Partial<Omit<GuildAutomodConfigDto, 'guildId'>>) {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_GUILD);
    const cur = await this.getConfig(guildId);
    const next = this.sanitize(
      guildId,
      {
        ...cur,
        ...patch,
        spam: { ...cur.spam, ...(patch.spam ?? {}) },
        timeout: { ...cur.timeout, ...(patch.timeout ?? {}) },
      },
      true,
    );
    const { guildId: _g, ...config } = next;
    const row = (await this.em.findOne(GuildAutomodConfig, { where: { guildId } })) ?? this.em.create(GuildAutomodConfig, { guildId });
    row.config = config;
    await this.em.save(GuildAutomodConfig, row);
    this.cache.set(guildId, { at: Date.now(), cfg: next });
    return next;
  }

  async listEvents(guildId: string, actorId: string, limit = 100): Promise<AutomodEventDto[]> {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_GUILD);
    const rows = await this.em.find(GuildAutomodEvent, { where: { guildId }, order: { createdAt: 'DESC' }, take: Math.min(200, limit) });
    const users = rows.length
      ? await this.em.find(User, { where: { id: In([...new Set(rows.map((r) => r.userId))]) }, select: { id: true, displayName: true, username: true } })
      : [];
    const names = new Map(users.map((u) => [u.id, u.displayName || u.username]));
    return rows.map((r) => ({
      id: r.id,
      guildId: r.guildId,
      userId: r.userId,
      userName: names.get(r.userId) ?? 'Üye',
      channelId: r.channelId,
      reason: r.reason,
      detail: r.detail,
      preview: r.preview,
      action: r.action,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async isExempt(guildId: string, userId: string, channelId: string | null, cfg: GuildAutomodConfigDto) {
    if (channelId && cfg.exemptChannelIds.includes(channelId)) return true;
    if (await this.guilds.memberHasPermission(guildId, userId, GuildPermissions.MANAGE_MESSAGES)) return true;
    if (!cfg.exemptRoleIds.length) return false;
    const member = await this.em.findOne(GuildMember, { where: { guildId, userId }, select: { id: true } });
    if (!member) return false;
    const n = await this.em.count(GuildMemberRole, { where: { guildMemberId: member.id, roleId: In(cfg.exemptRoleIds) } });
    return n > 0;
  }

  /** Durumlu kontroller: hız + tekrar. Mesaj kabul edilecekse kaydeder. */
  private checkRate(key: string, content: string, cfg: GuildAutomodConfigDto): AutomodReason | null {
    const t = Date.now();
    const h = content.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 300);
    const list = (this.recent.get(key) ?? []).filter((x) => t - x.t < 30_000);
    const sp = cfg.spam;
    if (sp.enabled) {
      if (sp.maxPerTenSeconds > 0 && list.filter((x) => t - x.t < 10_000).length >= sp.maxPerTenSeconds) return 'rate';
      if (sp.maxDuplicates > 0 && h.length >= 2 && list.filter((x) => x.h === h).length >= sp.maxDuplicates) return 'duplicate';
    }
    list.push({ t, h });
    this.recent.set(key, list.slice(-40));
    if (this.recent.size > 20_000) this.recent.clear();
    return null;
  }

  /**
   * Mesaj gönderilmeden önce. İhlalde BadRequestException (kullanıcıya nedeni söyler).
   * Kapalıysa / muafsa hiçbir şey yapmaz.
   */
  async assertAllowed(guildId: string, channelId: string | null, userId: string, content: string): Promise<void> {
    if (userId === DRACORD_BOT_USER_ID) return;
    const cfg = await this.getConfig(guildId);
    if (!cfg.enabled || !content.trim()) return;
    const u = await this.em.findOne(User, { where: { id: userId }, select: { id: true, isBot: true } });
    if (u?.isBot) return;
    if (await this.isExempt(guildId, userId, channelId, cfg)) return;
    const guild = await this.em.findOne(Guild, { where: { id: guildId }, select: { id: true, vanityCode: true } });
    const own = guild?.vanityCode ? `dracord.com.tr/s/${guild.vanityCode}` : null;
    const hit = automodCheckContent(content, cfg, { ownInvitePrefix: own });
    const reason: AutomodReason | null = hit?.reason ?? this.checkRate(`${guildId}:${userId}`, content, cfg);
    if (!reason) return;
    const action = await this.recordViolation(guildId, userId, channelId, reason, hit?.detail ?? null, content, cfg);
    throw new BadRequestException(
      action === 'timeout'
        ? `Otomatik moderasyon: ${AUTOMOD_REASON_TR[reason]}. Tekrarlanan ihlal nedeniyle ${cfg.timeout.minutes} dk susturuldun.`
        : `Otomatik moderasyon: ${AUTOMOD_REASON_TR[reason]} — mesaj gönderilmedi.`,
    );
  }

  private async recordViolation(
    guildId: string,
    userId: string,
    channelId: string | null,
    reason: AutomodReason,
    detail: string | null,
    content: string,
    cfg: GuildAutomodConfigDto,
  ): Promise<'blocked' | 'timeout'> {
    let action: 'blocked' | 'timeout' = 'blocked';
    if (cfg.timeout.enabled) {
      const key = `${guildId}:${userId}`;
      const t = Date.now();
      const win = cfg.timeout.windowMinutes * 60_000;
      const list = (this.violations.get(key) ?? []).filter((x) => t - x < win);
      list.push(t);
      this.violations.set(key, list);
      if (this.violations.size > 20_000) this.violations.clear();
      if (list.length >= cfg.timeout.violations) {
        const g = await this.em.findOne(Guild, { where: { id: guildId }, select: { id: true, ownerId: true } });
        if (g && g.ownerId !== userId) {
          await this.em.update(GuildMember, { guildId, userId }, { timeoutUntil: new Date(t + cfg.timeout.minutes * 60_000) });
          this.violations.delete(key);
          action = 'timeout';
        }
      }
    }
    try {
      await this.em.insert(GuildAutomodEvent, {
        id: createId(),
        guildId,
        userId,
        channelId,
        reason,
        detail: detail ? detail.slice(0, 200) : null,
        preview: content.replace(/\s+/g, ' ').slice(0, 160),
        action,
      });
      // Eski kayıtları buda (sunucu başına son N)
      if (Math.random() < 0.05) {
        await this.em.query(
          `DELETE FROM guild_automod_events WHERE "guildId" = $1 AND id NOT IN (
             SELECT id FROM guild_automod_events WHERE "guildId" = $1 ORDER BY "createdAt" DESC LIMIT ${AUTOMOD_LIMITS.eventsKept})`,
          [guildId],
        );
      }
    } catch (e) {
      this.log.debug(`automod log failed: ${e instanceof Error ? e.message : e}`);
    }
    return action;
  }
}
