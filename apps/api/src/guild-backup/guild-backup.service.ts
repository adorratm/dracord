import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import type { GuildBackupRestoreResult, GuildBackupV1 } from '@dracord/types';
import { Category } from '@/database/entities/category.entity';
import { Channel } from '@/database/entities/channel.entity';
import { Guild } from '@/database/entities/guild.entity';
import { Role } from '@/database/entities/role.entity';
import { RolePermission } from '@/database/entities/role-permission.entity';
import { ChannelsService } from '@/channels/channels.service';
import { GuildsService } from '@/guilds/guilds.service';
import { RolesService } from '@/roles/roles.service';

const EVERYONE = '@everyone';
const CREATABLE = new Set(['TEXT', 'VOICE', 'FORUM', 'GAME', 'WATCH_PARTY']);
const LIMITS = { roles: 200, categories: 50, channels: 400 };

const str = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const strs = (v: unknown, max = 80) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, max).map((x) => x.slice(0, 64)) : []);
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * Sunucu yedeği ve şablonu: kanallar, kategoriler, roller (izinleriyle) ve rol bazlı kanal
 * izinleri tek JSON dosyasında. Mesajlar, üyeler ve üye bazlı izinler yedeğe girmez.
 * Geri yükleme yalnız EKLER (aynı adlı olanı atlar) — hiçbir şey silinmez.
 */
