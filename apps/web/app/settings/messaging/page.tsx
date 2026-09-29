'use client';

import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
  SettingsSelect,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

export default function MessagingPermissionsPage() {
  const { prefs, setSection } = useUserPreferences();

  return (
    <SettingsPage
      title="Mesajlaşma İzinleri"
      description="Kimlerin sana mesaj atabileceğini ve içerik filtrelerini ayarla."
    >
      <SettingsSection title="İzinler">
        <SettingsSelect
          label="Kimler DM atabilir"
          value={prefs.messaging.whoCanDm}
          options={[
            { value: 'everyone', label: 'Herkes' },
            { value: 'friends', label: 'Arkadaşlar' },
            { value: 'nobody', label: 'Kimse' },
          ]}
          onChange={(v) => {
            const level = v as 'everyone' | 'friends' | 'nobody';
            setSection('messaging', { whoCanDm: level });
            setSection('privacy', { dmFilter: level });
          }}
        />
        <SettingsToggle
          label="Uygunsuz içerik filtresi"
          description="Şüpheli medyayı otomatik filtrele."
          checked={prefs.messaging.filterExplicit}
          onChange={(v) => setSection('messaging', { filterExplicit: v })}
        />
        <SettingsToggle
          label="Bağlantı gömme (embed)"
          description="Yapıştırılan linkler için önizleme kartı göster."
          checked={prefs.messaging.autoEmbed}
          onChange={(v) => setSection('messaging', { autoEmbed: v })}
        />
        <SettingsToggle
          label="Yazım denetimi"
          checked={prefs.messaging.spellcheck}
          onChange={(v) => setSection('messaging', { spellcheck: v })}
        />
      </SettingsSection>
    </SettingsPage>
  );
}
