'use client';

import type { ActivitySessionDto } from '@dracord/types';

export function BowlingGame({
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
  const frames = (session.state.frames as Record<string, number[]> | undefined) ?? {};
  const turn = Number(session.state.turn ?? 0);
  const myIndex = session.playerIds.indexOf(userId ?? '');
  const myTurn = canPlay && myIndex === turn % Math.max(1, session.playerIds.length);
  const myFrames = frames[userId ?? ''] ?? [];

  const roll = () => {
    if (!myTurn || !userId) return;
    const pins = Math.floor(Math.random() * 11);
    const next = { ...frames, [userId]: [...myFrames, pins].slice(-20) };
    void onPatch({ frames: next, turn: turn + 1, lastRoll: pins });
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-[#2b2140] to-[#1a1228] p-space-md">
      <div
        className="flex-1 rounded-xl border border-white/10 relative overflow-hidden mb-space-sm"
        style={{
          background:
            'linear-gradient(180deg,#3d2a5c 0%,#5a3d7a 40%,#d4c4a8 40%,#c4b08a 100%)',
          perspective: '800px',
        }}
      >
        <div
          className="absolute inset-x-[15%] top-[42%] bottom-[8%] bg-[#e8dcc4]/90 origin-top"
          style={{ transform: 'rotateX(55deg)' }}
        />
        <div className="absolute top-[18%] left-1/2 -translate-x-1/2 flex gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="w-2.5 h-8 rounded-full bg-white shadow"
              style={{ transform: `translateY(${(i % 3) * 2}px)` }}
            />
          ))}
        </div>
        <p className="absolute bottom-2 inset-x-0 text-center font-label-sm text-white/90">
          Son atış: {String(session.state.lastRoll ?? '—')}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-xs mb-space-sm max-h-28 overflow-y-auto">
        {session.playerIds.map((id, i) => {
          const f = frames[id] ?? [];
          const total = f.reduce((a, b) => a + b, 0);
          return (
            <div key={id} className="rounded-lg bg-black/30 px-2 py-1.5">
              <p className="font-label-sm text-white/70 truncate">P{i + 1}</p>
              <p className="font-headline-md text-white tabular-nums">{total}</p>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        disabled={!myTurn}
        onClick={roll}
        className="h-11 rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-40"
      >
        {myTurn ? 'Topu at' : canPlay ? 'Sıra başkasında' : 'İzliyorsun'}
      </button>
    </div>
  );
}
