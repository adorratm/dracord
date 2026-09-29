import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, ILike } from 'typeorm';
import type { PublicUser, SocialLinks } from '@dracord/types';
import { toPublicUser } from '../common/user.mapper';
import { Friendship } from '../database/entities/friendship.entity';
import { User } from '../database/entities/user.entity';
import { FriendshipStatus } from '../database/enums';

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bannerColor?: string | null;
  accentColor?: string | null;
  socialLinks?: SocialLinks | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<PublicUser> {
    const user = await this.em.findOne(User, { where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return toPublicUser(user);
  }

  async findByUsername(username: string): Promise<PublicUser> {
    const user = await this.em.findOne(User, {
      where: { username: username.toLowerCase() },
    });
    if (!user) throw new NotFoundException('User not found');
    return toPublicUser(user);
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
      toPublicUser(row.userId === userId ? row.friend : row.user),
    );
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
    await this.em.save(User, user);
    return toPublicUser(user);
  }
}
