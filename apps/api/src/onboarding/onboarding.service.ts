import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import type {
  GuildOnboardingCompleteResult,
  GuildOnboardingConfig,
  GuildOnboardingDto,
  GuildOnboardingQuestion,
  ReactionRoleDto,
} from '@dracord/types';
import { GuildPermissions } from '@/common/permissions';
import { Channel } from '@/database/entities/channel.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { GuildMemberRole } from '@/database/entities/guild-member-role.entity';
import { GuildOnboarding } from '@/database/entities/guild-onboarding.entity';
import { GuildOnboardingCompletion } from '@/database/entities/guild-onboarding-completion.entity';
import { Message } from '@/database/entities/message.entity';
import { ReactionRole } from '@/database/entities/reaction-role.entity';
import { Role } from '@/database/entities/role.entity';
import { RolePermission } from '@/database/entities/role-permission.entity';
import { GuildsService } from '@/guilds/guilds.service';

/** a role a member may give themselves may carry only these permissions */
const SELF_ASSIGNABLE_PERMS = new Set<string>([
  GuildPermissions.VIEW_CHANNELS,
  GuildPermissions.SEND_MESSAGES,
  GuildPermissions.CREATE_POLLS,
  GuildPermissions.ADD_REACTIONS,
]);
const MAX_RULES = 10;
const MAX_QUESTIONS = 8;
const MAX_OPTIONS = 12;
const MAX_REACTION_ROLES = 100;

const EMPTY: GuildOnboardingConfig = { enabled: false, rules: [], questions: [], defaultChannelIds: [] };

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const ids = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64))].slice(0, max) : [];

/**
 * B5 — new-member onboarding (accept the rules, answer a few questions → roles and
 * channel suggestions) and reaction roles (react to a message → get a role).
 */
@Injectable()
export class OnboardingService {
  private readonly log = new Logger(OnboardingService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
  ) {}

  // ── config ──

  async get(guildId: string, userId: string): Promise<GuildOnboardingDto> {
    await this.guilds.ensureMember(guildId, userId);
    const row = await this.em.findOne(GuildOnboarding, { where: { guildId } });
    const cfg: GuildOnboardingConfig = row
      ? { enabled: row.enabled, rules: row.rules, questions: row.questions, defaultChannelIds: row.defaultChannelIds }
      : EMPTY;
    return { guildId, ...cfg, completed: await this.isCompleted(guildId, userId) };
  }

  private async isCompleted(guildId: string, userId: string): Promise<boolean> {
    const [done, member] = await Promise.all([
      this.em.findOne(GuildOnboardingCompletion, { where: { guildId, userId } }),
      this.em.findOne(GuildMember, { where: { guildId, userId }, select: { id: true, joinedAt: true } }),
    ]);
    // left and joined again → show it again
    return !!done && (!member || done.completedAt >= member.joinedAt);
  }

  /** roles that are safe to hand out without a moderator: no @everyone, only basic permissions */
  async assertSelfAssignable(guildId: string, roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return;
    const roles = await this.em.find(Role, { where: { id: In(roleIds), guildId }, select: { id: true, name: true } });
    if (roles.length !== roleIds.length) throw new BadRequestException('Rollerden biri bu sunucuda yok');
    if (roles.some((r) => r.name === '@everyone')) throw new BadRequestException('@everyone verilemez');
    const perms = await this.em.find(RolePermission, { where: { roleId: In(roleIds) } });
    const bad = perms.find((p) => !SELF_ASSIGNABLE_PERMS.has(p.permission));
    if (bad) {
      const name = roles.find((r) => r.id === bad.roleId)?.name ?? 'rol';
      throw new BadRequestException(`"${name}" yönetim izni taşıyor — üyelerin kendine verebileceği bir rol olmalı`);
    }
  }

  private async assertChannels(guildId: string, channelIds: string[]): Promise<void> {
    if (channelIds.length === 0) return;
    const n = await this.em.count(Channel, { where: { id: In(channelIds), guildId } });
    if (n !== channelIds.length) throw new BadRequestException('Kanallardan biri bu sunucuda yok');
  }

