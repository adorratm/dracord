import { Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { BotService } from '@/bot/bot.service';
import { Channel } from '@/database/entities/channel.entity';
import { Message } from '@/database/entities/message.entity';
import {
  SlashCommand,
  type SlashCommandOption,
} from '@/database/entities/slash-command.entity';
import { User } from '@/database/entities/user.entity';
import { toPublicUser } from '@/common/user.mapper';
import { MessagesRealtimeService } from '@/messages/messages-realtime.service';

/** Sunucuya kayıtlı + global özel slash komutlarını çalıştırır. */
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
    const argsRaw = rest.join(' ').trim();

    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel?.guildId) return false;

    const rows = await this.em.find(SlashCommand, {
      where: [{ guildId: channel.guildId }, { guildId: IsNull() }],
    });
    const match = rows.find(
      (r) =>
        r.name === cmd ||
        (r.aliases ?? []).some((a) => a.toLowerCase() === cmd),
    );
    if (!match) return false;

    const parsed = this.parseArgs(argsRaw, match.options ?? null);
    if (parsed.error) {
      await this.reply(
        channelId,
        `❌ **/${match.name}** — ${parsed.error}\nKullanım: ${match.usage}`,
      );
      return true;
    }

    const author = await this.em.findOne(User, { where: { id: authorId } });
    const userLabel = author?.displayName || author?.username || 'Kullanıcı';
    const reply = this.renderResponse(match, userLabel, argsRaw, parsed.values);
    await this.reply(channelId, reply);
    return true;
  }

  /**
   * `key:value` veya konumlu argümanları option şemasına bağlar.
   * Örn: `/ban user:@x reason:spam` veya `/ban @x spam`
   */
  private parseArgs(
    argsRaw: string,
    options: SlashCommandOption[] | null,
  ): { values: Record<string, string>; error?: string } {
    const values: Record<string, string> = {};
    if (!options?.length) {
      if (argsRaw) values._ = argsRaw;
      return { values };
    }

    const named = new Map<string, string>();
    const positional: string[] = [];
    if (argsRaw) {
      const tokens = argsRaw.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
      for (const t of tokens) {
        const m = /^([a-z0-9_-]+):(.+)$/i.exec(t);
        if (m) {
          named.set(m[1]!.toLowerCase(), m[2]!.replace(/^"|"$/g, ''));
        } else {
          positional.push(t.replace(/^"|"$/g, ''));
        }
      }
    }

    let posIdx = 0;
    for (const opt of options) {
      let raw = named.get(opt.name);
      if (raw === undefined && posIdx < positional.length) {
        raw = positional[posIdx++];
      }
      if (raw === undefined || raw === '') {
        if (opt.required) {
          return {
            values,
            error: `zorunlu seçenek eksik: \`${opt.name}\``,
          };
        }
        continue;
      }
      const coerced = this.coerceOption(opt, raw);
      if (coerced.error) {
        return { values, error: coerced.error };
      }
      values[opt.name] = coerced.value!;
    }
    return { values };
  }

  private coerceOption(
    opt: SlashCommandOption,
    raw: string,
  ): { value?: string; error?: string } {
    if (opt.choices?.length) {
      const hit = opt.choices.find(
        (c) =>
          String(c.value).toLowerCase() === raw.toLowerCase() ||
          c.name.toLowerCase() === raw.toLowerCase(),
      );
      if (!hit) {
        return {
          error: `\`${opt.name}\` için geçersiz seçim (izinli: ${opt.choices
            .map((c) => c.name)
            .join(', ')})`,
        };
      }
      return { value: String(hit.value) };
    }
    switch (opt.type) {
      case 4: // INTEGER
      case 10: { // NUMBER
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          return { error: `\`${opt.name}\` sayı olmalı` };
        }
        if (opt.type === 4 && !Number.isInteger(n)) {
          return { error: `\`${opt.name}\` tam sayı olmalı` };
        }
        return { value: String(n) };
      }
      case 5: { // BOOLEAN
        const v = raw.toLowerCase();
        if (!['true', 'false', '1', '0', 'evet', 'hayır', 'yes', 'no'].includes(v)) {
          return { error: `\`${opt.name}\` boolean olmalı` };
        }
        const truthy = ['true', '1', 'evet', 'yes'].includes(v);
        return { value: truthy ? 'true' : 'false' };
      }
      default:
        return { value: raw.slice(0, 500) };
    }
  }

  private renderResponse(
    cmd: SlashCommand,
    userLabel: string,
    args: string,
    optionValues: Record<string, string>,
  ): string {
    const template = cmd.responseTemplate?.trim();
    if (template) {
      let out = template
        .replaceAll('{user}', userLabel)
        .replaceAll('{args}', args || '—')
        .replaceAll('{command}', cmd.name);
      for (const [k, v] of Object.entries(optionValues)) {
        out = out.replaceAll(`{opt.${k}}`, v);
      }
      return out.slice(0, 2000);
    }
    const optLines = Object.entries(optionValues)
      .filter(([k]) => k !== '_')
      .map(([k, v]) => `• **${k}**: ${v}`);
    const lines = [
      `**/${cmd.name}** — ${cmd.description}`,
      args ? `Argümanlar: ${args}` : null,
      optLines.length ? optLines.join('\n') : null,
      cmd.options?.length
        ? `Şema: ${cmd.options.map((o) => `${o.name}:${o.type}${o.required ? '*' : ''}`).join(', ')}`
        : null,
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
