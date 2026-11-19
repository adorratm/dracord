import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import type { GuildTicketConfig, TicketDto } from '@dracord/types';
import { DRACORD_BOT_USER_ID } from '@/bot/bot.constants';
import { BotService } from '@/bot/bot.service';
import { GuildPermissions } from '@/common/permissions';
import { Category } from '@/database/entities/category.entity';
import { Channel } from '@/database/entities/channel.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { GuildTicketSettings, Ticket } from '@/database/entities/ticket.entity';
import { Role } from '@/database/entities/role.entity';
import { User } from '@/database/entities/user.entity';
import { ChannelType } from '@/database/enums';
import { GuildsService } from '@/guilds/guilds.service';
import { MessagesService } from '@/messages/messages.service';

const MAX_OPEN_PER_MEMBER = 3;
const MAX_STAFF_ROLES = 10;
const VIEW = 'VIEW_CHANNEL';
const SEND = 'SEND_MESSAGES';

type Overwrite = { id: string; type: 'role' | 'member'; allow: string[]; deny: string[] };

/** B6 — support tickets: a private channel for the member and the staff roles */
@Injectable()
export class TicketsService {
  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly messages: MessagesService,
    private readonly bot: BotService,
  ) {}

  private dto(t: Ticket): TicketDto {
    return {
      id: t.id,
      guildId: t.guildId,
      channelId: t.channelId,
      number: t.number,
      openerId: t.openerId,
      subject: t.subject,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      closedAt: t.closedAt ? t.closedAt.toISOString() : null,
    };
  }

  private async settings(guildId: string): Promise<GuildTicketSettings | null> {
    return this.em.findOne(GuildTicketSettings, { where: { guildId } });
  }

  private async isStaff(guildId: string, userId: string, s: GuildTicketSettings | null): Promise<boolean> {
    if (await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_CHANNELS).then(() => true, () => false)) return true;
    if (!s?.staffRoleIds.length) return false;
    const m = await this.em.findOne(GuildMember, { where: { guildId, userId }, select: { id: true } });
    if (!m) return false;
    const ids = await this.guilds.resolveMemberRoleIds(guildId, m.id);
    return ids.some((r) => s.staffRoleIds.includes(r));
  }

  async getConfig(guildId: string, userId: string): Promise<GuildTicketConfig> {
    await this.guilds.ensureMember(guildId, userId);
    const s = await this.settings(guildId);
    return {
      enabled: !!s?.enabled,
      categoryId: s?.categoryId ?? null,
      staffRoleIds: s?.staffRoleIds ?? [],
      logChannelId: s?.logChannelId ?? null,
      greeting: s?.greeting ?? '',
    };
  }

  async setConfig(guildId: string, userId: string, raw: unknown): Promise<GuildTicketConfig> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_GUILD);
    const b = (raw && typeof raw === 'object' ? raw : {}) as Partial<GuildTicketConfig>;
    const categoryId = typeof b.categoryId === 'string' && b.categoryId ? b.categoryId : null;
    const logChannelId = typeof b.logChannelId === 'string' && b.logChannelId ? b.logChannelId : null;
    const staffRoleIds = Array.isArray(b.staffRoleIds)
      ? [...new Set(b.staffRoleIds.filter((x): x is string => typeof x === 'string'))].slice(0, MAX_STAFF_ROLES)
      : [];
    if (categoryId && !(await this.em.count(Category, { where: { id: categoryId, guildId } }))) {
      throw new BadRequestException('Kategori bu sunucuda yok');
    }
    if (logChannelId) {
      const ch = await this.em.findOne(Channel, { where: { id: logChannelId, guildId }, select: { id: true, type: true } });
      if (!ch || ch.type !== ChannelType.TEXT) throw new BadRequestException('Kayıt kanalı bir metin kanalı olmalı');
    }
    if (staffRoleIds.length && (await this.em.count(Role, { where: { id: In(staffRoleIds), guildId } })) !== staffRoleIds.length) {
      throw new BadRequestException('Rollerden biri bu sunucuda yok');
    }
    const greeting = typeof b.greeting === 'string' ? b.greeting.trim().slice(0, 500) : '';
    const enabled = !!b.enabled;
    const cur = await this.settings(guildId);
    await this.em.save(
      GuildTicketSettings,
      this.em.create(GuildTicketSettings, { ...(cur ?? { counter: 0 }), guildId, enabled, categoryId, staffRoleIds, logChannelId, greeting }),
    );
    return { enabled, categoryId, staffRoleIds, logChannelId, greeting };
  }

  /** mine, or all of them for staff */
  async list(guildId: string, userId: string): Promise<TicketDto[]> {
    await this.guilds.ensureMember(guildId, userId);
    const s = await this.settings(guildId);
    const staff = await this.isStaff(guildId, userId, s);
    const rows = await this.em.find(Ticket, {
      where: staff ? { guildId } : { guildId, openerId: userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return rows.map((t) => this.dto(t));
  }

  async open(guildId: string, userId: string, raw: unknown): Promise<TicketDto> {
    await this.guilds.ensureMember(guildId, userId);
    const s = await this.settings(guildId);
    if (!s?.enabled) throw new BadRequestException('Bu sunucuda destek talepleri kapalı');
    const subject = typeof (raw as { subject?: unknown })?.subject === 'string' ? String((raw as { subject: string }).subject).trim().slice(0, 120) : '';
    if (!subject) throw new BadRequestException('Konu gerekli');
    const open = await this.em.count(Ticket, { where: { guildId, openerId: userId, status: 'open' } });
    if (open >= MAX_OPEN_PER_MEMBER) throw new BadRequestException(`En fazla ${MAX_OPEN_PER_MEMBER} açık talebin olabilir`);
    const everyone = await this.em.findOne(Role, { where: { guildId, name: '@everyone' }, select: { id: true } });
    const user = await this.em.findOne(User, { where: { id: userId }, select: { id: true, username: true } });
    await this.bot.ensureBotInGuild(guildId);

    // number + channel in one transaction: the counter row lock serialises concurrent opens
    const { ticket, channel } = await this.em.transaction(async (tx) => {
      const row = await tx.findOne(GuildTicketSettings, { where: { guildId }, lock: { mode: 'pessimistic_write' } });
      const number = (row?.counter ?? 0) + 1;
      await tx.update(GuildTicketSettings, { guildId }, { counter: number });
      const overwrites: Overwrite[] = [
        ...(everyone ? [{ id: everyone.id, type: 'role' as const, allow: [], deny: [VIEW] }] : []),
        { id: userId, type: 'member', allow: [VIEW, SEND], deny: [] },
        { id: DRACORD_BOT_USER_ID, type: 'member', allow: [VIEW, SEND], deny: [] },
        ...s.staffRoleIds.map((id) => ({ id, type: 'role' as const, allow: [VIEW, SEND], deny: [] })),
      ];
      const slug = (user?.username ?? 'uye').toLowerCase().replace(/[^a-z0-9_-]+/g, '').slice(0, 20) || 'uye';
      const channel = await tx.save(
        Channel,
        tx.create(Channel, {
          guildId,
          name: `talep-${String(number).padStart(4, '0')}-${slug}`,
          type: ChannelType.TEXT,
          categoryId: s.categoryId,
          position: 9000 + number,
          topic: `Destek talebi: ${subject}`,
          locked: false,
          passwordHash: null,
          deniedUserIds: null,
          permissionOverwrites: overwrites,
        }),
      );
      const ticket = await tx.save(
        Ticket,
        tx.create(Ticket, { guildId, channelId: channel.id, number, openerId: userId, subject, status: 'open', closedById: null, closedAt: null }),
      );
      return { ticket, channel };
    });

    const greet = s.greeting || 'Merhaba! Sorununu ayrıntılı yaz, ekip en kısa sürede yanıtlayacak.';
    await this.botSay(channel.id, `🎫 **Talep #${ticket.number}: ${subject}**\n@${user?.username ?? 'üye'} — ${greet}`);
    if (s.logChannelId) {
      await this.botSay(s.logChannelId, `🎫 Yeni destek talebi **#${ticket.number}** (#${channel.name}) — @${user?.username ?? 'üye'}: ${subject}`);
    }
    return this.dto(ticket);
  }

  private async botSay(channelId: string, content: string): Promise<void> {
    try {
      await this.messages.createMessage(channelId, DRACORD_BOT_USER_ID, content);
    } catch {
      /* the channel may be gone */
    }
  }

  /** opener or staff: read-only for the opener afterwards, staff can still read it */
  async close(id: string, userId: string): Promise<TicketDto> {
    const t = await this.em.findOne(Ticket, { where: { id } });
    if (!t) throw new NotFoundException('Talep bulunamadı');
    const s = await this.settings(t.guildId);
    if (t.openerId !== userId && !(await this.isStaff(t.guildId, userId, s))) throw new ForbiddenException('Bu talebi kapatamazsın');
    if (t.status === 'closed') return this.dto(t);
    t.status = 'closed';
    t.closedById = userId;
    t.closedAt = new Date();
    await this.em.save(Ticket, t);
    const ch = await this.em.findOne(Channel, { where: { id: t.channelId } });
    if (ch) {
      ch.permissionOverwrites = (ch.permissionOverwrites ?? []).map((o) =>
        o.type === 'member' && o.id === t.openerId ? { ...o, allow: [VIEW], deny: [SEND] } : o,
      );
      ch.name = ch.name.replace(/^talep-/, 'kapali-');
      await this.em.save(Channel, ch);
      await this.botSay(ch.id, '🔒 Talep kapatıldı. Ekip kanalı arşiv olarak görmeye devam eder.');
    }
    return this.dto(t);
  }

  /** staff reopens */
  async reopen(id: string, userId: string): Promise<TicketDto> {
    const t = await this.em.findOne(Ticket, { where: { id } });
    if (!t) throw new NotFoundException('Talep bulunamadı');
    if (!(await this.isStaff(t.guildId, userId, await this.settings(t.guildId)))) throw new ForbiddenException('Yalnız ekip yeniden açabilir');
    if (t.status === 'open') return this.dto(t);
    t.status = 'open';
    t.closedAt = null;
    t.closedById = null;
    await this.em.save(Ticket, t);
    const ch = await this.em.findOne(Channel, { where: { id: t.channelId } });
    if (ch) {
      ch.permissionOverwrites = (ch.permissionOverwrites ?? []).map((o) =>
        o.type === 'member' && o.id === t.openerId ? { ...o, allow: [VIEW, SEND], deny: [] } : o,
      );
      ch.name = ch.name.replace(/^kapali-/, 'talep-');
      await this.em.save(Channel, ch);
      await this.botSay(ch.id, '🔓 Talep yeniden açıldı.');
    }
    return this.dto(t);
  }
}
