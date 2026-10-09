'use client';

import type { ActivitySessionDto } from '@dracord/types';

const POINTS = 24;

export function TavlaGame({
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
  const board =
    (session.state.board as number[] | undefined) ??
    Array.from({ length: POINTS }, (_, i) => (i === 0 ? 2 : i === 23 ? -2 : 0));
  const dice = (session.state.dice as number[] | undefined) ?? [1, 1];
  const turn = Number(session.state.turn ?? 0);
  const myIndex = session.playerIds.indexOf(userId ?? '');
  const myTurn = canPlay && myIndex === turn % Math.max(1, session.playerIds.length);
  const white = myIndex === 0;

  const rollDice = () => {
    if (!myTurn) return;
    const d = [
      1 + Math.floor(Math.random() * 6),
      1 + Math.floor(Math.random() * 6),
    ];
    void onPatch({ dice: d, board, turn });
  };

  const move = (from: number) => {
    if (!myTurn) return;
    const dir = white ? 1 : -1;
    const step = dice[0] ?? 1;
    const to = from + dir * step;
    if (to < 0 || to >= POINTS) return;
    const next = [...board];
    const mine = white ? 1 : -1;
    if (Math.sign(next[from] ?? 0) !== mine && (next[from] ?? 0) !== 0) return;
    next[from] = (next[from] ?? 0) - mine;
    next[to] = (next[to] ?? 0) + mine;
    void onPatch({ board: next, dice, turn: turn + 1 });
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[#1a120b] p-space-sm">
      <div className="flex justify-between font-label-sm text-[#f2e6d0] mb-space-xs">
        <span>Tavla</span>
        <span>
          Zar: {dice[0]}-{dice[1]} · {myTurn ? 'Senin sıran' : 'Rakip'}
        </span>
      </div>
      <div className="flex-1 grid grid-cols-12 gap-0.5 content-stretch min-h-0">
        {board.map((n, i) => (
          <button
            key={i}
            type="button"
            disabled={!myTurn}
            onClick={() => move(i)}
            className="relative min-h-[2.5rem] rounded-sm bg-[#3d2914] border border-[#5c3d1e] disabled:opacity-80"
          >
            {n !== 0 && (
              <span
                className={`absolute inset-x-0.5 bottom-0.5 h-3 rounded-full ${
                  n > 0 ? 'bg-[#f8f8f2]' : 'bg-[#282a36] border border-white/30'
                }`}
                title={`${Math.abs(n)}`}
              />
            )}
            <span className="absolute top-0.5 left-0.5 text-[8px] text-white/40">{i + 1}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!myTurn}
        onClick={rollDice}
        className="mt-space-sm h-10 rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-40"
      >
        Zar at
      </button>
    </div>
  );
}
