'use client';

import { useMemo, useState } from 'react';
import { SHARE_CODECS, canSendCodec, loadShareCodec, saveShareCodec, type ShareCodec } from '../lib/share-codec';
import { SettingsSection } from './SettingsControls';
import { cn } from '../lib/cn';

/** Ekran paylaşımı codec'i (deneme): H.264 / VP9 / AV1 */
export function ShareCodecSettings({ embedded = false }: { embedded?: boolean }) {
  const [codec, setCodec] = useState<ShareCodec>(() => loadShareCodec());
  const support = useMemo(() => Object.fromEntries(SHARE_CODECS.map((c) => [c.id, canSendCodec(c.id)])) as Record<ShareCodec, boolean>, []);
  const body = (
    <>
      <div className="grid grid-cols-1 gap-2 px-space-md py-space-md sm:grid-cols-2">
        {SHARE_CODECS.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={!support[c.id]}
            aria-pressed={codec === c.id}
            onClick={() => {
              setCodec(c.id);
              saveShareCodec(c.id);
            }}
            className={cn(
              'rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              codec === c.id ? 'border-primary bg-primary-container/15' : 'border-outline-variant hover:border-primary',
            )}
          >
            <span className="block font-body-md text-on-surface">{c.label}</span>
            <span className="block font-body-sm text-on-surface-variant">{support[c.id] ? c.hint : 'Bu cihaz desteklemiyor'}</span>
          </button>
        ))}
      </div>
      <p className="px-space-md pb-space-md font-body-sm text-outline">
        Bir sonraki paylaşımda geçerli olur. VP9/AV1 seçince desteklemeyen izleyiciler için ayrıca VP8 gönderilir. Farkı görmek için
        yayının sağ üstündeki <strong>istatistik</strong> düğmesini aç.
      </p>
    </>
  );
  return embedded ? body : <SettingsSection title="Ekran paylaşımı codec'i (deneme)">{body}</SettingsSection>;
}
