import { useEffect, useState } from 'react';
import type {
  ChannelSummary,
  PublicUser,
  VoiceMemberSummary,
  VoiceStatePayload,
} from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import type { DracordClient } from '@dracord/sdk';
import type { VoiceParticipant } from '@dracord/ui';

/** Web GuildChannelView ile aynı: API seed + voice:state + LiveKit peers */
export function useVoiceMembersByChannel({
  client,
  user,
  guildId,
  channels,
  members,
  voiceChannelId,
  voiceGuildId,
  peers,
  muted,
  deafened,
  afkChannelId,
}: {
  client: DracordClient;
  user: PublicUser | null;
  guildId: string | null;
  channels: ChannelSummary[];
  members: PublicUser[];
  voiceChannelId: string | null;
  voiceGuildId: string | null;
  peers: VoiceParticipant[];
  muted: boolean;
  deafened: boolean;
  afkChannelId?: string | null;
}) {
  const [voiceMembersByChannel, setVoiceMembersByChannel] = useState<
    Record<string, VoiceMemberSummary[]>
  >({});

  useEffect(() => {
    if (!guildId) {
      setVoiceMembersByChannel({});
      return;
    }
    const map: Record<string, VoiceMemberSummary[]> = {};
    for (const ch of channels) {
      if (ch.type !== 'VOICE' && ch.type !== 'GAME' && ch.type !== 'WATCH_PARTY') continue;
      let list = [...(ch.voiceMembers ?? [])];
      if (user && voiceChannelId !== ch.id) {
        list = list.filter((m) => m.id !== user.id);
      }
      map[ch.id] = list;
    }
    setVoiceMembersByChannel((prev) => {
      const next = { ...map };
      if (voiceGuildId === guildId && voiceChannelId && prev[voiceChannelId]) {
        const local = prev[voiceChannelId]!;
        const api = next[voiceChannelId] ?? [];
        const byId = new Map(api.map((m) => [m.id, m]));
        for (const m of local) {
          const existing = byId.get(m.id);
          byId.set(
            m.id,
            existing
              ? { ...existing, ...m, speaking: m.speaking ?? existing.speaking }
              : m,
          );
        }
        next[voiceChannelId] = [...byId.values()];
      }
      if (user && (!voiceChannelId || voiceGuildId !== guildId)) {
        for (const key of Object.keys(next)) {
          next[key] = (next[key] ?? []).filter((m) => m.id !== user.id);
        }
      }
      return next;
    });
  }, [channels, voiceChannelId, voiceGuildId, guildId, user]);

  useEffect(() => {
    if (!user || !guildId) return;
    const sock = client.connectSocket();
    client.joinChannel(guildId);

    const onVoice = (payload: VoiceStatePayload) => {
      if (payload.guildId !== guildId) return;
      if (
        payload.user.id === user.id &&
        payload.action !== 'leave' &&
        payload.channelId &&
        voiceChannelId !== payload.channelId
      ) {
        return;
      }
      setVoiceMembersByChannel((prev) => {
        const next = { ...prev };
        if (payload.action === 'leave' || !payload.channelId) {
          for (const key of Object.keys(next)) {
            next[key] = (next[key] ?? []).filter((m) => m.id !== payload.user.id);
          }
          if (payload.channelId) {
            next[payload.channelId] = (next[payload.channelId] ?? []).filter(
              (m) => m.id !== payload.user.id,
            );
          }
          return next;
        }
        for (const key of Object.keys(next)) {
          next[key] = (next[key] ?? []).filter((m) => m.id !== payload.user.id);
        }
        const list = [...(next[payload.channelId] ?? []).filter((m) => m.id !== payload.user.id)];
        const isAfk = Boolean(afkChannelId && payload.channelId === afkChannelId);
        list.push(
          isAfk
            ? { ...payload.user, muted: true, deafened: true, speaking: false }
            : payload.user,
        );
        next[payload.channelId] = list;
        return next;
      });
    };

    sock.on(SocketEvents.VOICE_STATE, onVoice);
    return () => {
      sock.off(SocketEvents.VOICE_STATE, onVoice);
    };
  }, [client, guildId, user, voiceChannelId, afkChannelId]);

  useEffect(() => {
    if (!voiceChannelId || voiceGuildId !== guildId) {
      if (!user) return;
      setVoiceMembersByChannel((prev) => {
        let changed = false;
        const next: Record<string, VoiceMemberSummary[]> = {};
        for (const [id, list] of Object.entries(prev)) {
          const filtered = list.filter((m) => m.id !== user.id);
          if (filtered.length !== list.length) changed = true;
          next[id] = filtered;
        }
        return changed ? next : prev;
      });
      return;
    }
    setVoiceMembersByChannel((prev) => {
      const existing = prev[voiceChannelId] ?? [];
      const byId = new Map(existing.map((m) => [m.id, m]));
      const isAfkChannel = Boolean(afkChannelId && voiceChannelId === afkChannelId);
      return {
        ...prev,
        [voiceChannelId]: peers.map((p) => {
          const m = members.find((g) => g.id === p.id);
          const prior = byId.get(p.id);
          const isSelf = p.id === user?.id;
          return {
            id: p.id,
            displayName: p.displayName || m?.displayName || prior?.displayName || p.id,
            avatarUrl: p.avatarUrl || m?.avatarUrl || prior?.avatarUrl || null,
            muted: isAfkChannel ? true : isSelf ? muted : Boolean(p.muted),
            deafened: isAfkChannel ? true : isSelf ? deafened : Boolean(prior?.deafened),
            speaking: isAfkChannel ? false : Boolean(p.speaking),
            screenSharing: Boolean(
              (p as { screenSharing?: boolean }).screenSharing ?? prior?.screenSharing,
            ),
            isBot: Boolean((p as { isBot?: boolean }).isBot || m?.isBot || prior?.isBot),
            joinedAt: prior?.joinedAt,
          };
        }),
      };
    });
  }, [
    guildId,
    afkChannelId,
    voiceChannelId,
    voiceGuildId,
    peers,
    muted,
    deafened,
    user,
    members,
  ]);

  return voiceMembersByChannel;
}
