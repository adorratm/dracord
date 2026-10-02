'use client';

import { Suspense, use } from 'react';
import { GuildChannelView } from '@/components/GuildChannelView';
import { RequireAuth } from '@/components/RequireAuth';

interface PageProps {
  params: Promise<{ guildId: string; channelId: string }>;
  searchParams: Promise<{
    around?: string;
    messageId?: string;
    thread?: string;
    threadMessage?: string;
  }>;
}

export default function GuildChannelPage({ params, searchParams }: PageProps) {
  const { guildId, channelId } = use(params);
  const sp = use(searchParams);
  const aroundMessageId = sp.messageId ?? sp.around ?? null;

  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <GuildChannelView
          guildId={guildId}
          channelId={channelId}
          aroundMessageId={aroundMessageId}
          openThreadId={sp.thread ?? null}
        />
      </Suspense>
    </RequireAuth>
  );
}