  private normalize(raw: unknown): GuildOnboardingConfig {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const rules = (Array.isArray(r.rules) ? r.rules : []).map((x) => str(x, 300)).filter(Boolean).slice(0, MAX_RULES);
    const questions: GuildOnboardingQuestion[] = (Array.isArray(r.questions) ? r.questions : [])
      .slice(0, MAX_QUESTIONS)
      .map((q, qi) => {
        const qq = (q && typeof q === 'object' ? q : {}) as Record<string, unknown>;
        const options = (Array.isArray(qq.options) ? qq.options : []).slice(0, MAX_OPTIONS).map((o, oi) => {
          const oo = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
          return {
            id: str(oo.id, 40) || `o${qi}_${oi}`,
            label: str(oo.label, 80),
            emoji: str(oo.emoji, 32) || null,
            roleIds: ids(oo.roleIds, 5),
            channelIds: ids(oo.channelIds, 10),
          };
        });
        return {
          id: str(qq.id, 40) || `q${qi}`,
          title: str(qq.title, 120),
          multi: !!qq.multi,
          required: !!qq.required,
          options: options.filter((o) => o.label),
        };
      })
      .filter((q) => q.title && q.options.length > 0);
    return { enabled: !!r.enabled, rules, questions, defaultChannelIds: ids(r.defaultChannelIds, 10) };
  }

