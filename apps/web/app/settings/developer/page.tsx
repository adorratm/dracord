'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

type AppRow = {
  id: string;
  name: string;
  botUserId: string | null;
  botTokenLast4: string | null;
  botToken?: string;
  webhookUrl: string | null;
};

export default function DeveloperSettingsPage() {
  const { user, client } = useAuth();
  const { prefs, setSection } = useUserPreferences();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [platformOn, setPlatformOn] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const health = await client.platformHealth();
      setPlatformOn(Boolean(health.platformApi));
      if (!health.platformApi) {
        setApps([]);
        return;
      }
      const list = await client.listPlatformApplications();
      setApps(list);
    } catch {
      setPlatformOn(false);
    }
  }, [client]);

  useEffect(() => {
    if (prefs.developer.developerMode) void load();
  }, [prefs.developer.developerMode, load]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const createApp = async () => {
    setBusy(true);
    setError(null);
    setLastToken(null);
    try {
      const app = await client.createPlatformApplication({
        name: name.trim() || 'Uygulamam',
        withBot: true,
      });
      if (app.botToken) setLastToken(app.botToken);
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPage
      title="Gelişmiş"
      description="Geliştirici araçları, bot uygulamaları ve deneysel özellikler."
    >
      <SettingsSection>
        <SettingsToggle
          label="Geliştirici modu"
          description="Mesaj menüsünde ID kopyalama; bot uygulama paneli."
          checked={prefs.developer.developerMode}
          onChange={(v) => setSection('developer', { developerMode: v })}
        />
        <SettingsToggle
          label="Deneysel özellikler"
          description="Arayüzde deneysel çerçeve (kenarlık vurgusu) gösterir."
          checked={prefs.developer.experimental}
          onChange={(v) => setSection('developer', { experimental: v })}
        />
      </SettingsSection>
      {prefs.developer.developerMode && (
        <>
          <SettingsSection title="Kimlikler">
            <div className="px-space-md py-space-md flex items-center justify-between gap-space-md">
              <div>
                <p className="font-body-md">Kullanıcı ID</p>
                <p className="font-body-sm text-outline font-mono">{user?.id ?? '—'}</p>
              </div>
              <button
                type="button"
                onClick={() => void copy(user?.id ?? '')}
                className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm hover:bg-surface-bright"
              >
                Kopyala
              </button>
            </div>
          </SettingsSection>
          <SettingsSection title="Platform uygulamaları / bot">
            {platformOn === false && (
              <SettingsNote>
                Platform API kapalı. Sunucuda <code>PLATFORM_API=true</code> ile açılır.
                Spec: docs/platform-api-tasarim.md
              </SettingsNote>
            )}
            {platformOn && (
              <div className="px-space-md py-space-md space-y-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Uygulama adı"
                    className="h-9 flex-1 min-w-[140px] rounded-lg bg-surface-container-highest px-3 font-body-sm outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void createApp()}
                    className="h-9 px-4 rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
                  >
                    Bot oluştur
                  </button>
                </div>
                {lastToken && (
                  <p className="font-body-sm text-secondary break-all">
                    Bot token (bir kez gösterilir):{' '}
                    <code className="font-mono">{lastToken}</code>
                  </p>
                )}
                {error && <p className="font-body-sm text-error">{error}</p>}
                <ul className="space-y-2">
                  {apps.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-lg border border-surface-container-highest p-3 font-body-sm"
                    >
                      <p className="font-label-md">{a.name}</p>
                      <p className="text-outline font-mono text-[11px]">{a.id}</p>
                      {a.botTokenLast4 && (
                        <p className="text-on-surface-variant">
                          Token …{a.botTokenLast4}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="px-2 py-1 rounded bg-surface-container-high font-label-sm"
                          onClick={() =>
                            void client
                              .resetPlatformBotToken(a.id)
                              .then((r) => {
                                if (r.botToken) setLastToken(r.botToken);
                                return load();
                              })
                              .catch((e) =>
                                setError(
                                  e instanceof Error ? e.message : 'Token yenilenemedi',
                                ),
                              )
                          }
                        >
                          Token yenile
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 rounded bg-error/20 text-error font-label-sm"
                          onClick={() =>
                            void client
                              .deletePlatformApplication(a.id)
                              .then(() => load())
                              .catch(() => undefined)
                          }
                        >
                          Sil
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <SettingsNote>
                  Bot mesajı: <code>Authorization: Bot &lt;token&gt;</code> →{' '}
                  <code>POST /v1/channels/:id/messages</code>
                  <br />
                  Slash sync: <code>PUT /v1/applications/:id/commands</code> (guildId +
                  commands)
                  <br />
                  OAuth widget:{' '}
                  <code>{`<script src="/sdk/login-with-dracord.js"></script>`}</code> →{' '}
                  <code>DracordLogin.render(...)</code> · consent:{' '}
                  <code>/oauth/authorize?client_id=…</code>
                </SettingsNote>
              </div>
            )}
          </SettingsSection>
          <SettingsSection title="Bağlantılar">
            <SettingsNote>
              Spotify OAuth Ayarlar → Bağlantılar üzerinden çalışır. Bot araçları bu
              sayfada (developerMode).
            </SettingsNote>
          </SettingsSection>
        </>
      )}
    </SettingsPage>
  );
}
