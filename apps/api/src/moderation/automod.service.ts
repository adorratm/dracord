import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAutoModEnabled } from '@/platform/platform-enabled';

const DEFAULT_BLOCK = [
  'discord.gg/raid',
  'free nitro http',
  'steamcommunity.com/gift',
];

@Injectable()
export class AutomodService {
  constructor(private readonly config: ConfigService) {}

  /** Mesaj içeriğini kontrol et; ihlalde BadRequestException */
  assertMessageAllowed(content: string, guildId?: string | null) {
    if (!isAutoModEnabled(this.config)) return;
    const extra =
      this.config
        .get<string>('AUTO_MOD_WORDS')
        ?.split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean) ?? [];
    const blocked = [...DEFAULT_BLOCK, ...extra];
    const lower = content.toLowerCase();
    for (const w of blocked) {
      if (w && lower.includes(w)) {
        throw new BadRequestException(
          guildId
            ? 'Mesaj otomatik moderasyon tarafından engellendi'
            : 'Mesaj otomatik moderasyon tarafından engellendi',
        );
      }
    }
  }
}
