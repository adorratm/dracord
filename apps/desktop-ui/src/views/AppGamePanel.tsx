import { useEffect } from 'react';
import type { ChannelSummary, PublicUser } from '@dracord/types';
import { AppGameRoom } from '@dracord/ui';
import { useAuth } from '../auth';
import { useVoiceSession } from '../voice/VoiceSession';

/** GAME kanalı (gameKind 'app'): kanalın sesine katıl, geliştirici oyununu kanalda aç. */
export function AppGamePanel({
  guildId,
  channel,
  members,
}: {
  guildId: string;
  channel: ChannelSummary;
  members: PublicUser[];
}) {
  const { client } = useAuth();
  const voice = useVoiceSession();
  const joinVoice = voice.join;
  useEffect(() => {
    void joinVoice(guildId, { id: channel.id, name: channel.name, type: channel.type });
  }, [channel.id, channel.name, channel.type, guildId, joinVoice]);

  const inVoice = voice.voiceChannelId === channel.id && voice.voiceGuildId === guildId;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-surface-container-high px-4">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden>
          sports_esports
        </span>
        <span className="truncate font-label-lg text-on-surface">{channel.name}</span>
      </div>
      <AppGameRoom
        client={client}
        guildId={guildId}
        channel={channel}
        inVoice={inVoice}
        platform="desktop"
        apiBase={client.apiBaseUrl}
        resolveParticipant={(id) => {
          const m = members.find((x) => x.id === id);
          return { id, displayName: m?.displayName ?? m?.username ?? 'Oyuncu', avatarUrl: m?.avatarUrl ?? null };
        }}
        className="flex-1"
      />
    </div>
  );
}
