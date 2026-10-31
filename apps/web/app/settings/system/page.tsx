'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

type DesktopApi = {
  isElectron?: boolean;
  getAppVersion?: () => Promise<string>;
  checkForUpdates?: () => Promise<unknown>;
  onUpdaterStatus?: (cb: (p: { status?: string; message?: string }) => void) => () => void;
};

export default function SystemSettingsPage() {
  const { prefs, setSection } = useUserPreferences();
  const [version, setVersion] = useState<string | null>(null);
  const [updateNote, setUpdateNote] = useState<string | null>(null);
  const desktop =
    typeof window !== 'undefined'
      ? (window as Window & { dracordDesktop?: DesktopApi }).dracordDesktop
      : undefined;
  const isElectron = Boolean(desktop?.isElectron);

  useEffect(() => {
    if (!desktop?.getAppVersion) return;
    void desktop.getAppVersion().then((v) => setVersion(v)).catch(() => undefined);
    const unsub = desktop.onUpdaterStatus?.((p) => {
      setUpdateNote(p.message || p.status || null);
    });
    return () => unsub?.();
  }, [desktop]);

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

      {isElectron && (
        <SettingsSection title="Masaüstü">
          <div className="px-space-md py-space-md space-y-3">
            <p className="font-body-sm text-on-surface-variant">
              Sürüm:{' '}
              <span className="font-mono text-on-surface">{version ?? '…'}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setUpdateNote('Kontrol ediliyor…');
                  void desktop?.checkForUpdates?.();
                }}
                className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm"
              >
                Güncelleme kontrol et
              </button>
              <Link
                href="/settings/overlay"
                className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm inline-flex items-center"
              >
                Overlay ayarları
              </Link>
              <Link
                href="/settings/games"
                className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm inline-flex items-center"
              >
                Oyun kütüphanesi
              </Link>
            </div>
            {updateNote && (
              <p className="font-body-sm text-secondary">{updateNote}</p>
            )}
          </div>
        </SettingsSection>
      )}

      <SettingsSection>
        <SettingsNote>
          {isElectron
            ? 'Electron algılandı — başlangıç, tepsi ve güncelleme tercihleri anında uygulanır.'
            : 'Web’de yalnızca donanım hızlandırma etkisi vardır. Başlangıç, tepsi, overlay ve oyun kütüphanesi masaüstü uygulamasında çalışır.'}
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
