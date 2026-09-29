'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Draco, DracoEmpty } from '@/components/Draco';

export default function InviteJoinPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { client, ready, user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    const code = params.code;
    if (!code) return;
    void (async () => {
      try {
        const guild = await client.joinInvite(code);
        const channels = await client.getGuildChannels(guild.id);
        const text = channels.find((c) => c.type === 'TEXT') ?? channels[0];
        router.replace(text ? `/channels/${guild.id}/${text.id}` : '/channels/@me');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Davet geçersiz');
      }
    })();
  }, [ready, user, params.code, client, router]);

  return (
    <div className="h-screen flex items-center justify-center bg-surface text-on-surface">
      {error ? (
        <DracoEmpty
          mood="confused"
          size={140}
          title="Davet geçersiz"
          description={error}
        >
          <button
            type="button"
            className="mt-2 px-space-md py-space-sm rounded-lg bg-surface-container-high hover:bg-surface-bright font-label-md"
            onClick={() => router.push('/channels/@me')}
          >
            Ana sayfaya dön
          </button>
        </DracoEmpty>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Draco size={96} mood="float" glow />
          <p className="text-on-surface-variant font-body-md">Davete katılınıyor…</p>
        </div>
      )}
    </div>
  );
}
