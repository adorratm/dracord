import type { PublicUser, PresenceStatus, UserActivity } from '@dracord/types';
import type { User } from '@/database/entities/user.entity';
import type { UserStatus } from '@/database/enums';
import { mergeClientSettings } from '@/users/client-settings';

export function mapUserStatus(status: UserStatus): PresenceStatus {
  return status;
}

function isExpired(activity: UserActivity | null | undefined): boolean {
  if (!activity?.expiresAt) return false;
  return new Date(activity.expiresAt).getTime() < Date.now();
}

/** Başkalarına gösterilecek aktivite (gizlilik + TTL) */
export function filterUserActivity(
  user: User,
  activity: UserActivity | null | undefined,
): UserActivity | null {
  if (!activity || isExpired(activity)) return null;
  const settings = mergeClientSettings(user.clientSettings);
  if (!settings.activity.displayActivity) return null;
  if (activity.source === 'dracord' && !settings.activity.shareGames) return null;
  if (activity.source === 'spotify' && settings.activity.shareSpotify === false) {
    return null;
  }
  if (
    activity.source === 'desktop' &&
    settings.activity.shareDesktopActivity === false
  ) {
    return null;
  }
  return activity;
}

export function toPublicUser(
  user: User,
  opts?: { viewerId?: string | null },
): PublicUser {
  const rawActivity = (user.liveActivity as UserActivity | null) ?? null;
  const viewerId = opts?.viewerId;
  const isSelf = !viewerId || viewerId === user.id;
  const activity = isSelf
    ? isExpired(rawActivity)
      ? null
      : rawActivity
    : filterUserActivity(user, rawActivity);

  const base: PublicUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: mapUserStatus(user.status),
    customStatus: user.customStatus ?? null,
    activity,
    usernameConfirmed: user.usernameConfirmed !== false,
    bannerColor: user.bannerColor,
    bannerUrl: user.bannerUrl,
    bio: user.bio,
    accentColor: user.accentColor ?? user.bannerColor,
    socialLinks: user.socialLinks as PublicUser['socialLinks'],
    censorLinkPreviews: Boolean(user.censorLinkPreviews),
    isBot: Boolean(user.isBot),
  };

  if (isSelf) {
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
