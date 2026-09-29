'use client';

import { useEffect, useState } from 'react';
import type { GuildSummary } from '@dracord/types';
import { useAuth } from '@/components/AuthProvider';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';
import { newId } from '@/lib/totp';

export default function BoostPage() {
  const { client } = useAuth();
  const { prefs, setSection } = useUserPreferences();
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [guildId, setGuildId] = useState('');

  useEffect(() => {
    void client.listGuilds().then(setGuilds).catch(() => setGuilds([]));
  }, [client]);

  const buy = () => {
    setSection('billing', {
      boostCredits: prefs.billing.boostCredits + 1,
      invoices: [
        {
          id: newId('inv'),
          label: 'Sunucu takviyesi (demo)',
          amount: '₺49',
          at: new Date().toISOString(),
        },
        ...prefs.billing.invoices,
      ].slice(0, 20),
    });
  };

  const assign = () => {
    if (!guildId || prefs.billing.boostCredits < 1) return;
    const g = guilds.find((x) => x.id === guildId);
    if (!g) return;
    if (prefs.billing.boostAssignments.some((a) => a.guildId === guildId)) return;
    setSection('billing', {
      boostCredits: prefs.billing.boostCredits - 1,
      boostAssignments: [
        ...prefs.billing.boostAssignments,
        { guildId: g.id, guildName: g.name },
      ],
    });
  };

  const unassign = (id: string) => {
    setSection('billing', {
      boostCredits: prefs.billing.boostCredits + 1,
      boostAssignments: prefs.billing.boostAssignments.filter((a) => a.guildId !== id),
    });
  };

  return (
    <SettingsPage
      title="Sunucu Takviyesi"
      description="Takviye satın al (demo) ve sunucularına ata."
    >
      <SettingsSection title="Krediler">
        <div className="px-space-md py-space-md flex items-center justify-between gap-space-md">
          <p className="font-body-md">
            Kullanılabilir: <strong>{prefs.billing.boostCredits}</strong>
          </p>
          <button
            type="button"
            onClick={buy}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm"
          >
            +1 Takviye al (demo)
          </button>
        </div>
      </SettingsSection>
      <SettingsSection title="Ata">
        <div className="px-space-md py-space-md flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
            <span className="font-label-sm text-on-surface-variant">Sunucu</span>
            <select
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
            >
              <option value="">Seç…</option>
              {guilds.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!guildId || prefs.billing.boostCredits < 1}
            onClick={assign}
            className="h-10 px-space-md rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
          >
            Ata
          </button>
        </div>
      </SettingsSection>
      <SettingsSection title="Atananlar">
        {prefs.billing.boostAssignments.length === 0 ? (
          <SettingsNote>Henüz atanmış takviye yok.</SettingsNote>
        ) : (
          <ul className="divide-y divide-surface-container-high">
            {prefs.billing.boostAssignments.map((a) => (
              <li
                key={a.guildId}
                className="px-space-md py-space-sm flex items-center justify-between gap-space-md"
              >
                <span className="font-body-md">{a.guildName}</span>
                <button
                  type="button"
                  onClick={() => unassign(a.guildId)}
                  className="font-label-sm text-error hover:underline"
                >
                  Kaldır
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
