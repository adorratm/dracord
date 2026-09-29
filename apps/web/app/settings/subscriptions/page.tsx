'use client';

import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

export default function SubscriptionsPage() {
  const { prefs, setSection } = useUserPreferences();
  const items: Array<{ id: string; label: string; onCancel: () => void }> = [];

  if (prefs.billing.nitroPlan !== 'none') {
    items.push({
      id: 'nitro',
      label: `Nitro ${prefs.billing.nitroPlan === 'basic' ? 'Basic' : ''} · bitiş ${
        prefs.billing.nitroExpiresAt
          ? new Date(prefs.billing.nitroExpiresAt).toLocaleDateString('tr-TR')
          : '—'
      }`,
      onCancel: () => setSection('billing', { nitroPlan: 'none', nitroExpiresAt: null }),
    });
  }

  for (const a of prefs.billing.boostAssignments) {
    items.push({
      id: `boost-${a.guildId}`,
      label: `Takviye · ${a.guildName}`,
      onCancel: () =>
        setSection('billing', {
          boostCredits: prefs.billing.boostCredits + 1,
          boostAssignments: prefs.billing.boostAssignments.filter(
            (x) => x.guildId !== a.guildId,
          ),
        }),
    });
  }

  return (
    <SettingsPage title="Abonelikler" description="Aktif planların ve takviyelerin.">
      <SettingsSection>
        {items.length === 0 ? (
          <SettingsNote>Aktif aboneliğin yok. Nitro veya takviye ekle.</SettingsNote>
        ) : (
          <ul className="divide-y divide-surface-container-high">
            {items.map((it) => (
              <li
                key={it.id}
                className="px-space-md py-space-sm flex items-center justify-between gap-space-md"
              >
                <span className="font-body-md">{it.label}</span>
                <button
                  type="button"
                  onClick={it.onCancel}
                  className="font-label-sm text-error hover:underline"
                >
                  İptal
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
