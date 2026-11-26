'use client';

import { StreakCard } from '@dracord/ui';
import { useAuth } from '@/components/AuthProvider';
import { SettingsPage, SettingsSection, SettingsNote } from '@/components/settings/SettingsControls';

export default function RecapSettingsPage() {
  const { user, client } = useAuth();
  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() - 1];
  return (
    <SettingsPage title="Seri ve Yıl Özeti" description="Günlük serin ve Dracord'da geçirdiğin yılın hikâyesi.">
      <SettingsSection title="Günlük seri">
        <StreakCard client={client} />
        <SettingsNote>Her gün bir mesaj atmak ya da 5 dakika seste kalmak o günü sayar. Her 7 günde bir dondurucu kazanırsın; kaçırdığın bir günü otomatik kurtarır (en fazla 2). Gün İstanbul saatiyle gece yarısı döner.</SettingsNote>
      </SettingsSection>
      <SettingsSection title="Özetini aç">
        <div className="flex flex-wrap gap-2">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              disabled={!user}
              onClick={() => window.dispatchEvent(new CustomEvent('dracord:open-recap', { detail: y }))}
              className="rounded-full bg-gradient-to-r from-[#4a1d7a] to-[#d9467a] px-5 py-2 font-semibold text-white"
            >
              ✨ {y} özeti
            </button>
          ))}
        </div>
        <SettingsNote>Özet yalnız sana görünür. Paylaşmak istersen son kartta görsel olarak indirip istediğin yerde paylaşabilirsin.</SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
