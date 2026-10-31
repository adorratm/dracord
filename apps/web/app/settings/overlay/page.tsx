'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

const HOTKEY_PRESETS = [
  'Control+Shift+`',
  'Control+Shift+O',
  'Alt+Shift+O',
  'F10',
] as const;

export default function OverlaySettingsPage() {
  const { prefs, setSection } = useUserPreferences();
  const o = prefs.overlay;
  const [customHotkey, setCustomHotkey] = useState(o.hotkey);

  useEffect(() => {
    setCustomHotkey(o.hotkey);
  }, [o.hotkey]);
  const isElectron = useMemo(
    () =>
      typeof window !== 'undefined' &&
      Boolean(
        (window as Window & { dracordDesktop?: { isElectron?: boolean } })
          .dracordDesktop?.isElectron,
      ),
    [],
  );

  const applyHotkey = (hotkey: string) => {
    const next = hotkey.trim() || 'Control+Shift+`';
    setCustomHotkey(next);
    setSection('overlay', { hotkey: next });
  };

  return (
    <SettingsPage
      title="Oyun Overlay"
      description="Discord/Steam tarzı masaüstü overlay — ses, üyeler ve hızlı sohbet."
    >
      <SettingsSection title="Genel">
        <SettingsToggle
          label="Overlay etkin"
          description="Kısayol ile şeffaf overlay penceresini aç/kapat."
          checked={o.enabled}
          disabled={!isElectron}
          onChange={(v) => setSection('overlay', { enabled: v })}
        />
        <SettingsToggle
          label="Aktif ekranı takip et"
          description="Monitör / oyun değişince overlay imleç ekranına taşınır."
          checked={o.followDisplay}
          disabled={!isElectron || !o.enabled}
          onChange={(v) => setSection('overlay', { followDisplay: v })}
        />
        <SettingsToggle
          label="Üye listesi"
          description="Ses kanalındaki katılımcıları overlay’de göster."
          checked={o.showMembers}
          disabled={!o.enabled}
          onChange={(v) => setSection('overlay', { showMembers: v })}
        />
        <SettingsToggle
          label="Hızlı sohbet"
          description="Overlay’den kısa toast mesajı gönder."
          checked={o.showQuickChat}
          disabled={!isElectron || !o.enabled}
          onChange={(v) => setSection('overlay', { showQuickChat: v })}
        />
      </SettingsSection>

      <SettingsSection title="Kısayol">
        <div className="px-space-md py-space-md space-y-3">
          <p className="font-body-sm text-on-surface-variant">
            Electron accelerator (örn. Control+Shift+`). Değişiklik masaüstünde
            anında uygulanır.
          </p>
          <div className="flex flex-wrap gap-2">
            {HOTKEY_PRESETS.map((h) => (
              <button
                key={h}
                type="button"
                disabled={!isElectron || !o.enabled}
                onClick={() => applyHotkey(h)}
                className={`px-space-md py-space-sm rounded-lg font-label-sm disabled:opacity-50 ${
                  o.hotkey === h
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container-high'
                }`}
              >
                {h}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={customHotkey}
              onChange={(e) => setCustomHotkey(e.target.value)}
              disabled={!isElectron || !o.enabled}
              className="flex-1 h-10 rounded-lg bg-surface-container-highest px-3 outline-none font-mono text-[12px] disabled:opacity-50"
              placeholder="Control+Shift+`"
            />
            <button
              type="button"
              disabled={!isElectron || !o.enabled}
              onClick={() => applyHotkey(customHotkey)}
              className="px-space-md rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
            >
              Uygula
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Görünüm">
        <div className="px-space-md py-space-md space-y-2">
          <label className="flex items-center justify-between gap-4 font-label-sm text-on-surface-variant">
            <span>Opaklık</span>
            <span className="tabular-nums text-outline">
              {Math.round(o.opacity * 100)}%
            </span>
          </label>
          <input
            type="range"
            min={40}
            max={100}
            step={1}
            value={Math.round(o.opacity * 100)}
            disabled={!isElectron || !o.enabled}
            onChange={(e) =>
              setSection('overlay', {
                opacity: Math.min(1, Math.max(0.4, Number(e.target.value) / 100)),
              })
            }
            className="w-full accent-primary-container disabled:opacity-50"
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Watch Party">
        <SettingsToggle
          label="Reklam ağı filtresi"
          description="Desktop’ta bilinen reklam/tracker host isteklerini keser (iframe DOM’una girmez)."
          checked={o.watchPartyAdblock}
          disabled={!isElectron}
          onChange={(v) => setSection('overlay', { watchPartyAdblock: v })}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsNote>
          {isElectron
            ? 'Exclusive fullscreen oyunlarda overlay güvenilir değildir; borderless pencere önerilir.'
            : 'Overlay yalnızca Dracord masaüstü uygulamasında çalışır. Web’de tercihler kaydedilir, uygulama açılınca uygulanır.'}
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
