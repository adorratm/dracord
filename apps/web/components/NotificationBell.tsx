'use client';

import { NotificationBell as SharedNotificationBell } from '@dracord/ui';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useUserPreferences } from '@/lib/user-preferences';

/** Gelen kutusu — ortak bileşen @dracord/ui'da */
export function NotificationBell() {
  const { client, user, ready } = useAuth();
  const { prefs } = useUserPreferences();
  const router = useRouter();
  return (
    <SharedNotificationBell
      client={client}
      user={user}
      ready={ready}
      prefs={prefs}
      onNavigateLink={(link) => router.push(link)}
      onOpenSettings={() => router.push('/settings/notifications')}
    />
  );
}
