import type { NotificationDto } from '@dracord/types';
import type { Href } from 'expo-router';

type AppRouter = {
  push: (href: Href) => void;
};

/** Web `link` path’lerini Expo Router rotalarına çevirir */
export function navigateFromNotification(
  router: AppRouter,
  n: NotificationDto,
): void {
  if (n.type === 'FRIEND') {
    router.push('/(app)/friends');
    return;
  }

  if (n.link) {
    const path = n.link.split('?')[0] ?? n.link;

    const meDm = path.match(/^\/channels\/(?:@me|me)\/([^/?#]+)/);
    if (meDm) {
      router.push('/(app)/dms');
      return;
    }
    if (path.startsWith('/channels/@me') || path.startsWith('/channels/me')) {
      router.push('/(app)/friends');
      return;
    }

    const ch = path.match(/^\/channels\/([^/]+)\/([^/?#]+)/);
    if (ch && ch[1] !== '@me' && ch[1] !== 'me') {
      router.push(`/(app)/channels/${ch[1]}/${ch[2]}`);
      return;
    }
  }

  if (n.guildId && n.channelId) {
    router.push(`/(app)/channels/${n.guildId}/${n.channelId}`);
    return;
  }

  if (n.type === 'DM' && n.channelId) {
    router.push('/(app)/dms');
  }
}
