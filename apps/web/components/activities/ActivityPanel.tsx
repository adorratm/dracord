'use client';

import type { ActivityKind, ActivitySessionDto } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { BilliardsGame } from '@/components/activities/games/BilliardsGame';
import { OkeyGame } from '@/components/activities/games/OkeyGame';
import { BowlingGame } from '@/components/activities/games/BowlingGame';
import { TavlaGame } from '@/components/activities/games/TavlaGame';
import { WatchPartyRoom } from '@/components/activities/games/WatchPartyRoom';
import { cn } from '@dracord/ui';

const KINDS: { id: ActivityKind; label: string; hint: string }[] = [
  { id: 'billiards', label: 'Bilardo', hint: '2 oyuncu' },
  { id: 'okey', label: 'Okey', hint: '4 oyuncu' },
  { id: 'bowling', label: 'Bowling', hint: '2–8 oyuncu' },
  { id: 'tavla', label: 'Tavla', hint: '2 oyuncu' },
  { id: 'watch_party', label: 'Watch Party', hint: 'Moderatör + izleyiciler' },
];

export function ActivityPanel({
  guildId,
  voiceChannelId,
  className,
}: {
  guildId: string;
  voiceChannelId: string;
  className?: string;
}) {
  const { client, user } = useAuth();
  const [session, setSession] = useState<ActivitySessionDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await client.getChannelActivity(guildId, voiceChannelId);
      setSession(s);
    } catch {
      setSession(null);
    }
  }, [client, guildId, voiceChannelId]);

  useEffect(() => {
    client.joinChannel(voiceChannelId);
    void refresh();
    const sock = client.connectSocket();
    const onUpsert = (payload: ActivitySessionDto) => {
      if (payload.voiceChannelId === voiceChannelId) setSession(payload);
    };
    const onLeave = (payload: ActivitySessionDto) => {
      if (payload.voiceChannelId !== voiceChannelId) return;
      if (payload.status === 'ended') setSession(null);
      else setSession(payload);
    };
    sock.on(SocketEvents.ACTIVITY_UPSERT, onUpsert);
    sock.on(SocketEvents.ACTIVITY_STATE, onUpsert);
    sock.on(SocketEvents.ACTIVITY_LEAVE, onLeave);
    return () => {
      sock.off(SocketEvents.ACTIVITY_UPSERT, onUpsert);
      sock.off(SocketEvents.ACTIVITY_STATE, onUpsert);
      sock.off(SocketEvents.ACTIVITY_LEAVE, onLeave);
    };
  }, [client, voiceChannelId, refresh]);

  const start = async (kind: ActivityKind) => {
    setBusy(true);
    setError(null);
    try {
      const s = await client.startActivity({ guildId, voiceChannelId, kind });
      setSession(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Başlatılamadı');
    } finally {
      setBusy(false);
    }
  };

  const join = async (spectator: boolean) => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const s = await client.joinActivity(session.id, spectator);
      setSession(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Katılınamadı');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await client.leaveActivity(session.id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const patch = async (state: Record<string, unknown>) => {
    if (!session) return;
    const s = await client.patchActivityState(session.id, state);
    setSession(s);
  };

  const me = user?.id;
  const isPlayer = Boolean(me && session?.playerIds.includes(me));
  const isSpectator = Boolean(me && session?.spectatorIds.includes(me));
  const isHost = Boolean(me && session?.hostUserId === me);
  const full = Boolean(session && session.playerIds.length >= session.maxPlayers);

  return (
    <div
      className={cn(
        'flex flex-col min-h-0 rounded-xl border border-surface-container-high bg-surface-container-low overflow-hidden',
        className,
      )}
    >
      <header className="h-11 px-space-md flex items-center justify-between border-b border-surface-container-high shrink-0">
        <span className="font-label-sm text-on-surface flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-primary-container">
            sports_esports
          </span>
          Mini oyun / Watch Party
        </span>
        {session && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void leave()}
            className="font-label-sm text-error hover:underline"
          >
            Ayrıl
          </button>
        )}
      </header>

      {error && (
        <p className="px-space-md py-space-xs font-body-sm text-error">{error}</p>
      )}

      {!session ? (
        <div className="p-space-md grid grid-cols-2 sm:grid-cols-3 gap-space-sm overflow-y-auto">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              disabled={busy}
              onClick={() => void start(k.id)}
              className="rounded-xl border border-surface-container-high bg-surface-container px-space-sm py-space-md text-left hover:border-primary-container/50 transition-colors"
            >
              <p className="font-headline-md text-on-surface">{k.label}</p>
              <p className="font-label-sm text-outline mt-1">{k.hint}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-space-md py-space-sm flex flex-wrap items-center gap-space-sm border-b border-surface-container-high">
            <span className="font-label-sm text-primary-container uppercase">
              {session.kind.replace('_', ' ')}
            </span>
            <span className="font-label-sm text-outline">
              {session.playerIds.length}/{session.maxPlayers} oyuncu
              {session.spectatorIds.length > 0
                ? ` · ${session.spectatorIds.length} izleyici`
                : ''}
            </span>
            {!isPlayer && !isSpectator && (
              <>
                {!full && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void join(false)}
                    className="h-8 px-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm"
                  >
                    Oyuna katıl
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void join(true)}
                  className="h-8 px-space-sm rounded-lg bg-surface-container-high font-label-sm"
                >
                  İzle
                </button>
              </>
            )}
            {full && !isPlayer && (
              <span className="font-label-sm text-outline">Oda dolu — izleyebilirsin</span>
            )}
            {isHost && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void client.endActivity(session.id).then(() => setSession(null))}
                className="ml-auto h-8 px-space-sm rounded-lg text-error font-label-sm hover:bg-error/10"
              >
                Bitir
              </button>
            )}
          </div>
          <div className="flex-1 min-h-[220px] sm:min-h-[320px] relative">
            {session.kind === 'billiards' && (
              <BilliardsGame
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
              />
            )}
            {session.kind === 'okey' && (
              <OkeyGame session={session} userId={me} canPlay={isPlayer} onPatch={patch} />
            )}
            {session.kind === 'bowling' && (
              <BowlingGame
                session={session}
                userId={me}
                canPlay={isPlayer}
                onPatch={patch}
              />
            )}
            {session.kind === 'tavla' && (
              <TavlaGame session={session} userId={me} canPlay={isPlayer} onPatch={patch} />
            )}
            {session.kind === 'watch_party' && (
              <WatchPartyRoom
                session={session}
                userId={me}
                isHost={isHost}
                onPatch={patch}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
