'use client';

import { Suspense, use, useEffect, useState } from 'react';
import type { ChannelSummary } from '@dracord/types';
import { useAuth } from '@/components/AuthProvider';
import { ActivityChannelView } from '@/components/activities/ActivityChannelView';
import { persistSession } from '@/lib/storage';

/**
 * Mobil WebView gömme — web/desktop ile aynı Three.js oyunları.
 * Token’lar hash ile gelir: #accessToken=…&refreshToken=…
 */
function EmbedBootstrap({
  guildId,
  channelId,
}: {
  guildId: string;
  channelId: string;
}) {
  const { client, user, setUser, ready } = useAuth();
  const [channel, setChannel] = useState<ChannelSummary | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Hash veya localStorage oturumu (mobil bootstrap HTML localStorage yazar)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const hash = new URLSearchParams(
          typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '',
        );
        const accessToken = hash.get('accessToken');
        const refreshToken = hash.get('refreshToken');
        if (accessToken && refreshToken) {
          client.setToken(accessToken);
          client.connectSocket();
          const me = await client.getMe();
          persistSession(accessToken, refreshToken, me);
          setUser(me);
          if (typeof window !== 'undefined') {
            window.history.replaceState(
              null,
              '',
              `${window.location.pathname}${window.location.search}`,
            );
          }
        }
        if (!cancelled) setSessionReady(true);
      } catch (e) {
        if (!cancelled) {
          setBootError(e instanceof Error ? e.message : 'Oturum açılamadı');
          setSessionReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, setUser]);

  useEffect(() => {
    if (!sessionReady || !ready || !user) return;
    let cancelled = false;
    void client
      .getGuildChannels(guildId)
      .then((list) => {
        if (cancelled) return;
        const ch = list.find((c) => c.id === channelId) ?? null;
        if (!ch) setBootError('Kanal bulunamadı');
        else setChannel(ch);
      })
      .catch((e) => {
        if (!cancelled) {
          setBootError(e instanceof Error ? e.message : 'Kanallar yüklenemedi');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionReady, ready, user, client, guildId, channelId]);

  if (bootError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#11131e] px-6 text-center text-sm text-[#ff5555]">
        {bootError}
      </div>
    );
  }

  if (!channel || !user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#11131e] text-sm text-[#ccc3d3]">
        Oyun yükleniyor…
      </div>
    );
  }

  return (
    <ActivityChannelView
      guildId={guildId}
      channel={channel}
      embedMode
      className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#11131e]"
    />
  );
}

interface PageProps {
  params: Promise<{ guildId: string; channelId: string }>;
}

export default function MobileActivityEmbedPage({ params }: PageProps) {
  const { guildId, channelId } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#11131e] text-sm text-[#ccc3d3]">
          Oyun yükleniyor…
        </div>
      }
    >
      <EmbedBootstrap guildId={guildId} channelId={channelId} />
    </Suspense>
  );
}
