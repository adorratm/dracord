import { useEffect, useState } from 'react';
import type {
  ChannelSummary,
  PublicUser,
  VoiceMemberSummary,
  VoiceStatePayload,
  VoiceSyncPayload,
} from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import type { DracordClient } from '@dracord/sdk';
import type { VoiceParticipant } from '@dracord/ui';

function applyRosterSnapshot(
  prev: Record<string, VoiceMemberSummary[]>,
  channels: ChannelSummary[],
  membersByChannel: Record<string, VoiceMemberSummary[]>,
  opts: {
    userId?: string | null;
    voiceChannelId?: string | null;
    voiceGuildId?: string | null;
    guildId: string;
  },
): Record<string, VoiceMemberSummary[]> {
  const next: Record<string, VoiceMemberSummary[]> = {};
  for (const ch of channels) {
    if (ch.type !== 'VOICE' && ch.type !== 'GAME' && ch.type !== 'WATCH_PARTY') {
      continue;
    }
    // Bağlı olduğumuz kanalı LiveKit peers kaynağı korusun
    if (
      opts.voiceGuildId === opts.guildId &&
      opts.voiceChannelId === ch.id &&
      prev[ch.id]?.length
    ) {
      next[ch.id] = prev[ch.id]!;
      continue;
    }
    let list = [...(membersByChannel[ch.id] ?? [])];
    if (opts.userId && opts.voiceChannelId !== ch.id) {
      list = list.filter((m) => m.id !== opts.userId);
    }
    next[ch.id] = list;
  }
  return next;
}

/** Web GuildChannelView ile aynı: API seed + voice:state + LiveKit peers + roster sync */
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
  const [voiceRosterReady, setVoiceRosterReady] = useState(false);

  useEffect(() => {
    if (!guildId) {
      setVoiceMembersByChannel({});
      setVoiceRosterReady(false);
      return;
    }
    setVoiceRosterReady(false);
    setVoiceMembersByChannel((prev) => {
      const next: Record<string, VoiceMemberSummary[]> = {};
      for (const ch of channels) {
        if (ch.type !== 'VOICE' && ch.type !== 'GAME' && ch.type !== 'WATCH_PARTY') {
          continue;
        }
        let apiList = [...(ch.voiceMembers ?? [])];
        if (user && voiceChannelId !== ch.id) {
          apiList = apiList.filter((m) => m.id !== user.id);
        }
        const prevList = prev[ch.id] ?? [];
        const byId = new Map(apiList.map((m) => [m.id, m]));
        if (apiList.length === 0) {
          for (const m of prevList) {
            if (user && m.id === user.id && voiceChannelId !== ch.id) continue;
            byId.set(m.id, m);
          }
        } else {
          // Dolu API: roster ile birleştir (socket’ten gelenleri kaybetme)
          for (const m of prevList) {
            const existing = byId.get(m.id);
            if (!existing) {
              byId.set(m.id, m);
              continue;
            }
            byId.set(m.id, {
              ...existing,
              ...m,
              speaking: m.speaking ?? existing.speaking,
            });
          }
        }
        next[ch.id] = [...byId.values()];
      }
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
    client.requestVoiceSync(guildId);

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

    const onSync = (payload: VoiceSyncPayload) => {
      if (payload.guildId !== guildId) return;
      setVoiceRosterReady(true);
      setVoiceMembersByChannel((prev) =>
        applyRosterSnapshot(prev, channels, payload.membersByChannel, {
          userId: user.id,
          voiceChannelId,
          voiceGuildId,
          guildId,
        }),
      );
    };

    sock.on(SocketEvents.VOICE_STATE, onVoice);
    sock.on(SocketEvents.VOICE_SYNC, onSync);
    return () => {
      sock.off(SocketEvents.VOICE_STATE, onVoice);
      sock.off(SocketEvents.VOICE_SYNC, onSync);
    };
  }, [client, guildId, user, voiceChannelId, voiceGuildId, afkChannelId, channels]);

  // Periyodik REST roster — socket kaçırılsa bile sidebar dolu kalsın
  useEffect(() => {
    if (!user || !guildId) return;
    let cancelled = false;
    const pull = () => {
      void client
        .getGuildVoiceRoster(guildId)
        .then((roster) => {
          if (cancelled) return;
          setVoiceRosterReady(true);
          setVoiceMembersByChannel((prev) =>
            applyRosterSnapshot(prev, channels, roster.membersByChannel, {
              userId: user.id,
              voiceChannelId,
              voiceGuildId,
              guildId,
            }),
          );
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [client, guildId, user, channels, voiceChannelId, voiceGuildId]);

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

  return { voiceMembersByChannel, voiceRosterReady };
}
