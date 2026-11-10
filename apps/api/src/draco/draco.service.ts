import { BadRequestException, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { FAQ_LIMITS, faqBestMatch, type GuildFaqConfigDto, type GuildFaqEntry } from '@dracord/types';
import { GuildPermissions } from '@/common/permissions';
import { Channel } from '@/database/entities/channel.entity';
import { GuildFaq } from '@/database/entities/guild-faq.entity';
import { GuildsService } from '@/guilds/guilds.service';
import { LevelsService } from '@/levels/levels.service';
import { CustomSlashService } from '@/messages/custom-slash.service';
import { DRACO_KB } from './draco-kb';

const AUTO_MIN_SCORE = 0.75;
const ANSWER_MIN_SCORE = 0.4;
const AUTO_COOLDOWN_MS = 60_000;

/**
 * Draco (D4) — kural tabanlı yardımcı: /draco, /sss, /zar, /yazitura, /sec, /seviye
 * ve isteğe bağlı SSS otomatik yanıtı. Model yok.
 */
@Injectable()
export class DracoService {
  private readonly cache = new Map<string, { at: number; cfg: GuildFaqConfigDto }>();
  private readonly autoLast = new Map<string, number>();

  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly levels: LevelsService,
    private readonly slash: CustomSlashService,
  ) {}

  async getConfig(guildId: string): Promise<GuildFaqConfigDto> {
    const hit = this.cache.get(guildId);
    if (hit && Date.now() - hit.at < 60_000) return hit.cfg;
    const row = await this.em.findOne(GuildFaq, { where: { guildId } });
    const cfg: GuildFaqConfigDto = {
      guildId,
      entries: row?.entries ?? [],
      autoAnswer: Boolean(row?.autoAnswer),
      autoChannelIds: row?.autoChannelIds ?? [],
    };
    this.cache.set(guildId, { at: Date.now(), cfg });
    if (this.cache.size > 5000) this.cache.clear();
    return cfg;
  }

  async updateConfig(guildId: string, actorId: string, patch: Partial<Omit<GuildFaqConfigDto, 'guildId'>>) {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_GUILD);
    const cur = await this.getConfig(guildId);
    const entries: GuildFaqEntry[] = (Array.isArray(patch.entries) ? patch.entries : cur.entries)
      .slice(0, FAQ_LIMITS.entries)
      .flatMap((e, i) => {
        const question = String(e?.question ?? '').replace(/\s+/g, ' ').trim().slice(0, FAQ_LIMITS.questionMax);
        const answer = String(e?.answer ?? '').trim().slice(0, FAQ_LIMITS.answerMax);
        if (!question || !answer) return [];
        const keywords = [...new Set((Array.isArray(e?.keywords) ? e.keywords : []).map((k) => String(k).trim().slice(0, 40)).filter(Boolean))].slice(
          0,
          FAQ_LIMITS.keywords,
        );
        return [{ id: typeof e?.id === 'string' && e.id.length <= 32 ? e.id : `f${Date.now().toString(36)}${i}`, question, keywords, answer }];
      });
    if (Array.isArray(patch.entries) && patch.entries.length > FAQ_LIMITS.entries) {
      throw new BadRequestException(`En fazla ${FAQ_LIMITS.entries} soru`);
    }
    const next: GuildFaqConfigDto = {
      guildId,
      entries,
      autoAnswer: patch.autoAnswer ?? cur.autoAnswer,
      autoChannelIds: Array.isArray(patch.autoChannelIds)
        ? [...new Set(patch.autoChannelIds.map(String))].slice(0, FAQ_LIMITS.autoChannels)
        : cur.autoChannelIds,
    };
    const row = (await this.em.findOne(GuildFaq, { where: { guildId } })) ?? this.em.create(GuildFaq, { guildId });
    row.entries = next.entries;
    row.autoAnswer = next.autoAnswer;
    row.autoChannelIds = next.autoChannelIds;
    await this.em.save(GuildFaq, row);
    this.cache.set(guildId, { at: Date.now(), cfg: next });
    return next;
  }

  private answer(query: string, guildEntries: GuildFaqEntry[]): string {
    const g = faqBestMatch(query, guildEntries);
    if (g && g.score >= ANSWER_MIN_SCORE) return `📌 **${g.entry.question}**\n${g.entry.answer}`;
    const k = faqBestMatch(query, DRACO_KB);
    if (k && k.score >= ANSWER_MIN_SCORE) return `🐉 **${k.entry.question}**\n${k.entry.answer}`;
    const suggest = [...guildEntries.slice(0, 3).map((e) => e.question), ...DRACO_KB.slice(0, 4).map((e) => e.question)];
    return `🐉 Bunu bilmiyorum. Şunları sorabilirsin:\n${suggest.map((q) => `• ${q}`).join('\n')}`;
  }

  /** true = komut Draco'nundu ve yanıtlandı */
  async tryHandle(userId: string, channelId: string, content: string): Promise<boolean> {
    const m = /^\/([a-zçğıöşü]+)(?:\s+([\s\S]*))?$/i.exec(content.trim());
    if (!m) return false;
    const cmd = m[1]!.toLocaleLowerCase('tr-TR');
    const arg = (m[2] ?? '').trim();
    const known = ['draco', 'yardım', 'yardim', 'help', 'sss', 'faq', 'zar', 'roll', 'yazitura', 'yazıtura', 'flip', 'sec', 'seç', 'choose', 'seviye', 'rank'];
    if (!known.includes(cmd)) return false;
    const channel = await this.em.findOne(Channel, { where: { id: channelId }, select: { id: true, guildId: true } });
    if (!channel?.guildId) return false;
    const guildId = channel.guildId;
    let text: string;
    switch (cmd) {
      case 'draco':
      case 'yardım':
      case 'yardim':
      case 'help':
        text = arg
          ? this.answer(arg, (await this.getConfig(guildId)).entries)
          : [
              '🐉 **Draco** — yardımcı komutlar',
              '`/draco <soru>` Dracord hakkında sor',
              '`/sss <soru>` sunucunun sık sorulan soruları',
              '`/zar [2d6]` zar at · `/yazitura` · `/sec a | b | c`',
              '`/seviye` seviyeni gör',
            ].join('\n');
        break;
      case 'sss':
      case 'faq': {
        const cfg = await this.getConfig(guildId);
        if (!arg) {
          text = cfg.entries.length
            ? `📌 **Sık sorulanlar**\n${cfg.entries.slice(0, 15).map((e) => `• ${e.question}`).join('\n')}\nBirini sormak için: \`/sss <soru>\``
            : '📌 Bu sunucuda henüz SSS yok. Yöneticiler Sunucu ayarları → SSS bölümünden ekleyebilir.';
        } else text = this.answer(arg, cfg.entries);
        break;
      }
      case 'zar':
      case 'roll': {
        const d = /^(\d{1,2})?d(\d{1,4})$/i.exec(arg || 'd6');
        const n = Math.max(1, Math.min(20, Number(d?.[1] ?? 1)));
        const sides = Math.max(2, Math.min(1000, Number(d?.[2] ?? 6)));
        if (!d && arg) {
          text = '🎲 Kullanım: `/zar`, `/zar d20`, `/zar 3d6`';
          break;
        }
        const rolls = Array.from({ length: n }, () => randomInt(1, sides + 1));
        text = `🎲 ${n}d${sides}: **${rolls.join(' + ')}**${n > 1 ? ` = **${rolls.reduce((a, b) => a + b, 0)}**` : ''}`;
        break;
      }
      case 'yazitura':
      case 'yazıtura':
      case 'flip':
        text = `🪙 **${randomInt(2) ? 'Yazı' : 'Tura'}**`;
        break;
      case 'sec':
      case 'seç':
      case 'choose': {
        const opts = arg.split(/\s*[|,]\s*/).map((x) => x.trim()).filter(Boolean).slice(0, 20);
        text = opts.length >= 2 ? `🎯 Seçim: **${opts[randomInt(opts.length)]}**` : '🎯 Kullanım: `/sec pizza | döner | lahmacun`';
        break;
      }
      case 'seviye':
      case 'rank': {
        try {
          const lv = await this.levels.getMember(guildId, userId, userId);
          text = `🏅 Seviye **${lv.level}**${lv.rank ? ` · sıra #${lv.rank}` : ''} · ${lv.xpIntoLevel}/${lv.xpForNext} XP · ${lv.messageCount} mesaj · ${lv.voiceMinutes} dk ses`;
        } catch {
          text = '🏅 Seviye bilgisi alınamadı.';
        }
        break;
      }
      default:
        return false;
    }
    await this.slash.reply(channelId, text);
    return true;
  }

  /** "?" ile biten mesaja güçlü SSS eşleşmesinde otomatik yanıt (kanal başına 60 sn bekleme) */
  async maybeAutoAnswer(channelId: string, content: string): Promise<void> {
    const t = content.trim();
    if (!t.endsWith('?') || t.length < 8 || t.length > 300 || t.startsWith('/')) return;
    const channel = await this.em.findOne(Channel, { where: { id: channelId }, select: { id: true, guildId: true } });
    if (!channel?.guildId) return;
    const cfg = await this.getConfig(channel.guildId);
    if (!cfg.autoAnswer || !cfg.entries.length) return;
    if (cfg.autoChannelIds.length && !cfg.autoChannelIds.includes(channelId)) return;
    const last = this.autoLast.get(channelId) ?? 0;
    if (Date.now() - last < AUTO_COOLDOWN_MS) return;
    const best = faqBestMatch(t, cfg.entries);
    if (!best || best.score < AUTO_MIN_SCORE) return;
    this.autoLast.set(channelId, Date.now());
    if (this.autoLast.size > 10_000) this.autoLast.clear();
    await this.slash.reply(channelId, `📌 **${best.entry.question}**\n${best.entry.answer}\n_Otomatik SSS yanıtı · \`/sss\` ile tümü_`);
  }
}
