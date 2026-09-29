'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
  SettingsToggle,
  SettingsSelect,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

export default function AppearanceSettingsPage() {
  const { user, client, setUser } = useAuth();
  const { prefs, setSection } = useUserPreferences();
  const [censor, setCensor] = useState(Boolean(user?.censorLinkPreviews));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCensor(Boolean(user?.censorLinkPreviews));
  }, [user?.censorLinkPreviews]);

  const toggleCensor = async (next: boolean) => {
    setCensor(next);
    setBusy(true);
    setSaved(false);
    try {
      const me = await client.updateProfile({ censorLinkPreviews: next });
      setUser(me);
      setSaved(true);
    } catch {
      setCensor(Boolean(user?.censorLinkPreviews));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPage title="Görünüm" description="Tema ve medya önizleme tercihleri.">
      <SettingsSection title="Tema">
        <SettingsSelect
          label="Renk teması"
          description="Koyu Dracula veya açık görünüm."
          value={prefs.appearance.theme}
          options={[
            { value: 'dark', label: 'Koyu (Dracula)' },
            { value: 'light', label: 'Açık' },
          ]}
          onChange={(v) =>
            setSection('appearance', { theme: v as 'dark' | 'light' })
          }
        />
        <SettingsSelect
          label="Mesaj yoğunluğu"
          value={prefs.appearance.messageDensity}
          options={[
            { value: 'cozy', label: 'Rahat' },
            { value: 'compact', label: 'Kompakt' },
          ]}
          onChange={(v) =>
            setSection('appearance', {
              messageDensity: v as 'cozy' | 'compact',
            })
          }
        />
      </SettingsSection>
      <SettingsSection title="Medya önizlemeleri">
        <SettingsToggle
          label="Link önizlemelerini sansürle"
          description="Mesajlardaki bağlantı kartları bulanık gelir."
          checked={censor}
          disabled={busy || !user}
          onChange={(v) => void toggleCensor(v)}
        />
        {saved && (
          <p className="px-space-md pb-space-md font-label-sm text-secondary">Kaydedildi</p>
        )}
      </SettingsSection>
      <SettingsSection>
        <SettingsNote>
          Kompakt yoğunluk, erişilebilirlikteki mesaj gruplamasını da sıkılaştırır.
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
