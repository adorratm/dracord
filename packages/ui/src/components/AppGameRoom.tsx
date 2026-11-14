'use client';

import { useEffect, useState } from 'react';
import type { ChannelSummary, GameAppDto } from '@dracord/types';
import { cn } from '../lib/cn';
import { useGameSessions, type GamesClient } from '../lib/use-game-sessions';
import { GameFrame } from './GameFrame';

type Participant = { id: string; displayName: string; avatarUrl: string | null };

/**
 * GAME kanalı (gameKind 'app'): geliştirici portalındaki bir oyunu kanalın kendisinde açar.
 * Kanala girmek ses kanalına katılmaktır (oturum sunucuda ses üyeliğiyle doğrulanır), bu yüzden
 * `inVoice` gelene kadar başlat düğmesi bekler.
 */
export function AppGameRoom({
  client,
  guildId,
  channel,
  inVoice,
  platform,
  apiBase,
  resolveParticipant,
  onInvite,
  onSetStatus,
  className,
}: {
  client: GamesClient;
  guildId: string;
  channel: ChannelSummary;
  inVoice: boolean;
  platform: 'web' | 'desktop' | 'mobile';
  apiBase: string;
  resolveParticipant: (userId: string) => Participant;
  onInvite?: () => void;
  onSetStatus?: (text: string | null) => void;
  className?: string;
}) {
  const gameId = channel.gameAppId ?? null;
  const games = useGameSessions(client, guildId, channel.id);
  const [game, setGame] = useState<(GameAppDto & { testMode: boolean }) | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setGame(undefined);
    if (!gameId) {
      setGame(null);
      return;
    }
    void client
      .getGameCatalog()
      .then((list) => !cancelled && setGame(list.find((g) => g.id === gameId) ?? null))
      .catch(() => !cancelled && setGame(null));
    return () => {
      cancelled = true;
    };
  }, [client, gameId]);

  if (games.openSession) {
    return (
      <GameFrame
        client={client}
        session={games.openSession}
        platform={platform}
        apiBase={apiBase}
        resolveParticipant={resolveParticipant}
        onClose={(o) => void games.close(o)}
        onInvite={onInvite}
        onSetStatus={onSetStatus}
        className={className}
      />
    );
  }

  const live = games.sessions.find((s) => s.gameId === gameId) ?? null;
  const players = live?.participantIds.length ?? 0;
  const play = async () => {
    if (!gameId) return;
    setBusy(true);
    try {
      await games.start(gameId);
    } finally {
      setBusy(false);
    }
  };

  const unavailable = game === null;
  return (
    <div className={cn('relative flex min-h-0 flex-1 items-end overflow-hidden bg-surface-container-lowest', className)}>
      {game?.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={game.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/70 to-transparent" />
      <div className="relative flex w-full max-w-2xl flex-col gap-3 p-6 sm:p-10">
        <div className="flex items-center gap-3">
          {game?.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.iconUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
          ) : (
            <span className="material-symbols-outlined grid h-14 w-14 place-items-center rounded-xl bg-surface-container-high text-[28px]" aria-hidden>
              sports_esports
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate font-headline-md text-on-surface">{game?.name ?? channel.name}</h2>
            {game ? (
              <p className="font-body-sm text-on-surface-variant">
                {game.minPlayers === game.maxPlayers ? `${game.maxPlayers} oyuncu` : `${game.minPlayers}–${game.maxPlayers} oyuncu`}
                {game.testMode ? ' · test modu' : ''}
              </p>
            ) : null}
          </div>
        </div>
        {game?.shortDescription ? <p className="font-body-md text-on-surface">{game.shortDescription}</p> : null}
        {unavailable ? (
          <p className="font-body-sm text-error">Bu oyun şu an oynanamıyor (yayından kalkmış ya da erişimin yok).</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!inVoice || busy || game === undefined}
              onClick={() => void play()}
              className="h-11 rounded-lg bg-primary-container px-6 font-label-lg text-on-primary-container disabled:opacity-60"
            >
              {!inVoice ? 'Kanala bağlanılıyor…' : busy ? 'Açılıyor…' : live ? `Oyuna katıl (${players} oyuncu)` : 'Oyunu başlat'}
            </button>
            {live ? <span className="font-body-sm text-on-surface-variant">Bu kanalda oyun açık</span> : null}
          </div>
        )}
        {games.error ? <p className="font-body-sm text-error">{games.error}</p> : null}
      </div>
    </div>
  );
}
