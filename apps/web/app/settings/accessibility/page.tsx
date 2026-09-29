'use client';

import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

export default function AccessibilityPage() {
  const { prefs, setSection } = useUserPreferences();

  return (
    <SettingsPage
      title="Erişilebilirlik"
      description="Hareket, kontrast ve okunabilirlik tercihleri."
    >
      <SettingsSection title="Hareket">
        <SettingsToggle
          label="Azaltılmış hareket"
          description="Animasyonları ve geçişleri sadeleştir."
          checked={prefs.accessibility.reducedMotion}
          onChange={(v) => setSection('accessibility', { reducedMotion: v })}
        />
      </SettingsSection>
      <SettingsSection title="Görünürlük">
        <SettingsToggle
          label="Yüksek kontrast"
          checked={prefs.accessibility.highContrast}
          onChange={(v) => setSection('accessibility', { highContrast: v })}
        />
        <SettingsToggle
          label="Mesaj gruplama"
          description="Aynı yazardan ardışık mesajları birleştir."
          checked={prefs.accessibility.messageGrouping}
          onChange={(v) => setSection('accessibility', { messageGrouping: v })}
        />
        <SettingsToggle
          label="Bağlantıların altını çiz"
          checked={prefs.accessibility.underlineLinks}
          onChange={(v) => setSection('accessibility', { underlineLinks: v })}
        />
        <SettingsToggle
          label="Rol renklerini göster"
          checked={prefs.accessibility.roleColors}
          onChange={(v) => setSection('accessibility', { roleColors: v })}
        />
      </SettingsSection>
    </SettingsPage>
  );
}
