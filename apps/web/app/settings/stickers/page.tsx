'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useUserPreferences } from '@/lib/user-preferences';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { applyStickerCloudState } from '@dracord/ui';

type Pack = {
  id: string;
  name: string;
  description: string;
  nitroOnly: boolean;
  count: number;
  preview: string[];
};

export default function StickersMarketplacePage() {
  const { client } = useAuth();
  const { prefs, setSection } = useUserPreferences();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPacks(await client.listStickerMarketplace());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const install = async (pack: Pack) => {
    if (pack.nitroOnly && prefs.billing.nitroPlan === 'none') {
      setError('Bu paket için Nitro gerekir');
      return;
    }
    setBusy(pack.id);
    setError(null);
    try {
      const res = await client.installStickerPack(pack.id);
      setSection('stickers', res.stickers);
      applyStickerCloudState(res.stickers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kurulum başarısız');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsPage
      title="Sticker mağazası"
      description="Kürate emoji / sticker paketlerini kütüphanene ekle."
    >
      <SettingsSection title="Paketler">
        {error && (
          <p className="px-space-md pt-space-md font-body-sm text-error">{error}</p>
        )}
        <div className="px-space-md py-space-md grid gap-3 sm:grid-cols-2">
          {packs.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-surface-container-highest p-space-md"
            >
              <p className="font-headline-md">
                {p.name}
                {p.nitroOnly ? (
                  <span className="ml-2 text-[10px] uppercase text-primary-container">
                    Nitro
                  </span>
                ) : null}
              </p>
              <p className="mt-1 font-body-sm text-on-surface-variant">{p.description}</p>
              <p className="mt-2 text-lg tracking-wide">{p.preview.join(' ')}</p>
              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => void install(p)}
                className="mt-3 h-8 px-3 rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
              >
                {busy === p.id ? '…' : 'Ekle'}
              </button>
            </div>
          ))}
        </div>
        <SettingsNote>
          Özel yüklemeler sohbet sticker panelinden; paketler buradan senkron ayarlarına
          yazılır.
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
