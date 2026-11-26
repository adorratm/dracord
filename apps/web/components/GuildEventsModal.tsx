'use client';

import type { ChannelSummary } from '@dracord/types';
import { GuildEventsModal as SharedGuildEventsModal } from '@dracord/ui';
import { useAuth } from '@/components/AuthProvider';

/** Sunucu etkinlikleri — ortak bileşen @dracord/ui'da */
export function GuildEventsModal(props: { open: boolean; onClose: () => void; guildId: string; channels: ChannelSummary[] }) {
  const { client } = useAuth();
  return <SharedGuildEventsModal client={client} {...props} />;
}
