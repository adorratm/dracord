import type { PublicUser, PresenceStatus } from '@dracord/types';
import type { User } from '@/database/entities/user.entity';
import type { UserStatus } from '@/database/enums';

export function mapUserStatus(status: UserStatus): PresenceStatus {
  return status;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: mapUserStatus(user.status),
    customStatus: user.customStatus ?? null,
    usernameConfirmed: user.usernameConfirmed !== false,
    bannerColor: user.bannerColor,
    bannerUrl: user.bannerUrl,
    bio: user.bio,
    accentColor: user.accentColor ?? user.bannerColor,
    socialLinks: user.socialLinks as PublicUser['socialLinks'],
    censorLinkPreviews: Boolean(user.censorLinkPreviews),
    isBot: Boolean(user.isBot),
  };
}
