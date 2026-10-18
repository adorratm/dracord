'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useAuth } from '@/components/AuthProvider';
import { useUserPreferences } from '@/lib/user-preferences';
import { newId } from '@/lib/totp';

const CATALOG = [
  { id: 'github', name: 'GitHub' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'twitch', name: 'Twitch' },
  { id: 'steam', name: 'Steam' },
];

export default function ConnectionsPage() {
  const { client } = useAuth();
  const { prefs, setSection } = useUserPreferences();
  const [spotify, setSpotify] = useState<{
    configured: boolean;
    connected: boolean;
    authorizeUrl: string | null;
  } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refreshSpotify = useCallback(() => {
    void client
      .getSpotifyStatus()
      .then(setSpotify)
      .catch(() =>
        setSpotify({ configured: false, connected: false, authorizeUrl: null }),
      );
  }, [client]);

  useEffect(() => {
    refreshSpotify();
    const q = new URLSearchParams(window.location.search);
    if (q.get('spotify') === 'ok') setMsg('Spotify bağlandı');
    if (q.get('spotify') === 'error') setMsg('Spotify bağlantısı başarısız');
  }, [refreshSpotify]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; status?: string } | null;
      if (data?.type !== 'dracord-spotify-oauth') return;
      refreshSpotify();
      setMsg(
        data.status === 'error'
          ? 'Spotify bağlantısı başarısız'
          : 'Spotify bağlandı',
      );
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [refreshSpotify]);

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
      description="Spotify dinleme durumunu paylaş veya diğer uygulamaları bağla."
    >
      {msg && (
        <p className="px-space-md font-body-sm text-secondary mb-2">{msg}</p>
      )}
      <SettingsSection title="Spotify">
        <div className="px-space-md py-space-md space-y-2">
          {!spotify?.configured ? (
            <SettingsNote>
              Spotify API anahtarları yapılandırılmamış (SPOTIFY_CLIENT_ID /
              SPOTIFY_CLIENT_SECRET).
            </SettingsNote>
          ) : spotify.connected ? (
            <>
              <p className="font-body-md text-on-surface">Spotify bağlı</p>
              <p className="font-body-sm text-on-surface-variant">
                Çalan parçan profilinde “Dinliyor” olarak görünür (gizlilik
                ayarına bağlı).
              </p>
              <button
                type="button"
                onClick={() => {
                  void client.disconnectSpotify().then(() => {
                    refreshSpotify();
                    setMsg('Spotify bağlantısı kesildi');
                  });
                }}
                className="font-label-sm text-error hover:underline"
              >
                Bağlantıyı kes
              </button>
            </>
          ) : (
            <>
              <p className="font-body-sm text-on-surface-variant">
                Hesabını bağla; Currently Playing API ile dinlediğin şarkı
                profilde görünür.
              </p>
              <button
                type="button"
                disabled={!spotify.authorizeUrl}
                onClick={() => {
                  if (!spotify.authorizeUrl) return;
                  const w = window.open(
                    spotify.authorizeUrl,
                    'dracord-spotify',
                    'width=560,height=740,menubar=no,toolbar=no',
                  );
                  if (!w) {
                    window.location.href = spotify.authorizeUrl;
                    return;
                  }
                  const timer = window.setInterval(() => {
                    if (w.closed) {
                      window.clearInterval(timer);
                      refreshSpotify();
                    }
                  }, 800);
                }}
                className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-40"
              >
                Spotify bağla
              </button>
            </>
          )}
        </div>
      </SettingsSection>
      <SettingsSection title="Diğer uygulamalar (demo)">
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
      <SettingsSection title="Bağlı (demo)">
        {prefs.connections.apps.length === 0 ? (
          <SettingsNote>Demo bağlı uygulama yok.</SettingsNote>
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
