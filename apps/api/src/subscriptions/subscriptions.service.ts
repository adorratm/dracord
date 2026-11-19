import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { EntityManager, In, IsNull, LessThan, Not } from 'typeorm';
import {
  SUBSCRIPTION_LIMITS,
  type GuildSubscriptionCodeDto,
  type GuildSubscriptionDto,
  type GuildSubscriptionTierDto,
  type GuildSubscriptionsOverview,
} from '@dracord/types';
import { GuildPermissions } from '@/common/permissions';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { GuildMemberRole } from '@/database/entities/guild-member-role.entity';
import {
  GuildSubscription,
  GuildSubscriptionCode,
  GuildSubscriptionTier,
} from '@/database/entities/guild-subscription.entity';
import { User } from '@/database/entities/user.entity';
import { GuildsService } from '@/guilds/guilds.service';
import { NotificationsRealtimeService } from '@/notifications/notifications-realtime.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { OnboardingService } from '@/onboarding/onboarding.service';

const SWEEP_MS = 10 * 60_000;
const DAY_MS = 86_400_000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type TierInput = {
  name?: unknown;
  perks?: unknown;
  priceText?: unknown;
  roleId?: unknown;
  paymentUrl?: unknown;
  color?: unknown;
  position?: unknown;
};

const str = (v: unknown, max: number) => String(v ?? '').replace(/\s+$/g, '').trim().slice(0, max);

/** Ödeme bağlantısı: yalnız https; kullanıcı adı/parola gömülü olamaz */
export function cleanPaymentUrl(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s.length > 500) throw new BadRequestException('Ödeme bağlantısı çok uzun');
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new BadRequestException('Ödeme bağlantısı geçerli bir adres değil');
  }
  if (u.protocol !== 'https:') throw new BadRequestException('Ödeme bağlantısı https:// ile başlamalı');
  if (u.username || u.password) throw new BadRequestException('Bağlantıda kullanıcı adı/parola olamaz');
  return u.toString();
}

export function newSubscriptionCode(): string {
  const b = randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) out += CODE_ALPHABET[b[i]! % CODE_ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
}

/**
 * F2 — sunucu abonelikleri. Dracord para tahsil etmez: sahip kademe + avantaj + kendi ödeme bağlantısını
 * tanımlar; üyeliği elle ya da tek/çok kullanımlık kodla verir. Kademe rolü otomatik verilir, süre dolunca alınır.
 */
