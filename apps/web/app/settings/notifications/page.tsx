'use client';

import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';
import Link from 'next/link';

export default function NotificationsSettingsPage() {
  const { prefs, setSection } = useUserPreferences();

  const toggleDesktop = async (next: boolean) => {
    if (next && typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission === 'denied') {
        setSection('notifications', { desktopEnabled: false });
        return;
      }
    }
    setSection('notifications', { desktopEnabled: next });
  };

  return (
    <SettingsPage
      title="Bildirimler"
      description="Masaüstü, ses ve rozet bildirimlerini yönet."
    >
      <SettingsSection title="Masaüstü">
        <SettingsToggle
          label="Tarayıcı / masaüstü bildirimleri"
          description="Sekme arka plandayken sistem bildirimi göster. İlk açılışta tarayıcı izni istenir."
          checked={prefs.notifications.desktopEnabled}
          onChange={(v) => void toggleDesktop(v)}
        />
        <SettingsToggle
          label="Bildirim sesi"
          checked={prefs.notifications.soundEnabled}
          onChange={(v) => setSection('notifications', { soundEnabled: v })}
        />
        <SettingsToggle
          label="Okunmamış rozeti"
          checked={prefs.notifications.unreadBadge}
          onChange={(v) => setSection('notifications', { unreadBadge: v })}
        />
      </SettingsSection>
      <SettingsSection title="Filtreler">
        <SettingsToggle
          label="Yalnızca bahsetmeler"
          description="Sadece @bahsetme ve arkadaşlık isteklerini al."
          checked={prefs.notifications.mentionsOnly}
          onChange={(v) => setSection('notifications', { mentionsOnly: v })}
        />
        <SettingsToggle
          label="Sessiz saatler (23:00–07:00)"
          description="Bu saatlerde ses ve masaüstü bildirimi bastırılır."
          checked={prefs.notifications.quietHours}
          onChange={(v) => setSection('notifications', { quietHours: v })}
        />
      </SettingsSection>
      <SettingsSection title="Yönetim">
        <p className="font-body-sm text-on-surface-variant px-1">
          Okunmamış bildirimleri, sessize alınan kullanıcı/sunucuları ve geçmişi{' '}
          <Link href="/notifications" className="text-primary-container hover:underline">
            Bildirimler
          </Link>{' '}
          sayfasından yönetebilirsin.
        </p>
      </SettingsSection>
      <SettingsSection>
        <SettingsNote>
          Tarayıcı izni:{' '}
          {typeof Notification !== 'undefined' ? Notification.permission : 'desteklenmiyor'}
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
