import { Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { EntityManager, In } from 'typeorm';
import {
  DRACORD_BOT_USER_ID,
  SocketEvents,
  levelFromXp,
  type GuildLevelConfigDto,
  type LevelRoleReward,
  type LevelUpPayload,
  type MemberLevelDto,
} from '@dracord/types';
import { GuildPermissions } from '@/common/permissions';
import { Guild } from '@/database/entities/guild.entity';
import { GuildLevelConfig } from '@/database/entities/guild-level-config.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { GuildMemberRole } from '@/database/entities/guild-member-role.entity';
import { MemberLevel } from '@/database/entities/member-level.entity';
import { Role } from '@/database/entities/role.entity';
import { User } from '@/database/entities/user.entity';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';
import { GuildsService } from '@/guilds/guilds.service';
import { NotificationsRealtimeService } from '@/notifications/notifications-realtime.service';
import { NotificationsService } from '@/notifications/notifications.service';

/** Mesaj XP bekleme süresi (spam ile XP kasılmasın) */
const MESSAGE_COOLDOWN_SEC = 60;
/** Tek ses oturumunda en fazla sayılan dakika */
const VOICE_MAX_MINUTES = 240;

const DEFAULTS: Omit<GuildLevelConfigDto, 'guildId'> = {
  enabled: true,
  announce: 'notification',
  messageXpMin: 15,
  messageXpMax: 25,
  voiceXpPerMinute: 4,
  roleRewards: [],
  noXpChannelIds: [],
};

/**
 * Seviye / XP — mesaj (60 sn cooldown, rastgele 15–25) + ses dakikası.
 * Seviye atlayınca rol ödülleri verilir, kullanıcıya bildirim + guild'e `level:up` yayını.
 * XP kaydı asla mesaj gönderimini bozmamalı → tüm hatalar yutulur.
 */
@Injectable()
export class LevelsService {
  private readonly log = new Logger(LevelsService.name);
  /** guildId → config (30 sn önbellek) */
  private readonly cfgCache = new Map<string, { at: number; cfg: GuildLevelConfigDto }>();

  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly notifications: NotificationsService,
    private readonly notificationsRealtime: NotificationsRealtimeService,
    private readonly broadcast: SocketBroadcastService,
  ) {}

  // ── config ──────────────────────────────────────────────────────

  async getConfig(guildId: string): Promise<GuildLevelConfigDto> {
    const hit = this.cfgCache.get(guildId);
    if (hit && Date.now() - hit.at < 30_000) return hit.cfg;
    const row = await this.em.findOne(GuildLevelConfig, { where: { guildId } });
    const cfg: GuildLevelConfigDto = row
      ? {
          guildId,
          enabled: row.enabled,
          announce: row.announce === 'off' ? 'off' : 'notification',
          messageXpMin: row.messageXpMin,
          messageXpMax: row.messageXpMax,
          voiceXpPerMinute: row.voiceXpPerMinute,
          roleRewards: row.roleRewards ?? [],
          noXpChannelIds: row.noXpChannelIds ?? [],
        }
      : { guildId, ...DEFAULTS };
    this.cfgCache.set(guildId, { at: Date.now(), cfg });
    return cfg;
  }

  async updateConfig(
    guildId: string,
    actorId: string,
    patch: Partial<Omit<GuildLevelConfigDto, 'guildId'>>,
  ): Promise<GuildLevelConfigDto> {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_GUILD);
    const cur = await this.getConfig(guildId);
    const clampInt = (v: unknown, lo: number, hi: number, d: number) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
    };
    let rewards: LevelRoleReward[] = cur.roleRewards;
    if (Array.isArray(patch.roleRewards)) {
      const roleIds = patch.roleRewards.map((r) => String(r?.roleId ?? '')).filter(Boolean);
      const valid = roleIds.length
        ? new Set(
            (await this.em.find(Role, { where: { guildId, id: In(roleIds) } })).map((r) => r.id),
          )
        : new Set<string>();
      const seen = new Set<string>();
      rewards = patch.roleRewards
        .map((r) => ({ level: clampInt(r.level, 1, 500, 1), roleId: String(r.roleId) }))
        .filter((r) => valid.has(r.roleId) && !seen.has(`${r.level}:${r.roleId}`) && seen.add(`${r.level}:${r.roleId}`))
        .sort((a, b) => a.level - b.level)
        .slice(0, 50);
    }
    const min = clampInt(patch.messageXpMin ?? cur.messageXpMin, 0, 100, DEFAULTS.messageXpMin);
    const max = clampInt(patch.messageXpMax ?? cur.messageXpMax, min, 200, DEFAULTS.messageXpMax);
    const next: GuildLevelConfigDto = {
      guildId,
      enabled: patch.enabled ?? cur.enabled,
      announce: patch.announce === 'off' ? 'off' : patch.announce === 'notification' ? 'notification' : cur.announce,
      messageXpMin: min,
      messageXpMax: max,
      voiceXpPerMinute: clampInt(patch.voiceXpPerMinute ?? cur.voiceXpPerMinute, 0, 50, DEFAULTS.voiceXpPerMinute),
      roleRewards: rewards,
      noXpChannelIds: Array.isArray(patch.noXpChannelIds)
        ? [...new Set(patch.noXpChannelIds.map(String))].slice(0, 200)
        : cur.noXpChannelIds,
    };
    const row =
      (await this.em.findOne(GuildLevelConfig, { where: { guildId } })) ??
      this.em.create(GuildLevelConfig, { guildId });
    Object.assign(row, {
      enabled: next.enabled,
      announce: next.announce,
      messageXpMin: next.messageXpMin,
      messageXpMax: next.messageXpMax,
      voiceXpPerMinute: next.voiceXpPerMinute,
      roleRewards: next.roleRewards,
      noXpChannelIds: next.noXpChannelIds,
    });
    await this.em.save(GuildLevelConfig, row);
    this.cfgCache.set(guildId, { at: Date.now(), cfg: next });
    return next;
  }

  // ── XP kazanımı ────────────────────────────────────────────────

  /** Mesaj gönderildi (fire-and-forget) */
  async onMessage(guildId: string | null | undefined, channelId: string, userId: string): Promise<void> {
    if (!guildId || userId === DRACORD_BOT_USER_ID) return;
    try {
      const cfg = await this.getConfig(guildId);
      if (!cfg.enabled || cfg.messageXpMax <= 0) return;
      if (cfg.noXpChannelIds.includes(channelId)) return;
      const gain =
        cfg.messageXpMin + Math.floor(Math.random() * (cfg.messageXpMax - cfg.messageXpMin + 1));
      await this.ensureRow(guildId, userId);
      // Atomik: cooldown dolmadıysa satır güncellenmez (çoklu instance güvenli)
      const rows: Array<{ xp: number; level: number }> = await this.em.query(
        `UPDATE member_levels
            SET xp = xp + $3, "messageCount" = "messageCount" + 1,
                "lastMessageXpAt" = now(), "updatedAt" = now()
          WHERE "guildId" = $1 AND "userId" = $2
            AND ("lastMessageXpAt" IS NULL OR "lastMessageXpAt" < now() - make_interval(secs => $4))
        RETURNING xp, level`,
        [guildId, userId, gain, MESSAGE_COOLDOWN_SEC],
      );
      const r = Array.isArray(rows[0]) ? (rows[0] as unknown as Array<{ xp: number; level: number }>)[0] : rows[0];
      if (r) await this.checkLevelUp(guildId, userId, Number(r.xp), Number(r.level), cfg);
    } catch (e) {
      this.log.debug(`message xp skipped: ${e instanceof Error ? e.message : e}`);
    }
  }

  /** Ses oturumu bitti (VOICE_STATE leave) */
  async onVoiceSession(
    guildId: string,
    channelId: string,
    userId: string,
    joinedAtIso: string | null | undefined,
  ): Promise<void> {
    if (!joinedAtIso || userId === DRACORD_BOT_USER_ID) return;
    try {
      const minutes = Math.min(
        VOICE_MAX_MINUTES,
        Math.floor((Date.now() - new Date(joinedAtIso).getTime()) / 60_000),
      );
      if (!Number.isFinite(minutes) || minutes < 1) return;
      const cfg = await this.getConfig(guildId);
      if (!cfg.enabled || cfg.voiceXpPerMinute <= 0) return;
      if (cfg.noXpChannelIds.includes(channelId)) return;
      const guild = await this.em.findOne(Guild, { where: { id: guildId } });
      if (!guild || guild.afkChannelId === channelId) return;
      await this.ensureRow(guildId, userId);
      const rows: Array<{ xp: number; level: number }> = await this.em.query(
        `UPDATE member_levels
            SET xp = xp + $3, "voiceMinutes" = "voiceMinutes" + $4, "updatedAt" = now()
          WHERE "guildId" = $1 AND "userId" = $2
        RETURNING xp, level`,
        [guildId, userId, minutes * cfg.voiceXpPerMinute, minutes],
      );
      const r = Array.isArray(rows[0]) ? (rows[0] as unknown as Array<{ xp: number; level: number }>)[0] : rows[0];
      if (r) await this.checkLevelUp(guildId, userId, Number(r.xp), Number(r.level), cfg);
    } catch (e) {
      this.log.debug(`voice xp skipped: ${e instanceof Error ? e.message : e}`);
    }
  }

  private async ensureRow(guildId: string, userId: string) {
    await this.em.query(
      `INSERT INTO member_levels (id, "guildId", "userId", xp, level, "messageCount", "voiceMinutes", "updatedAt")
       VALUES ($1, $2, $3, 0, 0, 0, 0, now())
       ON CONFLICT ("guildId", "userId") DO NOTHING`,
      [createId(), guildId, userId],
    );
  }

  private async checkLevelUp(
    guildId: string,
    userId: string,
    xp: number,
    storedLevel: number,
    cfg: GuildLevelConfigDto,
  ) {
    const { level } = levelFromXp(xp);
    if (level <= storedLevel) return;
    // Yarış: yalnız seviyeyi ilk yükselten istek ödülleri dağıtır
    const upd: unknown = await this.em.query(
      `UPDATE member_levels SET level = $3 WHERE "guildId" = $1 AND "userId" = $2 AND level < $3 RETURNING level`,
      [guildId, userId, level],
    );
    const changed = Array.isArray(upd) && (Array.isArray(upd[0]) ? upd[0].length : upd.length) > 0;
    if (!changed) return;

    const granted = await this.grantRewards(guildId, userId, level, cfg.roleRewards);
    const payload: LevelUpPayload = { guildId, userId, level, grantedRoleIds: granted };
    this.broadcast.emitToGuild(guildId, SocketEvents.LEVEL_UP, payload);
    if (cfg.announce === 'notification') {
      const guild = await this.em.findOne(Guild, { where: { id: guildId } });
      const created = await this.notifications.createMany([
        {
          userId,
          type: 'SYSTEM',
          title: `Seviye ${level}! 🎉`,
          body: `${guild?.name ?? 'Sunucu'} sunucusunda seviye ${level} oldun${granted.length ? ` · ${granted.length} yeni rol` : ''}.`,
          link: `/channels/${guildId}`,
          guildId,
        },
      ]);
      this.notificationsRealtime.emitMany(created);
    }
  }

  /** level ≤ seviye olan tüm ödül rollerini ver (zaten varsa atla) */
  private async grantRewards(
    guildId: string,
    userId: string,
    level: number,
    rewards: LevelRoleReward[],
  ): Promise<string[]> {
    const due = rewards.filter((r) => r.level <= level).map((r) => r.roleId);
    if (!due.length) return [];
    const member = await this.em.findOne(GuildMember, { where: { guildId, userId } });
    if (!member) return [];
    const roles = await this.em.find(Role, { where: { guildId, id: In(due) } });
    const have = new Set(
      (await this.em.find(GuildMemberRole, { where: { guildMemberId: member.id } })).map((r) => r.roleId),
    );
    const add = roles.filter((r) => !have.has(r.id));
    if (add.length) {
      await this.em.save(
        GuildMemberRole,
        add.map((r) => this.em.create(GuildMemberRole, { guildMemberId: member.id, roleId: r.id })),
      );
    }
    return add.map((r) => r.id);
  }

  // ── okuma ──────────────────────────────────────────────────────

  private toDto(row: MemberLevel, user?: User | null, rank?: number | null): MemberLevelDto {
    const p = levelFromXp(row.xp);
    return {
      guildId: row.guildId,
      userId: row.userId,
      displayName: user?.displayName ?? null,
      username: user?.username ?? null,
      avatarUrl: user?.avatarUrl ?? null,
      xp: row.xp,
      level: p.level,
      xpIntoLevel: p.xpIntoLevel,
      xpForNext: p.xpForNext,
      messageCount: row.messageCount,
      voiceMinutes: row.voiceMinutes,
      rank: rank ?? null,
    };
  }

  async getMember(guildId: string, viewerId: string, targetUserId: string): Promise<MemberLevelDto> {
    await this.guilds.ensureMember(guildId, viewerId);
    const row =
      (await this.em.findOne(MemberLevel, { where: { guildId, userId: targetUserId } })) ??
      this.em.create(MemberLevel, {
        guildId,
        userId: targetUserId,
        xp: 0,
        level: 0,
        messageCount: 0,
        voiceMinutes: 0,
      });
    const higher = row.xp > 0
      ? await this.em
          .createQueryBuilder(MemberLevel, 'l')
          .where('l.guildId = :g AND l.xp > :xp', { g: guildId, xp: row.xp })
          .getCount()
      : null;
    const user = await this.em.findOne(User, { where: { id: targetUserId } });
    return this.toDto(row, user, higher === null ? null : higher + 1);
  }

  async leaderboard(guildId: string, viewerId: string, limit = 50, offset = 0): Promise<MemberLevelDto[]> {
    await this.guilds.ensureMember(guildId, viewerId);
    const take = Math.min(Math.max(Math.floor(limit) || 50, 1), 100);
    const skip = Math.max(Math.floor(offset) || 0, 0);
    const rows = await this.em.find(MemberLevel, {
      where: { guildId },
      order: { xp: 'DESC', updatedAt: 'ASC' },
      take,
      skip,
    });
    if (!rows.length) return [];
    const users = await this.em.find(User, { where: { id: In(rows.map((r) => r.userId)) } });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows
      .filter((r) => r.xp > 0)
      .map((r, i) => this.toDto(r, byId.get(r.userId), skip + i + 1));
  }

  /** Mevcut ödülleri geriye dönük uygula (ayar değişince) */
  async resyncRewards(guildId: string, actorId: string): Promise<{ updated: number }> {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_GUILD);
    const cfg = await this.getConfig(guildId);
    if (!cfg.roleRewards.length) return { updated: 0 };
    const minLevel = Math.min(...cfg.roleRewards.map((r) => r.level));
    const rows = await this.em
      .createQueryBuilder(MemberLevel, 'l')
      .where('l.guildId = :g AND l.level >= :lv', { g: guildId, lv: minLevel })
      .take(5000)
      .getMany();
    let updated = 0;
    for (const r of rows) {
      const g = await this.grantRewards(guildId, r.userId, r.level, cfg.roleRewards);
      if (g.length) updated += 1;
    }
    return { updated };
  }
}
