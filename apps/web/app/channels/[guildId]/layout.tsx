'use client';

import { Suspense, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { ChannelKeepAliveHost } from '@/components/ChannelKeepAliveHost';

/**
 * guildId layout’u kanal geçişlerinde mount’ta kalır.
 * channelId varken keep-alive host mesaj görünümünü tutar.
 */
export default function GuildIdLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ channelId?: string }>();
  if (params.channelId) {
    return (
      <Suspense fallback={null}>
        <ChannelKeepAliveHost />
      </Suspense>
    );
  }
  return children;
}