  async update(guildId: string, userId: string, raw: unknown): Promise<GuildOnboardingDto> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_GUILD);
    const cfg = this.normalize(raw);
    const allRoles = [...new Set(cfg.questions.flatMap((q) => q.options.flatMap((o) => o.roleIds)))];
    const allChannels = [...new Set([...cfg.defaultChannelIds, ...cfg.questions.flatMap((q) => q.options.flatMap((o) => o.channelIds))])];
    await this.assertSelfAssignable(guildId, allRoles);
    await this.assertChannels(guildId, allChannels);
    if (cfg.enabled && cfg.rules.length === 0 && cfg.questions.length === 0) {
      throw new BadRequestException('Açmak için en az bir kural ya da soru ekle');
    }
    const existing = await this.em.findOne(GuildOnboarding, { where: { guildId } });
    await this.em.save(GuildOnboarding, this.em.create(GuildOnboarding, { ...(existing ?? {}), guildId, ...cfg }));
    return this.get(guildId, userId);
  }

  // ── a member finishes the screen ──

  async complete(guildId: string, userId: string, body: unknown): Promise<GuildOnboardingCompleteResult> {
    await this.guilds.ensureMember(guildId, userId);
    const row = await this.em.findOne(GuildOnboarding, { where: { guildId } });
    const member = await this.em.findOne(GuildMember, { where: { guildId, userId } });
    if (!member) throw new NotFoundException('Üye bulunamadı');
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    if (row?.rules.length && b.acceptRules !== true) throw new BadRequestException('Devam etmek için kuralları kabul et');
    const answers = (b.answers && typeof b.answers === 'object' ? b.answers : {}) as Record<string, unknown>;
    const roleIds = new Set<string>();
    const channelIds = new Set<string>(row?.defaultChannelIds ?? []);
    for (const q of row?.questions ?? []) {
      const picked = ids(answers[q.id], MAX_OPTIONS).filter((id) => q.options.some((o) => o.id === id));
      const chosen = q.multi ? picked : picked.slice(0, 1);
      if (q.required && chosen.length === 0) throw new BadRequestException(`"${q.title}" sorusunu yanıtla`);
      for (const o of q.options) {
        if (!chosen.includes(o.id)) continue;
        o.roleIds.forEach((r) => roleIds.add(r));
        o.channelIds.forEach((c) => channelIds.add(c));
      }
    }
    // the config may be older than a role edit: only hand out what is still safe
    const grant: string[] = [];
    for (const roleId of roleIds) {
      try {
        await this.assertSelfAssignable(guildId, [roleId]);
        grant.push(roleId);
      } catch {
        this.log.warn(`katılış rolü atlandı (artık güvenli değil): ${roleId}`);
      }
    }
    if (grant.length) {
      await this.em
        .createQueryBuilder()
        .insert()
        .into(GuildMemberRole)
        .values(grant.map((roleId) => ({ guildMemberId: member.id, roleId })))
        .orIgnore()
        .execute();
    }
    await this.em.upsert(GuildOnboardingCompletion, { guildId, userId, completedAt: new Date() }, ['guildId', 'userId']);
    const existing = channelIds.size
      ? await this.em.find(Channel, { where: { id: In([...channelIds]), guildId }, select: { id: true } })
      : [];
    return { ok: true, grantedRoleIds: grant, suggestedChannelIds: existing.map((c) => c.id) };
  }

  // ── reaction roles ──

  private toDto(r: ReactionRole): ReactionRoleDto {
    return { id: r.id, guildId: r.guildId, channelId: r.channelId, messageId: r.messageId, emoji: r.emoji, roleId: r.roleId };
  }

  async listReactionRoles(guildId: string, userId: string): Promise<ReactionRoleDto[]> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_ROLES);
    const rows = await this.em.find(ReactionRole, { where: { guildId }, order: { createdAt: 'ASC' } });
    return rows.map((r) => this.toDto(r));
  }

  async addReactionRole(guildId: string, userId: string, body: unknown): Promise<ReactionRoleDto> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_ROLES);
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const messageId = str(b.messageId, 64);
    const emoji = str(b.emoji, 32);
    const roleId = str(b.roleId, 64);
    if (!messageId || !emoji || !roleId) throw new BadRequestException('Mesaj, emoji ve rol gerekli');
    const message = await this.em.findOne(Message, { where: { id: messageId }, select: { id: true, channelId: true, deletedAt: true } });
    if (!message || message.deletedAt) throw new NotFoundException('Mesaj bulunamadı');
    const channel = await this.em.findOne(Channel, { where: { id: message.channelId }, select: { id: true, guildId: true } });
    if (!channel || channel.guildId !== guildId) throw new BadRequestException('Mesaj bu sunucuda değil');
    await this.assertSelfAssignable(guildId, [roleId]);
    if ((await this.em.count(ReactionRole, { where: { guildId } })) >= MAX_REACTION_ROLES) {
      throw new BadRequestException(`En fazla ${MAX_REACTION_ROLES} tepki rolü`);
    }
    if (await this.em.findOne(ReactionRole, { where: { messageId, emoji } })) {
      throw new BadRequestException('Bu mesajda bu emoji zaten bir role bağlı');
    }
    const row = await this.em.save(ReactionRole, this.em.create(ReactionRole, { guildId, channelId: channel.id, messageId, emoji, roleId }));
    return this.toDto(row);
  }

  async removeReactionRole(guildId: string, userId: string, id: string): Promise<{ ok: true }> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_ROLES);
    await this.em.delete(ReactionRole, { id, guildId });
    return { ok: true };
  }

  /** called after a reaction is added / removed (best effort; never fails the reaction) */
  async onReaction(messageId: string, userId: string, emoji: string, added: boolean): Promise<void> {
    try {
      const rr = await this.em.findOne(ReactionRole, { where: { messageId, emoji } });
      if (!rr) return;
      const member = await this.em.findOne(GuildMember, { where: { guildId: rr.guildId, userId }, select: { id: true } });
      if (!member) return;
      if (added) {
        await this.assertSelfAssignable(rr.guildId, [rr.roleId]);
        await this.em
          .createQueryBuilder()
          .insert()
          .into(GuildMemberRole)
          .values({ guildMemberId: member.id, roleId: rr.roleId })
          .orIgnore()
          .execute();
      } else {
        await this.em.delete(GuildMemberRole, { guildMemberId: member.id, roleId: rr.roleId });
      }
    } catch (err) {
      this.log.warn(`tepki rolü uygulanamadı: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
