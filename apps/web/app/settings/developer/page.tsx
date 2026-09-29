'use client';

import { useAuth } from '@/components/AuthProvider';
import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

export default function DeveloperSettingsPage() {
  const { user } = useAuth();
  const { prefs, setSection } = useUserPreferences();

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <SettingsPage
      title="Gelişmiş"
      description="Geliştirici araçları ve deneysel özellikler."
    >
      <SettingsSection>
        <SettingsToggle
          label="Geliştirici modu"
          description="Mesaj menüsünde ID kopyalama; kanal başlığında sunucu/kanal ID."
          checked={prefs.developer.developerMode}
          onChange={(v) => setSection('developer', { developerMode: v })}
        />
        <SettingsToggle
          label="Deneysel özellikler"
          description="Arayüzde deneysel çerçeve (kenarlık vurgusu) gösterir."
          checked={prefs.developer.experimental}
          onChange={(v) => setSection('developer', { experimental: v })}
        />
      </SettingsSection>
      {prefs.developer.developerMode && (
        <SettingsSection title="Kimlikler">
          <div className="px-space-md py-space-md flex items-center justify-between gap-space-md">
            <div>
              <p className="font-body-md">Kullanıcı ID</p>
              <p className="font-body-sm text-outline font-mono">{user?.id ?? '—'}</p>
            </div>
            <button
              type="button"
              onClick={() => void copy(user?.id ?? '')}
              className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm hover:bg-surface-bright"
            >
              Kopyala
            </button>
          </div>
          <SettingsNote>
            Kanal ve sunucu ID’leri sohbet başlığındaki kimlik düğmelerinden kopyalanır.
          </SettingsNote>
        </SettingsSection>
      )}
    </SettingsPage>
  );
}
