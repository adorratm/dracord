import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DM_CALL_GUILD_ID,
  type DmCallMode,
  type DmCallPayload,
  type PublicUser,
} from '@dracord/types';
import Redis from 'ioredis';
import { EntityManager } from 'typeorm';
import { Channel } from '@/database/entities/channel.entity';
import { DMChannelMember } from '@/database/entities/dm-channel-member.entity';
import { Friendship } from '@/database/entities/friendship.entity';
import { User } from '@/database/entities/user.entity';
import { ChannelType, FriendshipStatus, UserStatus } from '@/database/enums';
import { toPublicUser } from '@/common/user.mapper';
import { ChatGateway } from '@/gateway/chat.gateway';
import { VoicePresenceService } from '@/voice/voice-presence.service';

type CallMeta = {
  channelId: string;
  mode: DmCallMode;
  startedBy: string;
  updatedAt: number;
};

@Injectable()
export class DmCallService implements OnModuleDestroy {
  private readonly redis: Redis | null;
  private readonly memory = new Map<string, CallMeta>();

  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
    private readonly presence: VoicePresenceService,
    private readonly chatGateway: ChatGateway,
  ) {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });
      void this.redis.connect().catch(() => undefined);
    } else {
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  private metaKey(channelId: string) {
    return `dmcall:meta:${channelId}`;
  }

  /** OFFLINE dışındaki durumlar aranabilir (ONLINE / IDLE / DND). */
  private assertUserCallable(user: User, label = 'Kullanıcı'): void {
    if (user.status === UserStatus.OFFLINE) {
      throw new BadRequestException(`${label} çevrimdışı — arama yapılamaz`);
    }
  }

  async getChannelForUser(channelId: string, userId: string): Promise<Channel> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel?.dmChannelId || channel.type !== ChannelType.TEXT) {
      throw new BadRequestException('Geçerli bir DM kanalı değil');
    }
    const member = await this.em.findOne(DMChannelMember, {
      where: { dmChannelId: channel.dmChannelId, userId },
    });
    if (!member) throw new ForbiddenException('Bu DM’nin üyesi değilsin');
    return channel;
  }

  async listMembers(channelId: string, userId: string): Promise<PublicUser[]> {
    const channel = await this.getChannelForUser(channelId, userId);
    const rows = await this.em.find(DMChannelMember, {
      where: { dmChannelId: channel.dmChannelId! },
      relations: { user: true },
    });
    return rows
      .map((r) => (r.user ? toPublicUser(r.user) : null))
      .filter((u): u is PublicUser => Boolean(u));
  }

  async addMember(
    channelId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<PublicUser[]> {
    const channel = await this.getChannelForUser(channelId, actorId);
    if (actorId === targetUserId) {
      throw new BadRequestException('Kendini ekleyemezsin');
    }
    const target = await this.em.findOne(User, { where: { id: targetUserId } });
    if (!target || target.isBot) throw new NotFoundException('Kullanıcı bulunamadı');

    const blocked = await this.em.findOne(Friendship, {
      where: [
        { userId: targetUserId, friendId: actorId, status: FriendshipStatus.BLOCKED },
        { userId: actorId, friendId: targetUserId, status: FriendshipStatus.BLOCKED },
      ],
    });
    if (blocked) throw new BadRequestException('Bu kullanıcı eklenemez');

    const existing = await this.em.findOne(DMChannelMember, {
      where: { dmChannelId: channel.dmChannelId!, userId: targetUserId },
    });
    if (!existing) {
      await this.em.save(
        this.em.create(DMChannelMember, {
          dmChannelId: channel.dmChannelId!,
          userId: targetUserId,
        }),
      );
    }
    return this.listMembers(channelId, actorId);
  }

  async removeMember(
    channelId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<PublicUser[]> {
    const channel = await this.getChannelForUser(channelId, actorId);
    const members = await this.em.find(DMChannelMember, {
      where: { dmChannelId: channel.dmChannelId! },
    });
    if (members.length <= 2 && targetUserId !== actorId) {
      throw new BadRequestException('1:1 DM’den karşı tarafı çıkaramazsın — aramadan ayır');
    }
    if (targetUserId === actorId && members.length <= 1) {
      throw new BadRequestException('Son üye çıkamaz');
    }
    const row = members.find((m) => m.userId === targetUserId);
    if (!row) throw new NotFoundException('Üye bulunamadı');
    await this.em.remove(DMChannelMember, row);
    // Varsa aramadan da çıkar
    await this.removeFromCall(channelId, actorId, targetUserId).catch(() => undefined);
    return this.listMembers(channelId, actorId);
  }

  async getActiveCall(channelId: string, userId: string) {
    await this.getChannelForUser(channelId, userId);
    const meta = await this.readMeta(channelId);
    const members = await this.presence.listChannel(DM_CALL_GUILD_ID, channelId);
    return {
      active: Boolean(meta) || members.length > 0,
      mode: meta?.mode ?? ('audio' as DmCallMode),
      startedBy: meta?.startedBy ?? null,
      participants: members,
    };
  }

  async startCall(
    channelId: string,
    userId: string,
    mode: DmCallMode,
  ): Promise<{ ok: true; mode: DmCallMode }> {
    const channel = await this.getChannelForUser(channelId, userId);
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });

    const members = await this.em.find(DMChannelMember, {
      where: { dmChannelId: channel.dmChannelId! },
      relations: { user: true },
    });
    const peers = members.filter((m) => m.userId !== userId);
    if (peers.length === 0) {
      throw new BadRequestException('Aranacak kimse yok');
    }
    const onlinePeers = peers.filter(
      (m) => m.user && m.user.status !== UserStatus.OFFLINE,
    );
    if (onlinePeers.length === 0) {
      throw new BadRequestException('Karşı taraf çevrimdışı — arama yapılamaz');
    }

    await this.writeMeta({
      channelId,
      mode: mode === 'video' ? 'video' : 'audio',
      startedBy: userId,
      updatedAt: Date.now(),
    });

    const payload: DmCallPayload = {
      action: 'ring',
      channelId,
      mode: mode === 'video' ? 'video' : 'audio',
      fromUserId: userId,
      fromDisplayName: user.displayName,
    };
    for (const m of onlinePeers) {
      this.chatGateway.emitToUser(m.userId, payload);
    }
    return { ok: true, mode: payload.mode };
  }

  async inviteToCall(
    channelId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<{ ok: true }> {
    const target = await this.em.findOne(User, { where: { id: targetUserId } });
    if (!target) throw new NotFoundException('Kullanıcı bulunamadı');
    this.assertUserCallable(target, target.displayName);

    await this.addMember(channelId, actorId, targetUserId);
    const meta = (await this.readMeta(channelId)) ?? {
      channelId,
      mode: 'audio' as DmCallMode,
      startedBy: actorId,
      updatedAt: Date.now(),
    };
    await this.writeMeta(meta);
    const actor = await this.em.findOneOrFail(User, { where: { id: actorId } });
    this.chatGateway.emitToUser(targetUserId, {
      action: 'invite',
      channelId,
      mode: meta.mode,
      fromUserId: actorId,
      fromDisplayName: actor.displayName,
      targetUserId,
    });
    return { ok: true };
  }

  async removeFromCall(
    channelId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<{ ok: true }> {
    await this.getChannelForUser(channelId, actorId);
    const payload = await this.presence.leave(
      DM_CALL_GUILD_ID,
      channelId,
      targetUserId,
    );
    if (payload) this.chatGateway.broadcastVoiceState(payload);
    this.chatGateway.emitToUser(targetUserId, {
      action: 'leave',
      channelId,
      mode: (await this.readMeta(channelId))?.mode ?? 'audio',
      fromUserId: actorId,
      targetUserId,
    });
    const remaining = await this.presence.listChannel(DM_CALL_GUILD_ID, channelId);
    if (remaining.length === 0) {
      await this.clearMeta(channelId);
      this.chatGateway.emitDmCallToChannel(channelId, {
        action: 'ended',
        channelId,
        mode: 'audio',
        fromUserId: actorId,
      });
    }
    return { ok: true };
  }

  async declineCall(channelId: string, userId: string): Promise<{ ok: true }> {
    const channel = await this.getChannelForUser(channelId, userId);
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });
    const members = await this.em.find(DMChannelMember, {
      where: { dmChannelId: channel.dmChannelId! },
    });
    const payload: DmCallPayload = {
      action: 'decline',
      channelId,
      mode: (await this.readMeta(channelId))?.mode ?? 'audio',
      fromUserId: userId,
      fromDisplayName: user.displayName,
    };
    for (const m of members) {
      if (m.userId === userId) continue;
      this.chatGateway.emitToUser(m.userId, payload);
    }
    return { ok: true };
  }

  async endCallIfEmpty(channelId: string): Promise<void> {
    const remaining = await this.presence.listChannel(DM_CALL_GUILD_ID, channelId);
    if (remaining.length === 0) await this.clearMeta(channelId);
  }

  private async readMeta(channelId: string): Promise<CallMeta | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(this.metaKey(channelId));
        if (!raw) return null;
        return JSON.parse(raw) as CallMeta;
      } catch {
        return null;
      }
    }
    return this.memory.get(channelId) ?? null;
  }

  private async writeMeta(meta: CallMeta): Promise<void> {
    if (this.redis) {
      await this.redis.set(this.metaKey(meta.channelId), JSON.stringify(meta), 'EX', 3600);
      return;
    }
    this.memory.set(meta.channelId, meta);
  }

  private async clearMeta(channelId: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(this.metaKey(channelId));
      return;
    }
    this.memory.delete(channelId);
  }
}
