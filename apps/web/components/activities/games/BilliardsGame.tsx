'use client';

import type { ActivitySessionDto } from '@dracord/types';
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

type Ball = { id: number; x: number; y: number; vx: number; vy: number; sunk?: boolean };

function initialBalls(): Ball[] {
  const balls: Ball[] = [{ id: 0, x: 0.28, y: 0.5, vx: 0, vy: 0 }];
  let n = 1;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      balls.push({
        id: n++,
        x: 0.62 + row * 0.045,
        y: 0.5 - row * 0.028 + col * 0.055,
        vx: 0,
        vy: 0,
      });
    }
  }
  return balls;
}

export function BilliardsGame({
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const balls = (session.state.balls as Ball[] | undefined) ?? initialBalls();
  const turn = Number(session.state.turn ?? 0);
  const myIndex = session.playerIds.indexOf(userId ?? '');
  const myTurn = canPlay && myIndex === turn % Math.max(1, session.playerIds.length);

  useEffect(() => {
    if (session.state.balls) return;
    void onPatch({ balls: initialBalls(), turn: 0 });
  }, [session.state.balls, onPatch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#1a5c3a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#0d3b24';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    for (const b of balls) {
      if (b.sunk) continue;
      ctx.beginPath();
      ctx.arc(b.x * w, b.y * h, b.id === 0 ? 10 : 9, 0, Math.PI * 2);
      ctx.fillStyle = b.id === 0 ? '#f8f8f2' : `hsl(${(b.id * 40) % 360} 70% 55%)`;
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [balls]);

  const shoot = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!myTurn || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const tx = (e.clientX - rect.left) / rect.width;
    const ty = (e.clientY - rect.top) / rect.height;
    const cue = balls.find((b) => b.id === 0 && !b.sunk);
    if (!cue) return;
    const dx = tx - cue.x;
    const dy = ty - cue.y;
    const len = Math.hypot(dx, dy) || 1;
    const power = Math.min(0.035, 0.012 + len * 0.02);
    const next = balls.map((b) =>
      b.id === 0
        ? { ...b, vx: (dx / len) * power, vy: (dy / len) * power }
        : { ...b },
    );
    // Basit fizik adımı
    for (let step = 0; step < 40; step++) {
      for (const b of next) {
        if (b.sunk) continue;
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= 0.985;
        b.vy *= 0.985;
        if (b.x < 0.04 || b.x > 0.96) b.vx *= -1;
        if (b.y < 0.06 || b.y > 0.94) b.vy *= -1;
        b.x = Math.min(0.96, Math.max(0.04, b.x));
        b.y = Math.min(0.94, Math.max(0.06, b.y));
        const pocket =
          (b.x < 0.06 || b.x > 0.94) && (b.y < 0.08 || b.y > 0.92);
        if (pocket && b.id !== 0) b.sunk = true;
      }
    }
    for (const b of next) {
      b.vx = 0;
      b.vy = 0;
    }
    void onPatch({ balls: next, turn: turn + 1 });
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0b1f14]">
      <p className="px-space-sm py-1 font-label-sm text-white/80 shrink-0">
        Bilardo · {myTurn ? 'Senin sıran — masaya tıkla' : 'Rakip oynuyor'}
        {!canPlay && ' · İzleyici'}
      </p>
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        onPointerDown={shoot}
        className="flex-1 w-full min-h-0 object-contain cursor-crosshair touch-none"
      />
    </div>
  );
}
