'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
  SettingsSelect,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

export default function PrivacySettingsPage() {
  const { user, client, setUser } = useAuth();
  const { prefs, setSection } = useUserPreferences();
  const [censor, setCensor] = useState(Boolean(user?.censorLinkPreviews));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCensor(Boolean(user?.censorLinkPreviews));
  }, [user?.censorLinkPreviews]);

  const toggleCensor = async (next: boolean) => {
    setCensor(next);
    setBusy(true);
    try {
      const me = await client.updateProfile({ censorLinkPreviews: next });
      setUser(me);
    } catch {
      setCensor(Boolean(user?.censorLinkPreviews));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPage
      title="Veri ve Gizlilik"
      description="Kimlerle etkileşime geçtiğini ve hangi verilerin toplandığını kontrol et."
    >
      <SettingsSection title="Sosyal">
        <SettingsSelect
          label="Direkt mesaj filtresi"
          description="Kimlerden DM alabileceğini sınırla."
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
          label="Arkadaşlık isteklerine izin ver"
          checked={prefs.privacy.allowFriendRequests}
          onChange={(v) => setSection('privacy', { allowFriendRequests: v })}
        />
        <SettingsToggle
          label="Etkinlik durumunu paylaş"
          description="Şu an ne yaptığını arkadaşların görebilsin."
          checked={prefs.privacy.shareActivityStatus}
          onChange={(v) => setSection('privacy', { shareActivityStatus: v })}
        />
      </SettingsSection>
      <SettingsSection title="Veri">
        <SettingsToggle
          label="Kullanım verisi toplama"
          description="Ürünü iyileştirmek için anonim telemetri (yerel tercih)."
          checked={prefs.privacy.dataCollection}
          onChange={(v) => setSection('privacy', { dataCollection: v })}
        />
        <SettingsToggle
          label="Kişiselleştirilmiş deneyim"
          checked={prefs.privacy.personalizeAds}
          onChange={(v) => setSection('privacy', { personalizeAds: v })}
        />
        <SettingsToggle
          label="Link önizlemelerini sansürle"
          description="Mesajlardaki bağlantı kartları bulanık gelir."
          checked={censor}
          disabled={busy || !user}
          onChange={(v) => void toggleCensor(v)}
        />
      </SettingsSection>
    </SettingsPage>
  );
}
