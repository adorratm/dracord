import type { ChannelSummary } from '@dracord/types';
import { GuildEventsModal as SharedGuildEventsModal } from '@dracord/ui';
import { useAuth } from '../auth';

/** Sunucu etkinlikleri — ortak bileşen @dracord/ui'da (desktop artık RSVP ve sahne etkinliklerini de destekliyor) */
export function GuildEventsModal(props: { open: boolean; onClose: () => void; guildId: string; channels: ChannelSummary[] }) {
  const { client } = useAuth();
  return <SharedGuildEventsModal client={client} {...props} />;
}
