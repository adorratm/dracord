'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

type RegisteredGame = {
  appId: string;
  name: string;
  enabled?: boolean;
  path?: string;
  source?: string;
};

type DesktopGamesApi = {
  isElectron?: boolean;
  scanGameLibrary?: () => Promise<{ count?: number; games?: RegisteredGame[] } | RegisteredGame[]>;
  importGameScan?: () => Promise<{ count?: number } | unknown>;
  getRegisteredGames?: () => Promise<RegisteredGame[]>;
  addManualGame?: (entry: { name: string; path?: string }) => Promise<unknown>;
  pickGameExe?: () => Promise<RegisteredGame | null>;
  renameRegisteredGame?: (appId: string, name: string) => Promise<unknown>;
  removeRegisteredGame?: (appId: string) => Promise<unknown>;
  setGameEnabled?: (appId: string, enabled: boolean) => Promise<unknown>;
  detectGames?: () => Promise<Array<{ name?: string; appId?: string }>>;
};

function desktopApi(): DesktopGamesApi | null {
  if (typeof window === 'undefined') return null;
  return (
    window as Window & { dracordDesktop?: DesktopGamesApi }
  ).dracordDesktop ?? null;
}

export default function GamesSettingsPage() {
  const { prefs, setSection } = useUserPreferences();
  const api = desktopApi();
  const isElectron = Boolean(api?.isElectron);
  const [games, setGames] = useState<RegisteredGame[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [running, setRunning] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!api?.getRegisteredGames) return;
    try {
      const list = await api.getRegisteredGames();
      setGames(Array.isArray(list) ? list : []);
    } catch {
      setGames([]);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const scan = async () => {
    if (!api?.scanGameLibrary) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.scanGameLibrary();
      if (api.importGameScan) await api.importGameScan();
      await load();
      setMsg('Kütüphane tarandı ve içe aktarıldı.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Tarama başarısız');
    } finally {
      setBusy(false);
    }
  };

  const pickExe = async () => {
    if (!api?.pickGameExe) return;
    setBusy(true);
    try {
      const g = await api.pickGameExe();
      if (g) await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Exe seçilemedi');
    } finally {
      setBusy(false);
    }
  };

  const detectRunning = async () => {
    if (!api?.detectGames) return;
    try {
      const list = await api.detectGames();
      setRunning(
        (list ?? [])
          .map((g) => g.name || g.appId || '')
          .filter(Boolean)
          .slice(0, 12),
      );
    } catch {
      setRunning([]);
    }
  };

  return (
    <SettingsPage
      title="Oyunlar"
      description="Masaüstü oyun kütüphanesi ve etkinlik paylaşımı."
    >
      <SettingsSection title="Paylaşım">
        <SettingsToggle
          label="Oyun etkinliğini paylaş"
          description="Dracord / Watch Party oturumlarını profilde göster."
          checked={prefs.activity.shareGames}
          onChange={(v) => setSection('activity', { shareGames: v })}
        />
        <SettingsToggle
          label="Masaüstü oyun algılamayı paylaş"
          description="Çalışan yerel oyunları arkadaşlarına göster (opt-in)."
          checked={prefs.activity.shareDesktopActivity === true}
          disabled={!isElectron}
          onChange={(v) => setSection('activity', { shareDesktopActivity: v })}
        />
      </SettingsSection>

      <SettingsSection title="Kütüphane">
        {!isElectron ? (
          <SettingsNote>
            Steam / Epic tarama ve exe ekleme yalnızca Dracord masaüstü uygulamasında
            çalışır.
          </SettingsNote>
        ) : (
          <div className="px-space-md py-space-md space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void scan()}
                className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
              >
                Steam / Epic tara
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void pickExe()}
                className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm disabled:opacity-50"
              >
                Exe ekle
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void detectRunning()}
                className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm disabled:opacity-50"
              >
                Çalışanları algıla
              </button>
            </div>
            {msg && <p className="font-body-sm text-secondary">{msg}</p>}
            {running.length > 0 && (
              <p className="font-body-sm text-on-surface-variant">
                Algılanan: {running.join(', ')}
              </p>
            )}
            {games.length === 0 ? (
              <SettingsNote>Kayıtlı oyun yok. Tarama veya exe ekle.</SettingsNote>
            ) : (
              <ul className="divide-y divide-surface-container-high rounded-lg overflow-hidden border border-surface-container-high">
                {games.map((g) => (
                  <li
                    key={g.appId}
                    className="px-space-md py-space-sm flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-body-md truncate">{g.name}</p>
                      <p className="font-label-sm text-outline truncate">
                        {g.source ?? 'manual'} · {g.appId}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 font-label-sm text-on-surface-variant">
                        <input
                          type="checkbox"
                          checked={g.enabled !== false}
                          onChange={(e) =>
                            void api
                              ?.setGameEnabled?.(g.appId, e.target.checked)
                              .then(() => load())
                          }
                        />
                        Algıla
                      </label>
                      <button
                        type="button"
                        className="font-label-sm text-error hover:underline"
                        onClick={() =>
                          void api
                            ?.removeRegisteredGame?.(g.appId)
                            .then(() => load())
                        }
                      >
                        Kaldır
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