@Injectable()
export class SubscriptionsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SubscriptionsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly onboarding: OnboardingService,
    private readonly notifications: NotificationsService,
    private readonly notificationsRealtime: NotificationsRealtimeService,
  ) {}

  onModuleInit(): void {
    if (process.env.COMMUNITY_JOBS_DISABLED === '1') return;
    this.timer = setInterval(() => void this.sweepExpired().catch(() => undefined), SWEEP_MS);
    this.timer.unref?.();
    // açılışta da bir kez (yeniden başlatmalarda gecikmesin)
    setTimeout(() => void this.sweepExpired().catch(() => undefined), 15_000).unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private canManage(guildId: string, userId: string): Promise<boolean> {
    return this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_GUILD).then(
      () => true,
      () => false,
    );
  }

  private tierDto(t: GuildSubscriptionTier, count?: number): GuildSubscriptionTierDto {
    return {
      id: t.id,
      guildId: t.guildId,
      name: t.name,
      perks: t.perks,
      priceText: t.priceText,
      roleId: t.roleId,
      paymentUrl: t.paymentUrl,
      color: t.color,
      position: t.position,
      ...(count !== undefined ? { subscriberCount: count } : {}),
    };
  }

  private subDto(s: GuildSubscription, u?: Pick<User, 'displayName' | 'username' | 'avatarUrl'> | null): GuildSubscriptionDto {
    return {
      id: s.id,
      guildId: s.guildId,
      tierId: s.tierId,
      userId: s.userId,
      ...(u ? { displayName: u.displayName || u.username, avatarUrl: u.avatarUrl ?? null } : {}),
      source: s.source,
      grantedById: s.grantedById,
      expiresAt: s.expiresAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    };
  }

  private activeWhere(guildId: string) {
    return [
      { guildId, expiresAt: IsNull() },
      { guildId, expiresAt: Not(LessThan(new Date())) },
    ];
  }

  async overview(guildId: string, userId: string): Promise<GuildSubscriptionsOverview> {
    await this.guilds.ensureMember(guildId, userId);
    const [tiers, mine, canManage] = await Promise.all([
      this.em.find(GuildSubscriptionTier, { where: { guildId }, order: { position: 'ASC', createdAt: 'ASC' } }),
      this.em.find(GuildSubscription, { where: this.activeWhere(guildId).map((w) => ({ ...w, userId })) }),
      this.canManage(guildId, userId),
    ]);
    let counts = new Map<string, number>();
    if (canManage && tiers.length) {
      const rows: Array<{ tierId: string; n: string }> = await this.em.query(
        `SELECT "tierId", count(*) AS n FROM guild_subscriptions
          WHERE "guildId" = $1 AND ("expiresAt" IS NULL OR "expiresAt" >= now()) GROUP BY "tierId"`,
        [guildId],
      );
      counts = new Map(rows.map((r) => [r.tierId, Number(r.n)]));
    }
    return {
      tiers: tiers.map((t) => this.tierDto(t, canManage ? (counts.get(t.id) ?? 0) : undefined)),
      mine: mine.map((s) => this.subDto(s)),
      canManage,
    };
  }

  private async cleanTier(guildId: string, input: TierInput, existing?: GuildSubscriptionTier) {
    const name = str(input.name ?? existing?.name, SUBSCRIPTION_LIMITS.nameMax);
    if (!name) throw new BadRequestException('Kademe adı gerekli');
    let roleId: string | null = existing?.roleId ?? null;
    if (input.roleId !== undefined) {
      roleId = input.roleId ? String(input.roleId) : null;
      // Yönetim izni taşıyan rol abonelikle verilemez
      if (roleId) await this.onboarding.assertSelfAssignable(guildId, [roleId]);
    }
    const color = input.color === undefined ? (existing?.color ?? null) : /^#[0-9a-fA-F]{6}$/.test(String(input.color)) ? String(input.color) : null;
    return {
      name,
      perks: input.perks === undefined ? (existing?.perks ?? '') : str(input.perks, SUBSCRIPTION_LIMITS.perksMax),
      priceText: input.priceText === undefined ? (existing?.priceText ?? '') : str(input.priceText, SUBSCRIPTION_LIMITS.priceMax),
      roleId,
      paymentUrl: input.paymentUrl === undefined ? (existing?.paymentUrl ?? null) : cleanPaymentUrl(input.paymentUrl),
      color,
      position: input.position === undefined ? (existing?.position ?? 0) : Math.max(0, Math.min(99, Math.floor(Number(input.position) || 0))),
    };
  }

  async createTier(guildId: string, userId: string, input: TierInput): Promise<GuildSubscriptionTierDto> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_GUILD);
    const n = await this.em.count(GuildSubscriptionTier, { where: { guildId } });
    if (n >= SUBSCRIPTION_LIMITS.tiersPerGuild) throw new BadRequestException(`En fazla ${SUBSCRIPTION_LIMITS.tiersPerGuild} kademe`);
    const data = await this.cleanTier(guildId, input);
    const t = await this.em.save(GuildSubscriptionTier, this.em.create(GuildSubscriptionTier, { guildId, ...data, position: input.position === undefined ? n : data.position }));
    return this.tierDto(t, 0);
  }

  private async tierOf(guildId: string, tierId: string) {
    const t = await this.em.findOne(GuildSubscriptionTier, { where: { id: tierId, guildId } });
    if (!t) throw new NotFoundException('Kademe bulunamadı');
    return t;
  }

  async updateTier(guildId: string, tierId: string, userId: string, input: TierInput): Promise<GuildSubscriptionTierDto> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_GUILD);
    const t = await this.tierOf(guildId, tierId);
    const data = await this.cleanTier(guildId, input, t);
    const oldRole = t.roleId;
    Object.assign(t, data);
    await this.em.save(GuildSubscriptionTier, t);
    if (oldRole !== t.roleId) {
      const subs = await this.em.find(GuildSubscription, { where: this.activeWhere(guildId).map((w) => ({ ...w, tierId })) });
      const users = subs.map((s) => s.userId);
      if (oldRole) await this.dropRole(guildId, users, oldRole, tierId);
      if (t.roleId) await this.giveRole(guildId, users, t.roleId);
    }
    return this.tierDto(t);
  }

  async deleteTier(guildId: string, tierId: string, userId: string): Promise<{ ok: true }> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_GUILD);
    const t = await this.tierOf(guildId, tierId);
    const subs = await this.em.find(GuildSubscription, { where: { guildId, tierId } });
    if (t.roleId) await this.dropRole(guildId, subs.map((s) => s.userId), t.roleId, tierId);
    await this.em.delete(GuildSubscription, { guildId, tierId });
    await this.em.delete(GuildSubscriptionCode, { guildId, tierId });
    await this.em.delete(GuildSubscriptionTier, { id: tierId });
    return { ok: true };
  }

  private async giveRole(guildId: string, userIds: string[], roleId: string) {
    if (!userIds.length) return;
    try {
      await this.onboarding.assertSelfAssignable(guildId, [roleId]);
    } catch {
      return; // rol artık güvenli değil → verme
    }
    const members = await this.em.find(GuildMember, { where: { guildId, userId: In(userIds) }, select: { id: true } });
    if (!members.length) return;
    await this.em
      .createQueryBuilder()
      .insert()
      .into(GuildMemberRole)
      .values(members.map((m) => ({ guildMemberId: m.id, roleId })))
      .orIgnore()
      .execute();
  }

  /** Rolü al — aynı rolü veren başka aktif kademesi varsa bırak */
  private async dropRole(guildId: string, userIds: string[], roleId: string, exceptTierId: string) {
    if (!userIds.length) return;
    const otherTiers = await this.em.find(GuildSubscriptionTier, { where: { guildId, roleId, id: Not(exceptTierId) }, select: { id: true } });
    let keep = new Set<string>();
    if (otherTiers.length) {
      const still = await this.em.find(GuildSubscription, {
        where: this.activeWhere(guildId).map((w) => ({ ...w, tierId: In(otherTiers.map((t) => t.id)), userId: In(userIds) })),
        select: { userId: true },
      });
      keep = new Set(still.map((s) => s.userId));
    }
    const drop = userIds.filter((u) => !keep.has(u));
    if (!drop.length) return;
    const members = await this.em.find(GuildMember, { where: { guildId, userId: In(drop) }, select: { id: true } });
    if (members.length) await this.em.delete(GuildMemberRole, { roleId, guildMemberId: In(members.map((m) => m.id)) });
  }

  /** Abonelik ver / uzat. days null → süresiz. Var olan abonelik uzatılır. */
  private async grantInternal(
    guildId: string,
    tier: GuildSubscriptionTier,
    targetId: string,
    days: number | null,
    source: 'manual' | 'code',
    grantedById: string,
  ): Promise<GuildSubscription> {
    const member = await this.em.findOne(GuildMember, { where: { guildId, userId: targetId }, select: { id: true } });
    if (!member) throw new NotFoundException('Üye bu sunucuda değil');
    const now = Date.now();
    let s = await this.em.findOne(GuildSubscription, { where: { guildId, tierId: tier.id, userId: targetId } });
    const base = s?.expiresAt && s.expiresAt.getTime() > now ? s.expiresAt.getTime() : now;
    const wasUnlimited = Boolean(s && !s.expiresAt);
    const expiresAt = days === null || wasUnlimited ? null : new Date(base + days * DAY_MS);
    if (s) {
      s.expiresAt = expiresAt;
      s.source = source;
      s.grantedById = grantedById;
    } else {
      s = this.em.create(GuildSubscription, { guildId, tierId: tier.id, userId: targetId, source, grantedById, expiresAt });
    }
    await this.em.save(GuildSubscription, s);
    if (tier.roleId) await this.giveRole(guildId, [targetId], tier.roleId);
    return s;
  }

  private cleanDays(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === '' || raw === 0) return null;
    const d = Math.floor(Number(raw));
    if (!Number.isFinite(d) || d < 1 || d > SUBSCRIPTION_LIMITS.maxDays) throw new BadRequestException(`Süre 1–${SUBSCRIPTION_LIMITS.maxDays} gün ya da süresiz olmalı`);
    return d;
  }

  private async notify(userId: string, guildId: string, title: string, body: string) {
    try {
      const created = await this.notifications.createMany([{ userId, type: 'SYSTEM', title, body, link: `/channels/${guildId}`, guildId }]);
      this.notificationsRealtime.emitMany(created);
    } catch {
      /* kritik değil */
    }
  }

  async grant(guildId: string, actorId: string, body: { userId?: unknown; tierId?: unknown; days?: unknown }): Promise<GuildSubscriptionDto> {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_GUILD);
    const tier = await this.tierOf(guildId, String(body.tierId ?? ''));
    const days = this.cleanDays(body.days);
    const s = await this.grantInternal(guildId, tier, String(body.userId ?? ''), days, 'manual', actorId);
    void this.notify(s.userId, guildId, `⭐ ${tier.name} üyeliğin açıldı`, s.expiresAt ? `${s.expiresAt.toLocaleDateString('tr-TR')} tarihine kadar geçerli.` : 'Süresiz.');
    return this.subDto(s);
  }

  async revoke(guildId: string, actorId: string, subId: string): Promise<{ ok: true }> {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_GUILD);
    const s = await this.em.findOne(GuildSubscription, { where: { id: subId, guildId } });
    if (!s) throw new NotFoundException('Abonelik bulunamadı');
    await this.end([s]);
    return { ok: true };
  }

  private async end(subs: GuildSubscription[]) {
    for (const s of subs) {
      await this.em.delete(GuildSubscription, { id: s.id });
      const tier = await this.em.findOne(GuildSubscriptionTier, { where: { id: s.tierId } });
      if (tier?.roleId) await this.dropRole(s.guildId, [s.userId], tier.roleId, tier.id);
    }
  }

  async listSubscribers(guildId: string, actorId: string): Promise<GuildSubscriptionDto[]> {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_GUILD);
    const subs = await this.em.find(GuildSubscription, { where: this.activeWhere(guildId), order: { createdAt: 'DESC' }, take: 500 });
    const users = subs.length
      ? await this.em.find(User, { where: { id: In([...new Set(subs.map((s) => s.userId))]) }, select: { id: true, displayName: true, username: true, avatarUrl: true } })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return subs.map((s) => this.subDto(s, byId.get(s.userId) ?? null));
  }

  async createCodes(
    guildId: string,
    actorId: string,
    body: { tierId?: unknown; days?: unknown; count?: unknown; maxUses?: unknown },
  ): Promise<GuildSubscriptionCodeDto[]> {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_GUILD);
    const tier = await this.tierOf(guildId, String(body.tierId ?? ''));
    const days = this.cleanDays(body.days);
    const count = Math.max(1, Math.min(SUBSCRIPTION_LIMITS.codesPerBatch, Math.floor(Number(body.count) || 1)));
    const maxUses = Math.max(1, Math.min(1000, Math.floor(Number(body.maxUses) || 1)));
    const total = await this.em.count(GuildSubscriptionCode, { where: { guildId } });
    if (total + count > 500) throw new BadRequestException('Sunucu başına en fazla 500 kod');
    const rows = Array.from({ length: count }, () =>
      this.em.create(GuildSubscriptionCode, { guildId, tierId: tier.id, code: newSubscriptionCode(), days, maxUses, uses: 0, createdById: actorId }),
    );
    await this.em.save(GuildSubscriptionCode, rows);
    return rows.map((c) => this.codeDto(c));
  }

  private codeDto(c: GuildSubscriptionCode): GuildSubscriptionCodeDto {
    return { id: c.id, tierId: c.tierId, code: c.code, days: c.days, maxUses: c.maxUses, uses: c.uses, createdAt: c.createdAt.toISOString() };
  }

  async listCodes(guildId: string, actorId: string): Promise<GuildSubscriptionCodeDto[]> {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_GUILD);
    const rows = await this.em.find(GuildSubscriptionCode, { where: { guildId }, order: { createdAt: 'DESC' }, take: 500 });
    return rows.map((c) => this.codeDto(c));
  }

  async deleteCode(guildId: string, actorId: string, codeId: string): Promise<{ ok: true }> {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_GUILD);
    await this.em.delete(GuildSubscriptionCode, { id: codeId, guildId });
    return { ok: true };
  }

  async redeem(guildId: string, userId: string, rawCode: unknown): Promise<GuildSubscriptionDto> {
    await this.guilds.ensureMember(guildId, userId);
    const norm = String(rawCode ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (norm.length !== 12) throw new BadRequestException('Kod geçersiz');
    const code = `${norm.slice(0, 4)}-${norm.slice(4, 8)}-${norm.slice(8)}`;
    // Kullanımı atomik say (yarış: aynı kod iki kez harcanamaz)
    const res: unknown = await this.em.query(
      `UPDATE guild_subscription_codes SET uses = uses + 1
        WHERE code = $1 AND "guildId" = $2 AND uses < "maxUses" RETURNING id`,
      [code, guildId],
    );
    // pg sürücüsü UPDATE … RETURNING için [satırlar, sayı] döndürür
    const rows = (Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res) as Array<{ id: string }>;
    const id = rows[0]?.id;
    if (!id) throw new BadRequestException('Kod geçersiz ya da kullanılmış');
    const c = await this.em.findOneOrFail(GuildSubscriptionCode, { where: { id } });
    const tier = await this.tierOf(guildId, c.tierId);
    try {
      const s = await this.grantInternal(guildId, tier, userId, c.days, 'code', c.createdById);
      return this.subDto(s);
    } catch (e) {
      await this.em.query(`UPDATE guild_subscription_codes SET uses = GREATEST(uses - 1, 0) WHERE id = $1`, [id]);
      throw e;
    }
  }

  /** Süresi dolan abonelikleri kapat, rolleri al, haber ver */
  async sweepExpired(now = new Date()): Promise<number> {
    const due = await this.em.find(GuildSubscription, { where: { expiresAt: LessThan(now) }, take: 200 });
    if (!due.length) return 0;
    const tiers = await this.em.find(GuildSubscriptionTier, { where: { id: In([...new Set(due.map((d) => d.tierId))]) } });
    const tierName = new Map(tiers.map((t) => [t.id, t.name]));
    await this.end(due);
    for (const s of due) void this.notify(s.userId, s.guildId, `${tierName.get(s.tierId) ?? 'Abonelik'} süresi doldu`, 'Yenilemek için sunucunun abonelik sayfasına bak.');
    this.log.log(`süresi dolan abonelik: ${due.length}`);
    return due.length;
  }
}
