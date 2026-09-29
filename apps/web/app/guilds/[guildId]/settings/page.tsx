'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { useGuildNav } from '@/hooks/useGuildNav';
import type { GuildSummary } from '@dracord/types';

interface PageProps {
  params: Promise<{ guildId: string }>;
}

export default function GuildSettingsPage({ params }: PageProps) {
  const { guildId } = use(params);
  const router = useRouter();
  const { client } = useAuth();
  const { guilds, guild } = useGuildNav(guildId);
  const [detail, setDetail] = useState<GuildSummary | null>(guild);

  useEffect(() => {
    setDetail(guild);
  }, [guild]);

  useEffect(() => {
    if (!guild && guildId) {
      void fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/guilds/${guildId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('dracord_access_token') ?? ''}`,
        },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then(setDetail)
        .catch(() => undefined);
    }
  }, [guild, guildId, client]);

  return (
    <RequireAuth>
      <AppShell guilds={guilds} activeGuildId={guildId} subtitle="Sunucu ayarları">
        <div className="flex-1 overflow-y-auto bg-surface px-space-xl py-space-xl">
          <button
            type="button"
            className="mb-space-lg text-primary font-body-sm hover:underline"
            onClick={() => router.push(`/channels/${guildId}/seed-ch-genel`)}
          >
            ← Kanallara dön
          </button>
          <h1 className="font-headline-xl text-headline-xl text-on-surface mb-space-md">
            {detail?.name ?? 'Sunucu'} — Genel Bakış
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-space-xl">
            Sunucu ayarları arayüzü (mock). API ile sunucu kimliği doğrulandı.
          </p>
          <dl className="grid gap-space-md max-w-lg">
            <div className="rounded-lg bg-surface-container-low p-space-md">
              <dt className="font-label-sm text-label-sm text-outline uppercase">Sunucu ID</dt>
              <dd className="font-body-md text-body-md mt-1">{guildId}</dd>
            </div>
            <div className="rounded-lg bg-surface-container-low p-space-md">
              <dt className="font-label-sm text-label-sm text-outline uppercase">Sahip ID</dt>
              <dd className="font-body-md text-body-md mt-1">{detail?.ownerId ?? '—'}</dd>
            </div>
            <div className="rounded-lg bg-surface-container-low p-space-md">
              <dt className="font-label-sm text-label-sm text-outline uppercase">Roller</dt>
              <dd className="font-body-md text-body-md mt-1">@everyone, Nosferatu Mod (seed)</dd>
            </div>
          </dl>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
