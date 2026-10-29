import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '@/database/entities/user.entity';
import { mergeClientSettings } from '@/users/client-settings';
import { STICKER_MARKET_PACKS } from './sticker-marketplace';

@Injectable()
export class StickersService {
  constructor(private readonly em: EntityManager) {}

  listMarketplace() {
    return STICKER_MARKET_PACKS.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      nitroOnly: Boolean(p.nitroOnly),
      count: p.stickers.length,
      preview: p.stickers.slice(0, 4).map((s) => s.value),
    }));
  }

  async installPack(userId: string, packId: string) {
    const pack = STICKER_MARKET_PACKS.find((p) => p.id === packId);
    if (!pack) throw new NotFoundException('Paket yok');
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanıcı yok');
    const settings = mergeClientSettings(user.clientSettings);
    if (pack.nitroOnly && settings.billing.nitroPlan === 'none') {
      throw new ForbiddenException('Bu paket için Nitro gerekir');
    }
    const existing = new Set(settings.stickers.custom.map((s) => s.id));
    const now = Date.now();
    for (const s of pack.stickers) {
      const id = `mkt:${pack.id}:${s.id}`;
      if (existing.has(id)) continue;
      settings.stickers.custom.push({
        id,
        kind: s.kind,
        value: s.value,
        label: s.label,
        createdAt: now,
      });
      existing.add(id);
    }
    settings.stickers.custom = settings.stickers.custom.slice(-200);
    user.clientSettings = settings as unknown as Record<string, unknown>;
    await this.em.save(user);
    return { stickers: settings.stickers, installed: pack.id };
  }
}
