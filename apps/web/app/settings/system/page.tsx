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
          description={
            isElectron
              ? 'İşletim sistemi açılışında Dracord başlar.'
              : 'Masaüstü uygulamasında geçerlidir (web’de kaydedilir).'
          }
          checked={prefs.system.openOnStartup}
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
          description={
            isElectron
              ? 'Kapatırken pencere gizlenir.'
              : 'Masaüstü uygulamasında kapatmayı gizlemeye çevirir.'
          }
          checked={prefs.system.minimizeToTray}
          onChange={(v) => setSection('system', { minimizeToTray: v })}
        />
        <SettingsToggle
          label="Otomatik güncelleme"
          checked={prefs.system.autoUpdate}
          onChange={(v) => setSection('system', { autoUpdate: v })}
        />
      </SettingsSection>
      <SettingsSection>
        <SettingsNote>
          {isElectron
            ? 'Electron algılandı — başlangıç ve tepsi tercihleri anında uygulanır.'
            : 'Tercihler hesabına senkronize edilir; masaüstü uygulamasında otomatik uygulanır.'}
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
