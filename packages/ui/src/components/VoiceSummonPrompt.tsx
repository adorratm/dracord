'use client';

import { useEffect, useState } from 'react';
import type { VoiceSummonPayload } from '@dracord/types';
import { Avatar } from './Avatar';

interface Props {
  client: {
    connectSocket(): unknown;
    onVoiceSummon(handler: (p: VoiceSummonPayload) => void): () => void;
  };
  onAccept: (p: VoiceSummonPayload) => void;
}

const SHOW_MS = 45_000;

/** "X seni #Genel ses kanalına çağırıyor" — Katıl / Şimdi değil (nobody is pulled into a call without saying yes) */
export function VoiceSummonPrompt({ client, onAccept }: Props) {
  const [summon, setSummon] = useState<VoiceSummonPayload | null>(null);

  useEffect(() => {
    client.connectSocket();
    return client.onVoiceSummon((p) => setSummon(p));
  }, [client]);

  useEffect(() => {
    if (!summon) return;
    const t = setTimeout(() => setSummon(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [summon]);

  if (!summon) return null;
  return (
    <div
      role="alertdialog"
      aria-label="Ses kanalına çağrı"
      className="fixed bottom-24 right-4 z-[110] w-[min(100%-2rem,22rem)] rounded-xl border border-primary/40 bg-surface-container-high shadow-float p-3 flex items-start gap-3"
    >
      <Avatar displayName={summon.from.displayName} imageUrl={summon.from.avatarUrl} size="md" />
      <div className="min-w-0 flex-1">
        <p className="font-body-md text-on-surface">
          <strong>{summon.from.displayName}</strong> seni <strong>🔊 {summon.channelName}</strong> kanalına çağırıyor
        </p>
        <p className="font-body-sm text-on-surface-variant truncate">{summon.guildName}</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
            onClick={() => {
              const p = summon;
              setSummon(null);
              onAccept(p);
            }}
          >
            Katıl
          </button>
          <button type="button" className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-sm" onClick={() => setSummon(null)}>
            Şimdi değil
          </button>
        </div>
      </div>
    </div>
  );
}
