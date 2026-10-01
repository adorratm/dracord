'use client';

import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

export default function SystemSettingsPage() {
  const { prefs, setSection } = useUserPreferences();
  const isElectron =
    typeof window !== 'undefined' &&
    Boolean(
      (window as Window & { dracordDesktop?: { isElectron?: boolean } }).dracordDesktop
        ?.isElectron,
    );

  return (
    <SettingsPage
      title="Sistem"
      description="Masaüstü ve performans tercihleri."
    >
      <SettingsSection>
        <SettingsToggle
          label="Başlangıçta aç"
          description="İşletim sistemi açılışında Dracord başlar."
          checked={prefs.system.openOnStartup}
          disabled={!isElectron}
          onChange={(v) => setSection('system', { openOnStartup: v })}
        />
        <SettingsToggle
          label="Donanım hızlandırma"
          description="Kapalıyken ağır efektler kapatılır."
          checked={prefs.system.hardwareAcceleration}
          onChange={(v) => setSection('system', { hardwareAcceleration: v })}
        />
        <SettingsToggle
          label="Sistem tepsisine küçült"
          description="Kapatırken pencere gizlenir."
          checked={prefs.system.minimizeToTray}
          disabled={!isElectron}
          onChange={(v) => setSection('system', { minimizeToTray: v })}
        />
        <SettingsToggle
          label="Otomatik güncelleme"
          checked={prefs.system.autoUpdate}
          disabled={!isElectron}
          onChange={(v) => setSection('system', { autoUpdate: v })}
        />
      </SettingsSection>
      <SettingsSection>
        <SettingsNote>
          {isElectron
            ? 'Electron algılandı — başlangıç ve tepsi tercihleri anında uygulanır.'
            : 'Web’de yalnızca donanım hızlandırma etkisi vardır. Başlangıç, tepsi ve güncelleme masaüstü uygulamasında çalışır.'}
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
