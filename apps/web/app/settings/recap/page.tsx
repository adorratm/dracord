'use client';

import { useAuth } from '@/components/AuthProvider';
import { SettingsPage, SettingsSection, SettingsNote } from '@/components/settings/SettingsControls';

export default function RecapSettingsPage() {
  const { user } = useAuth();
  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() - 1];
  return (
    <SettingsPage title="Yıl Özeti" description="Dracord'da geçirdiğin yılın hikâyesi: mesajların, ses saatlerin, arkadaşların ve oyunların.">
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
