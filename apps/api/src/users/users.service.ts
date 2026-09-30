import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EntityManager, ILike, Not } from 'typeorm';
import type { ClientSettings, PublicUser, SocialLinks } from '@dracord/types';
import { toPublicUser } from '@/common/user.mapper';
import { Friendship } from '@/database/entities/friendship.entity';
import { Guild } from '@/database/entities/guild.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { Session } from '@/database/entities/session.entity';
import { User } from '@/database/entities/user.entity';
import { FriendshipStatus } from '@/database/enums';
import { SearchIndexerService } from '@/search/search-indexer.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { NotificationsRealtimeService } from '@/notifications/notifications-realtime.service';
import { mergeClientSettings } from './client-settings';
import * as bcrypt from 'bcrypt';

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bannerColor?: string | null;
  accentColor?: string | null;
  socialLinks?: SocialLinks | null;
  censorLinkPreviews?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly em: EntityManager,
    private readonly indexer: SearchIndexerService,
    private readonly notifications: NotificationsService,
    private readonly notificationsRealtime: NotificationsRealtimeService,
  ) {}

  async findById(id: string, viewerId?: string): Promise<PublicUser> {
    const user = await this.em.findOne(User, { where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return toPublicUser(user, { viewerId });
  }

  async findByUsername(username: string, viewerId?: string): Promise<PublicUser> {
    const user = await this.em.findOne(User, {
      where: { username: username.toLowerCase() },
    });
    if (!user) throw new NotFoundException('User not found');
    return toPublicUser(user, { viewerId });
  }

  async search(query: string, limit = 20): Promise<PublicUser[]> {
    const users = await this.em.find(User, {
      where: [
        { username: ILike(`%${query}%`) },
        { displayName: ILike(`%${query}%`) },
      ],
      take: limit,
    });
    return users.map(toPublicUser);
  }

  async listFriends(userId: string): Promise<PublicUser[]> {
    const rows = await this.em.find(Friendship, {
      where: [
        { userId, status: FriendshipStatus.ACCEPTED },
        { friendId: userId, status: FriendshipStatus.ACCEPTED },
      ],
      relations: { user: true, friend: true },
    });
    return rows.map((row) =>
      toPublicUser(row.userId === userId ? row.friend : row.user, { viewerId: userId }),
    );
  }

  async listBlocked(userId: string): Promise<PublicUser[]> {
    const rows = await this.em.find(Friendship, {
      where: { userId, status: FriendshipStatus.BLOCKED },
      relations: { friend: true },
    });
    return rows.filter((r) => r.friend).map((r) => toPublicUser(r.friend, { viewerId: userId }));
  }

  async listPendingFriends(userId: string): Promise<{
    incoming: PublicUser[];
    outgoing: PublicUser[];
  }> {
    const [incomingRows, outgoingRows] = await Promise.all([
      this.em.find(Friendship, {
        where: { friendId: userId, status: FriendshipStatus.PENDING },
        relations: { user: true },
      }),
      this.em.find(Friendship, {
        where: { userId, status: FriendshipStatus.PENDING },
        relations: { friend: true },
      }),
    ]);
    return {
      incoming: incomingRows
        .filter((r) => r.user)
        .map((r) => toPublicUser(r.user, { viewerId: userId })),
      outgoing: outgoingRows
        .filter((r) => r.friend)
        .map((r) => toPublicUser(r.friend, { viewerId: userId })),
    };
  }

  private async assertNotBlocked(a: string, b: string) {
    const blocked = await this.em.findOne(Friendship, {
      where: [
        { userId: a, friendId: b, status: FriendshipStatus.BLOCKED },
        { userId: b, friendId: a, status: FriendshipStatus.BLOCKED },
      ],
    });
    if (blocked) throw new ForbiddenException('Bu kullanıcı ile etkileşim engelli');
  }

  async sendFriendRequest(userId: string, targetId: string): Promise<{ ok: true; status: string }> {
    if (userId === targetId) {
      throw new BadRequestException('Kendine istek gönderemezsin');
    }
    const target = await this.em.findOne(User, { where: { id: targetId } });
    if (!target) throw new NotFoundException('Kullanıcı bulunamadı');
    await this.assertNotBlocked(userId, targetId);

    const privacy = mergeClientSettings(target.clientSettings ?? null);
    if (privacy.privacy?.allowFriendRequests === false) {
      throw new ForbiddenException('Bu kullanıcı arkadaşlık isteği kabul etmiyor');
    }

    const existing = await this.em.findOne(Friendship, {
      where: { userId, friendId: targetId },
    });
    if (existing?.status === FriendshipStatus.BLOCKED) {
      throw new ForbiddenException('Önce engeli kaldırmalısın');
    }
    if (existing?.status === FriendshipStatus.ACCEPTED) {
      throw new ConflictException('Zaten arkadaşsınız');
    }
    if (existing?.status === FriendshipStatus.PENDING) {
      return { ok: true, status: 'PENDING' };
    }

    // Karşı taraf daha önce istek göndermişse otomatik kabul
    const reverse = await this.em.findOne(Friendship, {
      where: { userId: targetId, friendId: userId },
    });
    if (reverse?.status === FriendshipStatus.PENDING) {
      reverse.status = FriendshipStatus.ACCEPTED;
      await this.em.save(Friendship, reverse);
      const me = await this.em.findOne(User, { where: { id: userId } });
      const created = await this.notifications.createMany([
        {
          userId: targetId,
          type: 'FRIEND',
          title: 'Arkadaşlık kabul edildi',
          body: `${me?.displayName ?? 'Birisi'} arkadaşlık isteğini kabul etti`,
          link: '/channels/@me?tab=friends',
          actorId: userId,
        },
      ]);
      this.notificationsRealtime.emitMany(created);
      return { ok: true, status: 'ACCEPTED' };
    }
    if (reverse?.status === FriendshipStatus.ACCEPTED) {
      throw new ConflictException('Zaten arkadaşsınız');
    }

    await this.em.save(
      Friendship,
      this.em.create(Friendship, {
        userId,
        friendId: targetId,
        status: FriendshipStatus.PENDING,
      }),
    );
    const me = await this.em.findOne(User, { where: { id: userId } });
    const created = await this.notifications.createMany([
      {
        userId: targetId,
        type: 'FRIEND',
        title: 'Yeni arkadaşlık isteği',
        body: `${me?.displayName ?? 'Birisi'} sana arkadaşlık isteği gönderdi`,
        link: '/channels/@me?tab=pending',
        actorId: userId,
      },
    ]);
    this.notificationsRealtime.emitMany(created);
    return { ok: true, status: 'PENDING' };
  }

  async acceptFriendRequest(userId: string, fromUserId: string): Promise<{ ok: true }> {
    const row = await this.em.findOne(Friendship, {
      where: {
        userId: fromUserId,
        friendId: userId,
        status: FriendshipStatus.PENDING,
      },
    });
    if (!row) throw new NotFoundException('Bekleyen istek yok');
    await this.assertNotBlocked(userId, fromUserId);
    row.status = FriendshipStatus.ACCEPTED;
    await this.em.save(Friendship, row);
    const me = await this.em.findOne(User, { where: { id: userId } });
    const created = await this.notifications.createMany([
      {
        userId: fromUserId,
        type: 'FRIEND',
        title: 'Arkadaşlık kabul edildi',
        body: `${me?.displayName ?? 'Birisi'} arkadaşlık isteğini kabul etti`,
        link: '/channels/@me?tab=friends',
        actorId: userId,
      },
    ]);
    this.notificationsRealtime.emitMany(created);
    return { ok: true };
  }

  async declineFriendRequest(userId: string, otherUserId: string): Promise<{ ok: true }> {
    // Gelen isteği reddet veya giden isteği iptal et
    const incoming = await this.em.findOne(Friendship, {
      where: {
        userId: otherUserId,
        friendId: userId,
        status: FriendshipStatus.PENDING,
      },
    });
    if (incoming) {
      await this.em.remove(Friendship, incoming);
      return { ok: true };
    }
    const outgoing = await this.em.findOne(Friendship, {
      where: {
        userId,
        friendId: otherUserId,
        status: FriendshipStatus.PENDING,
      },
    });
    if (outgoing) {
      await this.em.remove(Friendship, outgoing);
      return { ok: true };
    }
    throw new NotFoundException('Bekleyen istek yok');
  }

  async blockUser(userId: string, targetId: string): Promise<{ ok: true }> {
    if (userId === targetId) {
      throw new BadRequestException('Kendini engelleyemezsin');
    }
    const target = await this.em.findOne(User, { where: { id: targetId } });
    if (!target) throw new NotFoundException('Kullanıcı bulunamadı');

    let row = await this.em.findOne(Friendship, {
      where: { userId, friendId: targetId },
    });
    if (!row) {
      row = this.em.create(Friendship, {
        userId,
        friendId: targetId,
        status: FriendshipStatus.BLOCKED,
      });
    } else {
      row.status = FriendshipStatus.BLOCKED;
    }
    await this.em.save(Friendship, row);

    // Karşı yön kabul edilmişse arkadaşlığı düşür
    const reverse = await this.em.findOne(Friendship, {
      where: { userId: targetId, friendId: userId },
    });
    if (reverse && reverse.status === FriendshipStatus.ACCEPTED) {
      reverse.status = FriendshipStatus.PENDING;
      await this.em.save(Friendship, reverse);
    }
    return { ok: true };
  }

  async unblockUser(userId: string, targetId: string): Promise<{ ok: true }> {
    const row = await this.em.findOne(Friendship, {
      where: { userId, friendId: targetId, status: FriendshipStatus.BLOCKED },
    });
    if (row) await this.em.remove(Friendship, row);
    return { ok: true };
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (input.displayName != null) user.displayName = input.displayName.trim().slice(0, 32);
    if (input.bio !== undefined) user.bio = input.bio?.slice(0, 190) ?? null;
    if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;
    if (input.bannerUrl !== undefined) user.bannerUrl = input.bannerUrl;
    if (input.bannerColor !== undefined) user.bannerColor = input.bannerColor;
    if (input.accentColor !== undefined) user.accentColor = input.accentColor;
    if (input.socialLinks !== undefined) {
      user.socialLinks = input.socialLinks as Record<string, string> | null;
    }
    if (input.censorLinkPreviews !== undefined) {
      user.censorLinkPreviews = Boolean(input.censorLinkPreviews);
    }
    await this.em.save(User, user);
    void this.indexer.indexUser(user).catch(() => undefined);
    return toPublicUser(user);
  }

  normalizeUsername(raw: string): string {
    return raw
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 32);
  }

  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const normalized = this.normalizeUsername(username);
    if (normalized.length < 2 || normalized.length > 32) return false;
    const existing = await this.em.findOne(User, {
      where: excludeUserId
        ? { username: normalized, id: Not(excludeUserId) }
        : { username: normalized },
    });
    return !existing;
  }

  suggestUsernameFromDisplayName(displayName: string): string {
    const base = this.normalizeUsername(displayName.replace(/\s+/g, '')) || 'kullanici';
    return base.slice(0, 24);
  }

  async confirmUsername(userId: string, rawUsername: string): Promise<PublicUser> {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const username = this.normalizeUsername(rawUsername);
    if (username.length < 2) {
      throw new BadRequestException('Kullanıcı adı en az 2 karakter olmalı');
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      throw new BadRequestException('Yalnızca a-z, 0-9 ve alt çizgi kullanılabilir');
    }

    const taken = await this.em.findOne(User, {
      where: { username, id: Not(userId) },
    });
    if (taken) {
      throw new ConflictException('Bu kullanıcı adı zaten alınmış');
    }

    user.username = username;
    user.usernameConfirmed = true;
    await this.em.save(User, user);
    await this.ensureSeedGuildMembership(userId);
    void this.indexer.indexUser(user).catch(() => undefined);
    return toPublicUser(user);
  }

  async getClientSettings(userId: string): Promise<ClientSettings> {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return mergeClientSettings(user.clientSettings);
  }

  async updateClientSettings(
    userId: string,
    patch: Partial<ClientSettings>,
  ): Promise<ClientSettings> {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const current = mergeClientSettings(user.clientSettings);
    const merged: Record<string, unknown> = { ...current };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      const cur = merged[k];
      if (
        v &&
        typeof v === 'object' &&
        !Array.isArray(v) &&
        cur &&
        typeof cur === 'object' &&
        !Array.isArray(cur)
      ) {
        merged[k] = { ...(cur as object), ...(v as object) };
      } else {
        merged[k] = v;
      }
    }
    const next = mergeClientSettings(merged);
    user.clientSettings = next as unknown as Record<string, unknown>;
    await this.em.save(User, user);
    return next;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: true }> {
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      throw new BadRequestException('Geçersiz şifre');
    }
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.passwordHash) {
      throw new BadRequestException('Bu hesap için şifre tanımlı değil (OAuth)');
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Mevcut şifre yanlış');
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.em.save(User, user);
    return { ok: true };
  }

  async deactivateAccount(userId: string, password?: string): Promise<{ ok: true }> {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.passwordHash && password) {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) throw new UnauthorizedException('Şifre yanlış');
    }
    user.disabledAt = new Date();
    await this.em.save(User, user);
    await this.em.delete(Session, { userId });
    return { ok: true };
  }

  async reactivateAccount(userId: string): Promise<PublicUser> {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.disabledAt = null;
    await this.em.save(User, user);
    return toPublicUser(user);
  }

  /** Hedef kullanıcıya DM açılabilir mi? */
  async assertCanOpenDm(fromUserId: string, toUserId: string): Promise<void> {
    const target = await this.em.findOne(User, { where: { id: toUserId } });
    if (!target) throw new NotFoundException('Kullanıcı bulunamadı');
    if (target.disabledAt) {
      throw new ForbiddenException('Bu hesap kullanılamıyor');
    }
    const settings = mergeClientSettings(target.clientSettings);
    const level = settings.messaging.whoCanDm ?? settings.privacy.dmFilter;
    if (level === 'nobody') {
      throw new ForbiddenException('Bu kullanıcı DM kabul etmiyor');
    }
    const friendship = await this.em.findOne(Friendship, {
      where: [
        { userId: fromUserId, friendId: toUserId, status: FriendshipStatus.ACCEPTED },
        { userId: toUserId, friendId: fromUserId, status: FriendshipStatus.ACCEPTED },
      ],
    });
    const areFriends = Boolean(friendship);
    if (level === 'friends' && !areFriends) {
      throw new ForbiddenException('Yalnızca arkadaşlarınla DM açabilirsin');
    }
    // everyone: arkadaşlık şart değil
  }

  private async ensureSeedGuildMembership(userId: string): Promise<void> {
    const seedGuild = await this.em.findOne(Guild, {
      where: { id: 'seed-dracula-realm' },
    });
    if (!seedGuild) return;
    const membership = await this.em.findOne(GuildMember, {
      where: { guildId: seedGuild.id, userId },
    });
    if (!membership) {
      await this.em.save(
        GuildMember,
        this.em.create(GuildMember, {
          guildId: seedGuild.id,
          userId,
        }),
      );
    }
  }
}
