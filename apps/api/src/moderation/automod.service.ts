import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAutoModEnabled } from '@/platform/platform-enabled';
import { GuildSafetyService } from './guild-safety.service';

const DEFAULT_BLOCK = [
  'discord.gg/raid',
  'free nitro http',
  'steamcommunity.com/gift',
];

/** Kumar / bahis metin sinyalleri (ekran görüntüsü CV ayrı pipeline) */
const GAMBLING_HINTS = [
  'bahis yap',
  'iddaa',
  'canlı bahis',
  'bet365',
  'casino bonus',
  'rulet oyna',
  'slot site',
];

@Injectable()
export class AutomodService {
  constructor(
    private readonly config: ConfigService,
    private readonly safety: GuildSafetyService,
  ) {}

  /** Mesaj içeriğini kontrol et; ihlalde BadRequestException */
  async assertMessageAllowed(content: string, guildId?: string | null) {
    if (!isAutoModEnabled(this.config)) return;

    const policy = await this.safety.getEffectivePolicy(guildId);
    if (policy.trusted || !policy.scanText) return;

    const extra =
      this.config
        .get<string>('AUTO_MOD_WORDS')
        ?.split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean) ?? [];
    const blocked = [...DEFAULT_BLOCK, ...extra, ...GAMBLING_HINTS];
    const lower = content.toLowerCase();
    for (const w of blocked) {
      if (w && lower.includes(w)) {
        const isGambling = GAMBLING_HINTS.includes(w);
        if (isGambling) {
          void this.safety
            .createReport({
              category: 'gambling',
              guildId,
              summary: `Automod metin: ${w}`,
              score: 0.8,
              source: 'automod',
            })
            .catch(() => undefined);
        }
        throw new BadRequestException(
          'Mesaj otomatik moderasyon tarafından engellendi',
        );
      }
    }
  }
}
