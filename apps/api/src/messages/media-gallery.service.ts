import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { MediaGalleryItem, MediaGalleryKind, MediaGalleryPage } from '@dracord/types';
import { ChannelsService } from '@/channels/channels.service';
import { Message } from '@/database/entities/message.entity';

const PAGE_MESSAGES = 60;
const MAX_ITEMS = 60;

export function attachmentKind(contentType: string, filename: string, voice?: boolean): MediaGalleryKind | 'voice' {
  if (voice) return 'voice';
  const ct = (contentType || '').toLowerCase();
  if (ct.startsWith('image/')) return 'image';
  if (ct.startsWith('video/')) return 'video';
  // no useful type: go by the extension
  if (!ct || ct === 'application/octet-stream') {
    if (/\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(filename)) return 'image';
    if (/\.(mp4|webm|mov|mkv)$/i.test(filename)) return 'video';
  }
  return 'file';
}

/** G1 — every image / video / file shared in a channel, newest first */
@Injectable()
export class MediaGalleryService {
  constructor(
    private readonly em: EntityManager,
    private readonly channels: ChannelsService,
  ) {}

  async list(channelId: string, userId: string, kind: MediaGalleryKind, before?: string): Promise<MediaGalleryPage> {
    await this.channels.getChannel(channelId, userId);
    const items: MediaGalleryItem[] = [];
    let cursor = before && /^[A-Za-z0-9_-]{1,64}$/.test(before) ? before : null;
    // scan message pages until one page of matching items is full (or history ends)
    for (let round = 0; round < 6 && items.length < MAX_ITEMS; round++) {
      const qb = this.em
        .createQueryBuilder(Message, 'm')
        .leftJoinAndSelect('m.author', 'a')
        .where('m.channelId = :channelId', { channelId })
        .andWhere('m.attachments IS NOT NULL')
        .andWhere('m.deletedAt IS NULL')
        .orderBy('m.createdAt', 'DESC')
        .addOrderBy('m.id', 'DESC')
        .take(PAGE_MESSAGES);
      if (cursor) {
        qb.andWhere('(m.createdAt, m.id) < (SELECT c."createdAt", c.id FROM messages c WHERE c.id = :cid)', { cid: cursor });
      }
      const rows = await qb.getMany();
      if (rows.length === 0) {
        cursor = null;
        break;
      }
      for (const m of rows) {
        for (const att of m.attachments ?? []) {
          if (attachmentKind(att.contentType, att.filename, att.voice) !== kind) continue;
          items.push({
            messageId: m.id,
            channelId: m.channelId,
            authorId: m.authorId,
            authorName: m.author?.displayName ?? 'Üye',
            createdAt: m.createdAt.toISOString(),
            attachment: { id: att.id, url: att.url, filename: att.filename, contentType: att.contentType, size: att.size },
          });
        }
      }
      cursor = rows[rows.length - 1]!.id;
      if (rows.length < PAGE_MESSAGES) {
        cursor = null;
        break;
      }
    }
    return { items, nextCursor: cursor };
  }
}