@Injectable()
export class GuildBackupService {
  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly channels: ChannelsService,
    private readonly roles: RolesService,
  ) {}

  async export(guildId: string, userId: string): Promise<GuildBackupV1> {
    await this.guilds.requirePermission(guildId, userId, 'MANAGE_GUILD');
    const guild = await this.em.findOneOrFail(Guild, { where: { id: guildId } });
    const [roles, cats, chans] = await Promise.all([
      this.em.find(Role, { where: { guildId }, order: { position: 'ASC' } }),
      this.em.find(Category, { where: { guildId }, order: { position: 'ASC' } }),
      this.em.find(Channel, { where: { guildId }, order: { position: 'ASC' } }),
    ]);
    const perms = roles.length ? await this.em.find(RolePermission, { where: { roleId: In(roles.map((r) => r.id)) } }) : [];
    const roleKey = new Map(roles.map((r, i) => [r.id, r.name === EVERYONE ? EVERYONE : `r${i}`]));
    const catKey = new Map(cats.map((c, i) => [c.id, `c${i}`]));
    return {
      kind: 'dracord-guild-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      guild: { name: guild.name, publicDescription: guild.publicDescription, afkTimeoutMinutes: guild.afkTimeoutMinutes },
      roles: roles.map((r) => ({
        key: roleKey.get(r.id)!,
        name: r.name,
        color: r.color,
        position: r.position,
        hoist: r.hoist,
        permissions: perms.filter((p) => p.roleId === r.id).map((p) => p.permission),
      })),
      categories: cats.map((c) => ({ key: catKey.get(c.id)!, name: c.name, position: c.position })),
      channels: chans.map((c) => ({
        name: c.name,
        type: String(c.type),
        categoryKey: c.categoryId ? (catKey.get(c.categoryId) ?? null) : null,
        position: c.position,
        topic: c.topic,
        slowModeSec: c.slowModeSec ?? 0,
        isAnnouncement: Boolean(c.isAnnouncement),
        gameKind: c.gameKind,
        overwrites: (c.permissionOverwrites ?? [])
          .filter((o) => o.type === 'role' && roleKey.has(o.id))
          .map((o) => ({ roleKey: roleKey.get(o.id)!, allow: o.allow ?? [], deny: o.deny ?? [] })),
      })),
    };
  }

  /** Gelen JSON'u doğrula ve sınırla (kullanıcı dosyası — güvenilmez). */
  parse(raw: unknown): GuildBackupV1 {
    const b = raw as Partial<GuildBackupV1> | null;
    if (!b || b.kind !== 'dracord-guild-backup' || b.version !== 1) throw new BadRequestException('Bu bir Dracord sunucu yedeği değil');
    if (!Array.isArray(b.roles) || !Array.isArray(b.categories) || !Array.isArray(b.channels)) throw new BadRequestException('Yedek dosyası bozuk');
    if (b.roles.length > LIMITS.roles || b.categories.length > LIMITS.categories || b.channels.length > LIMITS.channels) {
      throw new BadRequestException(`Yedek çok büyük (en fazla ${LIMITS.roles} rol, ${LIMITS.categories} kategori, ${LIMITS.channels} kanal)`);
    }
    return {
      kind: 'dracord-guild-backup',
      version: 1,
      exportedAt: str(b.exportedAt, 40),
      guild: { name: str(b.guild?.name, 80), publicDescription: b.guild?.publicDescription ? str(b.guild.publicDescription, 500) : null, afkTimeoutMinutes: num(b.guild?.afkTimeoutMinutes, 5) },
      roles: b.roles.map((r) => ({ key: str(r?.key, 20), name: str(r?.name, 32), color: /^#[0-9a-f]{6}$/i.test(String(r?.color)) ? String(r.color) : '#99AAB5', position: num(r?.position), hoist: Boolean(r?.hoist), permissions: strs(r?.permissions) })),
      categories: b.categories.map((c) => ({ key: str(c?.key, 20), name: str(c?.name, 100), position: num(c?.position) })),
      channels: b.channels.map((c) => ({
        name: str(c?.name, 100),
        type: str(c?.type, 20),
        categoryKey: c?.categoryKey ? str(c.categoryKey, 20) : null,
        position: num(c?.position),
        topic: c?.topic ? str(c.topic, 1024) : null,
        slowModeSec: Math.max(0, Math.min(21600, num(c?.slowModeSec))),
        isAnnouncement: Boolean(c?.isAnnouncement),
        gameKind: c?.gameKind ? str(c.gameKind, 40) : null,
        overwrites: Array.isArray(c?.overwrites) ? c.overwrites.slice(0, 50).map((o) => ({ roleKey: str(o?.roleKey, 20), allow: strs(o?.allow), deny: strs(o?.deny) })) : [],
      })),
    };
  }

  /** Mevcut sunucuya ekle (sahip). Aynı adlı rol/kategori/kanal atlanır. */
  private readonly lastApply = new Map<string, number>();
  /** ağır işlem: kullanıcı başına dakikada bir */
  private limit(userId: string): void {
    const now = Date.now();
    if (now - (this.lastApply.get(userId) ?? 0) < 60_000) throw new HttpException('Bir dakika sonra tekrar dene', HttpStatus.TOO_MANY_REQUESTS);
    this.lastApply.set(userId, now);
    if (this.lastApply.size > 5000) this.lastApply.clear();
  }

  async restore(guildId: string, userId: string, raw: unknown): Promise<GuildBackupRestoreResult> {
    await this.guilds.requireOwner(guildId, userId);
    this.limit(userId);
    return this.apply(guildId, userId, this.parse(raw));
  }

  /** Yedekten / şablondan yeni sunucu kur. */
  async createFrom(userId: string, raw: unknown, name?: string): Promise<GuildBackupRestoreResult> {
    const b = this.parse(raw);
    this.limit(userId);
    const g = await this.guilds.createGuild(userId, { name: (name?.trim() || b.guild.name || 'Yeni sunucu').slice(0, 80) });
    // yeni sunucunun varsayılan kanallarını yedektekilerle çakışmasın diye bırakıyoruz (aynı ad atlanır)
    return this.apply(g.id, userId, b);
  }

  private async apply(guildId: string, userId: string, b: GuildBackupV1): Promise<GuildBackupRestoreResult> {
    const res: GuildBackupRestoreResult = { guildId, roles: 0, categories: 0, channels: 0, skipped: 0 };
    const everyoneId = await this.guilds.ensureDefaultEveryoneRole(guildId);
    const roleIds = new Map<string, string>([[EVERYONE, everyoneId]]);
    const existingRoles = await this.em.find(Role, { where: { guildId } });
    // @everyone izinleri yedekteki gibi olsun
    const ev = b.roles.find((r) => r.key === EVERYONE);
    if (ev) {
      await this.em.delete(RolePermission, { roleId: everyoneId });
      if (ev.permissions.length) await this.em.save(RolePermission, ev.permissions.map((permission) => this.em.create(RolePermission, { roleId: everyoneId, permission })));
    }
    for (const r of [...b.roles].filter((x) => x.key !== EVERYONE && x.name && x.name !== EVERYONE).sort((x, y) => x.position - y.position)) {
      const same = existingRoles.find((e) => e.name === r.name);
      if (same) {
        roleIds.set(r.key, same.id);
        res.skipped++;
        continue;
      }
      const created = await this.roles.createRole(guildId, userId, { name: r.name, color: r.color, hoist: r.hoist, permissions: r.permissions });
      roleIds.set(r.key, created.id);
      res.roles++;
    }
    const catIds = new Map<string, string>();
    const existingCats = await this.em.find(Category, { where: { guildId } });
    for (const c of [...b.categories].sort((x, y) => x.position - y.position)) {
      if (!c.name) continue;
      const same = existingCats.find((e) => e.name === c.name);
      if (same) {
        catIds.set(c.key, same.id);
        res.skipped++;
        continue;
      }
      const created = await this.guilds.createCategory(guildId, userId, c.name);
      catIds.set(c.key, created.id);
      res.categories++;
    }
    const existingChans = await this.em.find(Channel, { where: { guildId } });
    for (const c of [...b.channels].sort((x, y) => x.position - y.position)) {
      const type = c.type.toUpperCase();
      if (!c.name || !CREATABLE.has(type)) {
        res.skipped++;
        continue;
      }
      const categoryId = c.categoryKey ? (catIds.get(c.categoryKey) ?? null) : null;
      const dup = existingChans.find((e) => e.name.toLowerCase() === c.name.toLowerCase() && String(e.type) === type && (e.categoryId ?? null) === categoryId);
      if (dup) {
        res.skipped++;
        continue;
      }
      const created = await this.channels.createChannel(guildId, userId, {
        name: c.name,
        type: type as 'TEXT' | 'VOICE' | 'FORUM' | 'GAME' | 'WATCH_PARTY',
        categoryId,
        topic: c.topic,
        gameKind: type === 'GAME' ? (c.gameKind ?? 'blackjack') : null,
      });
      const overwrites = c.overwrites
        .filter((o) => roleIds.has(o.roleKey))
        .map((o) => ({ id: roleIds.get(o.roleKey)!, type: 'role' as const, allow: o.allow, deny: o.deny }));
      await this.em.update(Channel, { id: created.id }, {
        position: c.position,
        slowModeSec: c.slowModeSec,
        isAnnouncement: type === 'TEXT' && c.isAnnouncement,
        ...(overwrites.length ? { permissionOverwrites: overwrites } : {}),
      });
      res.channels++;
    }
    return res;
  }
}
