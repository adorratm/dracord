'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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

function CopyButton({
  label,
  value,
  disabled,
}: {
  label: string;
  value: string;
  disabled?: boolean;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled || !value}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        });
      }}
      className="h-8 px-3 rounded-lg bg-surface-container-high font-label-sm text-on-surface hover:bg-surface-bright disabled:opacity-40 transition-colors"
    >
      {done ? 'Kopyalandı' : label}
    </button>
  );
}

export default function DeveloperSettingsPage() {
  const { user, client } = useAuth();
  const { prefs, setSection } = useUserPreferences();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [platformOn, setPlatformOn] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [webhookDraft, setWebhookDraft] = useState<Record<string, string>>({});

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
      setWebhookDraft((prev) => {
        const next = { ...prev };
        for (const a of list) {
          if (next[a.id] === undefined) next[a.id] = a.webhookUrl ?? '';
        }
        return next;
      });
    } catch {
      setPlatformOn(false);
    }
  }, [client]);

  useEffect(() => {
    if (prefs.developer.developerMode) void load();
  }, [prefs.developer.developerMode, load]);

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

  const resetToken = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const r = await client.resetPlatformBotToken(id);
      if (r.botToken) setLastToken(r.botToken);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Token yenilenemedi');
    } finally {
      setBusyId(null);
    }
  };

  const saveWebhook = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const raw = (webhookDraft[id] ?? '').trim();
      await client.setPlatformWebhook(id, raw || null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Webhook kaydedilemedi');
    } finally {
      setBusyId(null);
    }
  };

  const removeApp = async (id: string) => {
    if (!window.confirm('Bu uygulamayı silmek istediğine emin misin?')) return;
    setBusyId(id);
    setError(null);
    try {
      await client.deletePlatformApplication(id);
      if (lastToken) setLastToken(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setBusyId(null);
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
          description="Mesaj menüsünde kimlik kopyalama ve uygulama paneli."
          checked={prefs.developer.developerMode}
          onChange={(v) => setSection('developer', { developerMode: v })}
        />
        <SettingsToggle
          label="Deneysel özellikler"
          description="Arayüzde deneysel çerçeve vurgusu gösterir."
          checked={prefs.developer.experimental}
          onChange={(v) => setSection('developer', { experimental: v })}
        />
      </SettingsSection>

      {prefs.developer.developerMode && (
        <>
          <SettingsSection title="Hesap kimliği">
            <div className="px-space-md py-space-md flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-body-md text-on-surface">Kullanıcı kimliği</p>
                <p className="mt-1 font-body-sm text-on-surface-variant break-all select-all">
                  {user?.id ?? '—'}
                </p>
              </div>
              <CopyButton label="Kopyala" value={user?.id ?? ''} disabled={!user?.id} />
            </div>
          </SettingsSection>

          <SettingsSection title="Uygulamalar">
            {platformOn === false && (
              <SettingsNote>
                Uygulama ve bot oluşturma bu sunucuda şu an kapalı. Yönetici
                panelinden platform API’sini açman gerekir.
              </SettingsNote>
            )}

            {platformOn === null && (
              <SettingsNote>Platform durumu kontrol ediliyor…</SettingsNote>
            )}

            {platformOn && (
              <>
                <div className="px-space-md py-space-md space-y-3">
                  <p className="font-body-sm text-on-surface-variant">
                    Bot hesabı olan bir uygulama oluştur; token’ı yalnızca bir kez
                    gösterilir — güvenli yerde sakla.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Uygulama adı"
                      maxLength={64}
                      className="h-10 flex-1 rounded-lg bg-surface-container-highest px-3 font-body-sm text-on-surface outline-none ring-0 focus:bg-surface-bright"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void createApp()}
                      className="h-10 shrink-0 px-4 rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50 hover:brightness-110 transition"
                    >
                      {busy ? 'Oluşturuluyor…' : 'Uygulama oluştur'}
                    </button>
                  </div>
                </div>

                {lastToken && (
                  <div className="px-space-md pb-space-md">
                    <div className="rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-label-md text-secondary">
                            Yeni bot token’ı
                          </p>
                          <p className="font-body-sm text-on-surface-variant mt-0.5">
                            Bu ekranı kapattıktan sonra tekrar gösterilmez.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLastToken(null)}
                          className="font-label-sm text-outline hover:text-on-surface"
                        >
                          Gizle
                        </button>
                      </div>
                      <p className="font-mono text-[12px] leading-relaxed break-all text-on-surface select-all">
                        {lastToken}
                      </p>
                      <CopyButton label="Token’ı kopyala" value={lastToken} />
                    </div>
                  </div>
                )}

                {error && (
                  <p className="px-space-md pb-space-md font-body-sm text-error">
                    {error}
                  </p>
                )}

                {apps.length === 0 ? (
                  <SettingsNote>
                    Henüz uygulama yok. Yukarıdan bir ad verip oluşturarak
                    başlayabilirsin.
                  </SettingsNote>
                ) : (
                  <ul className="divide-y divide-surface-container-high">
                    {apps.map((a) => {
                      const rowBusy = busyId === a.id;
                      return (
                        <li key={a.id} className="px-space-md py-space-md space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-label-lg text-on-surface">
                                  {a.name}
                                </p>
                                {a.botUserId ? (
                                  <span className="inline-flex items-center rounded-md bg-primary-container/20 text-primary-container px-2 py-0.5 font-label-sm">
                                    Bot bağlı
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-md bg-surface-container-highest text-outline px-2 py-0.5 font-label-sm">
                                    Botsuz
                                  </span>
                                )}
                              </div>
                              <p className="font-body-sm text-on-surface-variant">
                                Uygulama kimliği
                              </p>
                              <p className="font-mono text-[12px] text-outline break-all">
                                {a.id}
                              </p>
                              {a.botUserId && (
                                <>
                                  <p className="font-body-sm text-on-surface-variant pt-1">
                                    Bot kullanıcı kimliği
                                  </p>
                                  <p className="font-mono text-[12px] text-outline break-all">
                                    {a.botUserId}
                                  </p>
                                </>
                              )}
                              {a.botTokenLast4 && (
                                <p className="font-body-sm text-on-surface-variant pt-1">
                                  Token sonu ···{a.botTokenLast4}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <CopyButton label="Uygulama ID" value={a.id} />
                              {a.botUserId && (
                                <CopyButton label="Bot ID" value={a.botUserId} />
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block">
                              <span className="font-body-sm text-on-surface-variant">
                                Olay webhook’u (isteğe bağlı)
                              </span>
                              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                                <input
                                  value={webhookDraft[a.id] ?? ''}
                                  onChange={(e) =>
                                    setWebhookDraft((prev) => ({
                                      ...prev,
                                      [a.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="https://…"
                                  className="h-9 flex-1 rounded-lg bg-surface-container-highest px-3 font-body-sm outline-none focus:bg-surface-bright"
                                />
                                <button
                                  type="button"
                                  disabled={rowBusy}
                                  onClick={() => void saveWebhook(a.id)}
                                  className="h-9 px-3 rounded-lg bg-surface-container-high font-label-sm disabled:opacity-50 hover:bg-surface-bright"
                                >
                                  Kaydet
                                </button>
                              </div>
                            </label>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              disabled={rowBusy}
                              className="h-8 px-3 rounded-lg bg-surface-container-high font-label-sm disabled:opacity-50 hover:bg-surface-bright"
                              onClick={() => void resetToken(a.id)}
                            >
                              Token yenile
                            </button>
                            <button
                              type="button"
                              disabled={rowBusy}
                              className="h-8 px-3 rounded-lg bg-error/15 text-error font-label-sm disabled:opacity-50 hover:bg-error/25"
                              onClick={() => void removeApp(a.id)}
                            >
                              Sil
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </SettingsSection>

          <SettingsSection title="Diğer">
            <SettingsNote>
              Spotify ve benzeri hesap bağlantıları için{' '}
              <Link
                href="/settings/connections"
                className="text-primary-container hover:underline"
              >
                Bağlı Uygulamalar
              </Link>
              . Overlay ve oyun tercihleri Sistem / Oyunlar sayfalarında.
            </SettingsNote>
          </SettingsSection>
        </>
      )}
    </SettingsPage>
  );
}
