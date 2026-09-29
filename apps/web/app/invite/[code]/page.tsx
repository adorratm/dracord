'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

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
        <div className="text-center space-y-space-md">
          <p className="text-error">{error}</p>
          <button
            type="button"
            className="px-space-md py-space-sm rounded-lg bg-surface-container-high"
            onClick={() => router.push('/channels/@me')}
          >
            Ana sayfaya dön
          </button>
        </div>
      ) : (
        <p className="text-on-surface-variant">Davete katılınıyor…</p>
      )}
    </div>
  );
}
