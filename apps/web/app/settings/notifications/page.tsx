'use client';

import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useAuth } from '@/components/AuthProvider';
import { useUserPreferences } from '@/lib/user-preferences';
import { subscribeWebPush, unsubscribeWebPush } from '@/lib/web-push';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function NotificationsSettingsPage() {
  const { client } = useAuth();
  const { prefs, setSection } = useUserPreferences();
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [vapidReady, setVapidReady] = useState<boolean | null>(null);

  useEffect(() => {
    void client
      .getPushVapidPublicKey()
      .then((m) => setVapidReady(Boolean(m.enabled && m.publicKey)))
      .catch(() => setVapidReady(false));
  }, [client]);

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

  const togglePush = async (next: boolean) => {
    setPushBusy(true);
    setPushNote(null);
    try {
      if (next) {
        const res = await subscribeWebPush(client);
        if (!res.ok) {
          setPushNote(res.reason ?? 'Push açılamadı');
          setSection('notifications', { pushEnabled: false });
          return;
        }
        setSection('notifications', { pushEnabled: true, desktopEnabled: true });
        setPushNote('Push aboneliği aktif');
      } else {
        await unsubscribeWebPush(client);
        setSection('notifications', { pushEnabled: false });
      }
    } catch (err) {
      setPushNote(err instanceof Error ? err.message : 'Push hatası');
      setSection('notifications', { pushEnabled: false });
    } finally {
      setPushBusy(false);
    }
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
          label="Web push (sekme kapalı)"
          description="Sekme tamamen kapalıyken de mention/DM bildirimi al. VAPID anahtarları sunucuda gerekir."
          checked={Boolean(prefs.notifications.pushEnabled)}
          onChange={(v) => void togglePush(v)}
          disabled={pushBusy || vapidReady === false}
        />
        {vapidReady === false && (
          <SettingsNote>
            Sunucuda VAPID yapılandırılmamış — `apps/api/.env` içinde VAPID_* anahtarlarını
            kontrol et ve API’yi yeniden başlat.
          </SettingsNote>
        )}
        {vapidReady === true && !prefs.notifications.pushEnabled && (
          <SettingsNote>Sunucu push’a hazır. Açmak için yukarıdaki anahtarı kullan.</SettingsNote>
        )}
        {pushNote && <SettingsNote>{pushNote}</SettingsNote>}
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
          {vapidReady != null && <> · VAPID: {vapidReady ? 'hazır' : 'kapalı'}</>}
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
