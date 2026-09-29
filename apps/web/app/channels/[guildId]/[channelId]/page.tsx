'use client';

import { Suspense, use } from 'react';
import { GuildChannelView } from '@/components/GuildChannelView';
import { RequireAuth } from '@/components/RequireAuth';

interface PageProps {
  params: Promise<{ guildId: string; channelId: string }>;
  searchParams: Promise<{ around?: string }>;
}

export default function GuildChannelPage({ params, searchParams }: PageProps) {
  const { guildId, channelId } = use(params);
  const sp = use(searchParams);

  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <GuildChannelView
          guildId={guildId}
          channelId={channelId}
          aroundMessageId={sp.around ?? null}
        />
      </Suspense>
    </RequireAuth>
  );
}
