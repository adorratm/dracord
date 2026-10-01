import type { PublicUser, PresenceStatus } from '@dracord/types';
import type { User } from '@/database/entities/user.entity';
import type { UserStatus } from '@/database/enums';
import { mergeClientSettings } from '@/users/client-settings';

export function mapUserStatus(status: UserStatus): PresenceStatus {
  return status;
}

export function toPublicUser(
  user: User,
  opts?: { viewerId?: string | null },
): PublicUser {
  const base: PublicUser = {
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

  const viewerId = opts?.viewerId;
  if (!viewerId || viewerId === user.id) {
    base.twoFactorEnabled = Boolean(user.totpEnabled);
  }

  if (viewerId && viewerId !== user.id) {
    const privacy = mergeClientSettings(user.clientSettings).privacy;
    if (privacy.showBio === false) base.bio = null;
    if (privacy.showSocialLinks === false) base.socialLinks = null;
    if (privacy.showBanner === false) {
      base.bannerUrl = null;
      base.bannerColor = null;
    }
    if (privacy.showCustomStatus === false) base.customStatus = null;
  }

  return base;
}
