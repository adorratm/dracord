'use client';

import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';
import { newId } from '@/lib/totp';

const CATALOG = [
  { id: 'spotify', name: 'Spotify' },
  { id: 'github', name: 'GitHub' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'twitch', name: 'Twitch' },
  { id: 'steam', name: 'Steam' },
];

export default function ConnectionsPage() {
  const { prefs, setSection } = useUserPreferences();

  const connect = (name: string) => {
    if (prefs.connections.apps.some((a) => a.name === name)) return;
    setSection('connections', {
      apps: [
        ...prefs.connections.apps,
        { id: newId('app'), name, connectedAt: new Date().toISOString() },
      ],
    });
  };

  const disconnect = (id: string) => {
    setSection('connections', {
      apps: prefs.connections.apps.filter((a) => a.id !== id),
    });
  };

  return (
    <SettingsPage
      title="Bağlı Uygulamalar"
      description="Hesabına uygulama bağla veya bağlantıyı kaldır (demo OAuth)."
    >
      <SettingsSection title="Uygulama ekle">
        <div className="px-space-md py-space-md flex flex-wrap gap-2">
          {CATALOG.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={prefs.connections.apps.some((a) => a.name === c.name)}
              onClick={() => connect(c.name)}
              className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-40"
            >
              {c.name} bağla
            </button>
          ))}
        </div>
      </SettingsSection>
      <SettingsSection title="Bağlı">
        {prefs.connections.apps.length === 0 ? (
          <SettingsNote>Bağlı uygulama yok.</SettingsNote>
        ) : (
          <ul className="divide-y divide-surface-container-high">
            {prefs.connections.apps.map((a) => (
              <li
                key={a.id}
                className="px-space-md py-space-sm flex justify-between items-center gap-2"
              >
                <div>
                  <p className="font-body-md">{a.name}</p>
                  <p className="font-label-sm text-outline">
                    {new Date(a.connectedAt).toLocaleString('tr-TR')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => disconnect(a.id)}
                  className="font-label-sm text-error hover:underline"
                >
                  Bağlantıyı kes
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
