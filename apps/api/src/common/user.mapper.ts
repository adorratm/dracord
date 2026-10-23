import type {
  PublicUser,
  PresenceStatus,
  UserActivity,
  UserActivitySource,
} from '@dracord/types';
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

const PRIORITY: Record<UserActivitySource, number> = {
  dracord: 3,
  desktop: 2,
  spotify: 1,
  manual: 0,
};

type ActivityBag = {
  _v: 2;
  bySource: Partial<Record<UserActivitySource, UserActivity>>;
};

function parseActivityBag(raw: unknown): ActivityBag {
  if (!raw || typeof raw !== 'object') return { _v: 2, bySource: {} };
  const o = raw as Record<string, unknown>;
  if (o._v === 2 && o.bySource && typeof o.bySource === 'object') {
    return {
      _v: 2,
      bySource: o.bySource as Partial<Record<UserActivitySource, UserActivity>>,
    };
  }
  if (
    typeof o.type === 'string' &&
    typeof o.name === 'string' &&
    typeof o.source === 'string'
  ) {
    return {
      _v: 2,
      bySource: { [o.source as UserActivitySource]: o as unknown as UserActivity },
    };
  }
  return { _v: 2, bySource: {} };
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

function resolveActivities(
  user: User,
  forSelf: boolean,
): UserActivity[] {
  const bag = parseActivityBag(user.liveActivity);
  const out: UserActivity[] = [];
  for (const act of Object.values(bag.bySource)) {
    if (!act) continue;
    const filtered = forSelf
      ? isExpired(act)
        ? null
        : act
      : filterUserActivity(user, act);
    if (filtered) out.push(filtered);
  }
  out.sort((a, b) => (PRIORITY[b.source] ?? 0) - (PRIORITY[a.source] ?? 0));
  return out;
}

export function toPublicUser(
  user: User,
  opts?: { viewerId?: string | null },
): PublicUser {
  const viewerId = opts?.viewerId;
  const isSelf = !viewerId || viewerId === user.id;
  const activities = resolveActivities(user, isSelf);
  const activity = activities[0] ?? null;

  const base: PublicUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: mapUserStatus(user.status),
    customStatus: user.customStatus ?? null,
    activity,
    activities: activities.length ? activities : null,
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
