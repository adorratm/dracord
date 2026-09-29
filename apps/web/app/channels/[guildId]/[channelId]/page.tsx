'use client';

import { use } from 'react';
import { GuildChannelView } from '@/components/GuildChannelView';
import { RequireAuth } from '@/components/RequireAuth';

interface PageProps {
  params: Promise<{ guildId: string; channelId: string }>;
}

export default function GuildChannelPage({ params }: PageProps) {
  const { guildId, channelId } = use(params);

  return (
    <RequireAuth>
      <GuildChannelView guildId={guildId} channelId={channelId} />
    </RequireAuth>
  );
}
