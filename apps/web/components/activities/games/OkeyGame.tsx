'use client';

import type { ActivitySessionDto } from '@dracord/types';
import { useMemo } from 'react';

export function OkeyGame({
  session,
  userId,
  canPlay,
  onPatch,
}: {
  session: ActivitySessionDto;
  userId?: string;
  canPlay: boolean;
  onPatch: (state: Record<string, unknown>) => Promise<void>;
}) {
  const turn = Number(session.state.turn ?? 0);
  const scores = (session.state.scores as Record<string, number>) ?? {};
  const myIndex = session.playerIds.indexOf(userId ?? '');
  const myTurn = canPlay && myIndex === turn % Math.max(1, session.playerIds.length);
  const tiles = useMemo(() => {
    const hand = (session.state.hands as Record<string, number[]> | undefined)?.[
      userId ?? ''
    ];
    if (hand?.length) return hand;
    return Array.from({ length: 14 }, (_, i) => ((i * 7 + turn) % 52) + 1);
  }, [session.state.hands, userId, turn]);

  const draw = () => {
    if (!myTurn || !userId) return;
    const hands = {
      ...((session.state.hands as Record<string, number[]>) ?? {}),
      [userId]: [...tiles, Math.floor(Math.random() * 52) + 1],
    };
    const nextScores = { ...scores, [userId]: (scores[userId] ?? 0) + 1 };
    void onPatch({ hands, scores: nextScores, turn: turn + 1 });
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-[#1e3a2f] to-[#0f241c] p-space-sm sm:p-space-md">
      <div className="flex justify-between font-label-sm text-white/80 mb-space-sm">
        <span>Okey 101 · {session.playerIds.length}/4</span>
        <span>{myTurn ? 'Senin sıran' : canPlay ? 'Rakip' : 'İzleyici'}</span>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-space-sm content-start overflow-y-auto">
        {session.playerIds.map((id, i) => (
          <div
            key={id}
            className="rounded-lg bg-black/30 border border-white/10 px-space-sm py-space-sm"
          >
            <p className="font-label-sm text-white/70 truncate">
              Oyuncu {i + 1}
              {id === userId ? ' (sen)' : ''}
            </p>
            <p className="font-headline-md text-white tabular-nums">
              {scores[id] ?? 0} taş
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 py-space-sm justify-center">
        {tiles.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="w-8 h-11 sm:w-9 sm:h-12 rounded bg-[#f8f8f2] text-[#282a36] font-bold text-xs flex items-center justify-center shadow"
          >
            {t}
          </span>
        ))}
      </div>
      <button
        type="button"
        disabled={!myTurn}
        onClick={draw}
        className="h-10 rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-40"
      >
        Taş çek / aç
      </button>
    </div>
  );
}
