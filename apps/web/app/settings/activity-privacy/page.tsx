'use client';

import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

export default function ActivityPrivacyPage() {
  const { prefs, setSection } = useUserPreferences();

  return (
    <SettingsPage
      title="Etkinlik Gizliliği"
      description="Oyun ve etkinlik durumunun kimlerle paylaşıldığını yönet."
    >
      <SettingsSection>
        <SettingsToggle
          label="Etkinliği göster"
          description="Şu anki etkinliğin profilinde görünsün."
          checked={prefs.activity.displayActivity}
          onChange={(v) => {
            setSection('activity', { displayActivity: v });
            setSection('privacy', { shareActivityStatus: v });
          }}
        />
        <SettingsToggle
          label="Oyunları paylaş"
          description="Dracord oyun / Watch Party oturumunu profilde göster."
          checked={prefs.activity.shareGames}
          onChange={(v) => setSection('activity', { shareGames: v })}
        />
        <SettingsToggle
          label="Spotify dinlemeyi paylaş"
          description="Bağlı Spotify’da çalan parçayı profilde göster."
          checked={prefs.activity.shareSpotify !== false}
          onChange={(v) => setSection('activity', { shareSpotify: v })}
        />
        <SettingsToggle
          label="Masaüstü oyun algılamayı paylaş"
          description="Dracord masaüstü istemcisinin algıladığı oyunları paylaş (opt-in)."
          checked={prefs.activity.shareDesktopActivity === true}
          onChange={(v) => setSection('activity', { shareDesktopActivity: v })}
        />
        <SettingsToggle
          label="Katılma isteklerine izin ver"
          description="Arkadaşların etkinliğine katılma isteği gönderebilsin."
          checked={prefs.activity.allowJoinRequests}
          onChange={(v) => setSection('activity', { allowJoinRequests: v })}
        />
      </SettingsSection>
    </SettingsPage>
  );
}
