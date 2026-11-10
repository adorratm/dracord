import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { E2EE_LIMITS, SocketEvents, type ChannelE2eeDto, type E2eeDeviceDto } from '@dracord/types';
import { Channel } from '@/database/entities/channel.entity';
import { DMChannel } from '@/database/entities/dm-channel.entity';
import { DMChannelMember } from '@/database/entities/dm-channel-member.entity';
import { E2eeDevice } from '@/database/entities/e2ee-device.entity';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';

const toDto = (d: E2eeDevice): E2eeDeviceDto => ({
  id: d.id,
  userId: d.userId,
  publicKey: d.publicKey,
  name: d.name,
  platform: d.platform,
  createdAt: d.createdAt.toISOString(),
  lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
});

/** E3 — cihaz anahtarları + DM şifreleme durumu. Sunucu gizli anahtar ya da düz metin görmez. */
@Injectable()
export class E2eeService {
  constructor(
    private readonly em: EntityManager,
    private readonly broadcast: SocketBroadcastService,
  ) {}

  async listMine(userId: string) {
    const rows = await this.em.find(E2eeDevice, { where: { userId }, order: { createdAt: 'ASC' } });
    return rows.map(toDto);
  }

  async register(userId: string, body: { publicKey?: string; name?: string; platform?: string }) {
    const pk = String(body?.publicKey ?? '');
    let raw: Buffer;
    try {
      raw = Buffer.from(pk, 'base64');
    } catch {
      throw new BadRequestException('Geçersiz anahtar');
    }
    if (raw.length !== 32 || raw.toString('base64') !== pk) throw new BadRequestException('Geçersiz anahtar');
    const existing = await this.em.findOne(E2eeDevice, { where: { userId, publicKey: pk } });
    if (existing) return toDto(existing);
    const count = await this.em.count(E2eeDevice, { where: { userId } });
    if (count >= E2EE_LIMITS.devicesPerUser) {
      throw new BadRequestException(`En fazla ${E2EE_LIMITS.devicesPerUser} şifreleme cihazı olabilir; eskileri Ayarlar'dan kaldır`);
    }
    const platform = /^(web|desktop|mobile)$/.test(String(body?.platform)) ? String(body.platform) : null;
    const name = String(body?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 64) || 'Cihaz';
    const row = await this.em.save(E2eeDevice, this.em.create(E2eeDevice, { userId, publicKey: pk, name, platform, lastSeenAt: new Date() }));
    await this.notifyContacts(userId);
    return toDto(row);
  }

  async remove(userId: string, id: string) {
    const res = await this.em.delete(E2eeDevice, { id, userId });
    if (!res.affected) throw new NotFoundException('Cihaz bulunamadı');
    await this.notifyContacts(userId);
    return this.listMine(userId);
  }

  /** Cihaz listesi değişti → şifreli DM'lerdeki karşı taraflar anahtar önbelleğini yenilesin */
  private async notifyContacts(userId: string) {
    const mine = await this.em.find(DMChannelMember, { where: { userId }, select: { dmChannelId: true } });
    if (!mine.length) return;
    const dmIds = mine.map((m) => m.dmChannelId);
    const enabled = await this.em.find(DMChannel, { where: { id: In(dmIds), e2eeEnabled: true }, select: { id: true } });
    if (!enabled.length) return;
    const members = await this.em.find(DMChannelMember, { where: { dmChannelId: In(enabled.map((d) => d.id)) }, select: { userId: true, dmChannelId: true } });
    const chans = await this.em.find(Channel, { where: { dmChannelId: In(enabled.map((d) => d.id)) }, select: { id: true, dmChannelId: true } });
    for (const c of chans) {
      const ids = [...new Set(members.filter((m) => m.dmChannelId === c.dmChannelId).map((m) => m.userId))];
      this.broadcast.emitToUsers(ids, SocketEvents.DM_E2EE_UPDATE, { channelId: c.id, devicesChangedBy: userId });
    }
  }

  private async dmOf(channelId: string, userId: string) {
    const ch = await this.em.findOne(Channel, { where: { id: channelId }, select: { id: true, dmChannelId: true } });
    if (!ch?.dmChannelId) throw new BadRequestException('Uçtan uca şifreleme yalnız özel mesajlarda');
    const members = await this.em.find(DMChannelMember, { where: { dmChannelId: ch.dmChannelId }, select: { userId: true } });
    if (!members.some((m) => m.userId === userId)) throw new ForbiddenException('Bu sohbetin üyesi değilsin');
    const dm = await this.em.findOneOrFail(DMChannel, { where: { id: ch.dmChannelId } });
    return { ch, dm, memberIds: [...new Set(members.map((m) => m.userId))] };
  }

  async channelInfo(channelId: string, userId: string): Promise<ChannelE2eeDto> {
    const { ch, dm, memberIds } = await this.dmOf(channelId, userId);
    const devices = memberIds.length ? await this.em.find(E2eeDevice, { where: { userId: In(memberIds) }, order: { createdAt: 'ASC' } }) : [];
    return {
      channelId: ch.id,
      enabled: dm.e2eeEnabled,
      enabledById: dm.e2eeEnabledById,
      enabledAt: dm.e2eeEnabledAt?.toISOString() ?? null,
      members: memberIds.map((uid) => ({
        userId: uid,
        devices: devices.filter((d) => d.userId === uid).map((d) => ({ id: d.id, publicKey: d.publicKey, name: d.name, createdAt: d.createdAt.toISOString() })),
      })),
    };
  }

  async setEnabled(channelId: string, userId: string, enabled: boolean): Promise<ChannelE2eeDto> {
    const { dm, memberIds } = await this.dmOf(channelId, userId);
    if (enabled) {
      // Her katılımcının en az bir cihaz anahtarı olmalı (yoksa ona mesaj okunamaz)
      const have = await this.em.find(E2eeDevice, { where: { userId: In(memberIds) }, select: { userId: true } });
      const missing = memberIds.filter((id) => !have.some((d) => d.userId === id));
      if (missing.length) {
        throw new BadRequestException('Katılımcılardan biri henüz şifrelemeyi destekleyen bir sürüm açmadı. Uygulamayı açtıklarında tekrar dene.');
      }
    }
    dm.e2eeEnabled = enabled;
    dm.e2eeEnabledById = userId;
    dm.e2eeEnabledAt = new Date();
    await this.em.save(DMChannel, dm);
    const info = await this.channelInfo(channelId, userId);
    this.broadcast.emitToUsers(memberIds, SocketEvents.DM_E2EE_UPDATE, { channelId, enabled, by: userId });
    return info;
  }
}
