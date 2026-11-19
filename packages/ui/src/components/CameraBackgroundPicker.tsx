'use client';

import { useEffect, useState } from 'react';
import { CAMERA_BACKGROUND_PRESETS, presetImageUrl } from '../lib/camera-background';
import { useCameraBackground } from '../lib/use-camera-background';
import { cn } from '../lib/cn';
import { SettingsSection } from './SettingsControls';

/** A10 — Ayarlar › Ses ve Görüntü: kamera arka planı */
export function CameraBackgroundPicker() {
  const [s, update] = useCameraBackground();
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    setThumbs(Object.fromEntries(CAMERA_BACKGROUND_PRESETS.map((p) => [p.id, presetImageUrl(p.id)])));
  }, []);
  const tile = (active: boolean, onClick: () => void, label: string, children: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 bg-surface-container-high transition-colors',
        active ? 'border-primary' : 'border-transparent hover:border-outline',
      )}
    >
      {children}
      <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5 text-[10px] text-white truncate">{label}</span>
    </button>
  );
  return (
    <SettingsSection title="Kamera arka planı">
      <div className="px-space-md py-space-md space-y-2">
        <div className="flex flex-wrap gap-2">
          {tile(s.mode === 'none', () => update({ mode: 'none' }), 'Yok', <span className="material-symbols-outlined absolute inset-0 m-auto h-fit w-fit text-outline">block</span>)}
          {tile(
            s.mode === 'blur' && s.blur === 'light',
            () => update({ mode: 'blur', blur: 'light' }),
            'Hafif bulanık',
            <span className="material-symbols-outlined absolute inset-0 m-auto h-fit w-fit text-on-surface-variant">blur_on</span>,
          )}
          {tile(
            s.mode === 'blur' && s.blur === 'strong',
            () => update({ mode: 'blur', blur: 'strong' }),
            'Çok bulanık',
            <span className="material-symbols-outlined absolute inset-0 m-auto h-fit w-fit text-on-surface">blur_circular</span>,
          )}
          {CAMERA_BACKGROUND_PRESETS.map((p) =>
            tile(
              s.mode === 'image' && s.preset === p.id,
              () => update({ mode: 'image', preset: p.id }),
              p.label,
              thumbs[p.id] ? <img src={thumbs[p.id]} alt="" className="h-full w-full object-cover" /> : null,
            ),
          )}
        </div>
        <p className="font-body-sm text-outline">
          Arka plan cihazında işlenir; görüntün hiçbir sunucuya gitmez. Kamera açıkken anında uygulanır. İlk kullanımda
          küçük bir model (~250 KB) iner.
        </p>
      </div>
    </SettingsSection>
  );
}
