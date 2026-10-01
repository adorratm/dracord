import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BotService } from '@/bot/bot.service';
import { Channel } from '@/database/entities/channel.entity';
import { Message } from '@/database/entities/message.entity';
import { SlashCommand } from '@/database/entities/slash-command.entity';
import { User } from '@/database/entities/user.entity';
import { toPublicUser } from '@/common/user.mapper';
import { MessagesRealtimeService } from '@/messages/messages-realtime.service';

/** Sunucuya kayıtlı özel slash komutlarını çalıştırır. */
@Injectable()
export class CustomSlashService {
  constructor(
    private readonly em: EntityManager,
    private readonly bot: BotService,
    private readonly realtime: MessagesRealtimeService,
  ) {}

  /** true = komut yakalandı ve yanıt gönderildi */
  async tryHandle(
    authorId: string,
    channelId: string,
    content: string,
  ): Promise<boolean> {
    const trimmed = content.trim();
    if (!trimmed.startsWith('/')) return false;

    const [rawCmd, ...rest] = trimmed.slice(1).split(/\s+/);
    const cmd = (rawCmd || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cmd) return false;
    const args = rest.join(' ').trim();

    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel?.guildId) return false;

    const rows = await this.em.find(SlashCommand, { where: { guildId: channel.guildId } });
    const match = rows.find(
      (r) =>
        r.name === cmd ||
        (r.aliases ?? []).some((a) => a.toLowerCase() === cmd),
    );
    if (!match) return false;

    const author = await this.em.findOne(User, { where: { id: authorId } });
    const userLabel = author?.displayName || author?.username || 'Kullanıcı';
    const reply = this.renderResponse(match, userLabel, args);
    await this.reply(channelId, reply);
    return true;
  }

  private renderResponse(
    cmd: SlashCommand,
    userLabel: string,
    args: string,
  ): string {
    const template = cmd.responseTemplate?.trim();
    if (template) {
      return template
        .replaceAll('{user}', userLabel)
        .replaceAll('{args}', args || '—')
        .replaceAll('{command}', cmd.name)
        .slice(0, 2000);
    }
    const lines = [
      `**/${cmd.name}** — ${cmd.description}`,
      args ? `Argümanlar: ${args}` : null,
      `Kullanım: ${cmd.usage}`,
      `_Çağıran: ${userLabel}_`,
    ].filter(Boolean);
    return lines.join('\n');
  }

  private async reply(channelId: string, content: string) {
    const botId = this.bot.getBotUserId();
    await this.bot.ensureBotUser();
    const author = await this.em.findOneOrFail(User, { where: { id: botId } });
    const saved = await this.em.save(
      Message,
      this.em.create(Message, {
        channelId,
        authorId: botId,
        content,
        type: 'default',
      }),
    );
    const message = await this.em.findOneOrFail(Message, {
      where: { id: saved.id },
      relations: { author: true },
    });
    this.realtime.emitCreate(channelId, {
      id: message.id,
      channelId: message.channelId,
      author: toPublicUser(message.author ?? author),
      content: message.content,
      type: 'default' as const,
      attachments: undefined,
      embeds: undefined,
      poll: undefined,
      replyTo: null,
      forwardedFrom: null,
      pinnedAt: null,
      reactions: [],
      createdAt: message.createdAt.toISOString(),
      updatedAt: null,
    });
  }
}
