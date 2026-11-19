'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WhiteboardEvent, WhiteboardStroke, WhiteboardTool } from '@dracord/types';
import { cn } from '../lib/cn';

export interface WhiteboardClient {
  connectSocket(): unknown;
  joinChannel(channelId: string): void;
  getWhiteboard(channelId: string): Promise<WhiteboardStroke[]>;
  addWhiteboardStroke(channelId: string, s: Pick<WhiteboardStroke, 'tool' | 'color' | 'width' | 'points'>): Promise<WhiteboardStroke>;
  removeWhiteboardStrokes(channelId: string, ids: string[]): Promise<unknown>;
  clearWhiteboard(channelId: string): Promise<unknown>;
  onWhiteboardEvent(handler: (e: WhiteboardEvent) => void): () => void;
}

/** the board is always 16:9; points are 0..1 inside it, so every screen sees the same drawing */
const ASPECT = 16 / 9;
const BG = '#1e1f29';
const COLORS = ['#f8f8f2', '#ff5555', '#ffb86c', '#f1fa8c', '#50fa7b', '#8be9fd', '#bd93f9', '#ff79c6'];
const SIZES = [
  { id: 's', label: 'İnce', w: 2 },
  { id: 'm', label: 'Orta', w: 5 },
  { id: 'l', label: 'Kalın', w: 10 },
];
const ERASER_RADIUS = 0.012;

type Local = WhiteboardStroke & { pending?: boolean };

function drawStroke(g: CanvasRenderingContext2D, s: Pick<WhiteboardStroke, 'tool' | 'color' | 'width' | 'points'>, W: number, H: number) {
  const p = s.points;
  if (p.length < 2) return;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = s.color;
  g.globalAlpha = s.tool === 'marker' ? 0.35 : 1;
  g.lineWidth = Math.max(1, (s.width * (s.tool === 'marker' ? 3 : 1) * W) / 1000);
  g.beginPath();
  g.moveTo(p[0]! * W, p[1]! * H);
  if (p.length === 2) g.lineTo(p[0]! * W + 0.01, p[1]! * H + 0.01);
  // midpoint smoothing
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = ((p[i]! + p[i + 2]!) / 2) * W;
    const my = ((p[i + 1]! + p[i + 3]!) / 2) * H;
    g.quadraticCurveTo(p[i]! * W, p[i + 1]! * H, mx, my);
  }
  if (p.length > 2) g.lineTo(p[p.length - 2]! * W, p[p.length - 1]! * H);
  g.stroke();
  g.restore();
}

/** distance from point to segment, in board units (x scaled by aspect so circles stay round) */
function hits(s: WhiteboardStroke, x: number, y: number, r: number): boolean {
  const p = s.points;
  const rr = r + (s.width / 1000) * (s.tool === 'marker' ? 1.5 : 0.5);
  for (let i = 0; i < p.length; i += 2) {
    const ax = p[i]! * ASPECT;
    const ay = p[i + 1]!;
    const bx = (p[i + 2] ?? p[i]!) * ASPECT;
    const by = p[i + 3] ?? p[i + 1]!;
    const px = x * ASPECT;
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (y - ay) * dy) / len)) : 0;
    const cx = ax + t * dx - px;
    const cy = ay + t * dy - y;
    if (cx * cx + cy * cy <= rr * rr) return true;
  }
  return false;
}

/** G3 — shared whiteboard of a channel: pen, marker, eraser, undo, clear, save as PNG */
export function Whiteboard({
  client,
  channelId,
  meId,
  canClear,
  className,
}: {
  client: WhiteboardClient;
  channelId: string;
  meId: string;
  /** owner / Manage Messages (always true in a DM) */
  canClear: boolean;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Local[]>([]);
  const strokesRef = useRef<Local[]>([]);
  strokesRef.current = strokes;
  const [tool, setTool] = useState<WhiteboardTool>('pen');
  const [color, setColor] = useState(COLORS[0]!);
  const [size, setSize] = useState(SIZES[1]!.w);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [error, setError] = useState<string | null>(null);
  const drawing = useRef<{ points: number[]; erased: Set<string> } | null>(null);
  const raf = useRef<number | null>(null);

  // size the 16:9 board inside the container
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      const w = Math.min(width, height * ASPECT);
      setBox({ w: Math.floor(w), h: Math.floor(w / ASPECT) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const redraw = useCallback(() => {
    raf.current = null;
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const W = box.w;
    const H = box.h;
    if (c.width !== Math.round(W * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = BG;
    g.fillRect(0, 0, W, H);
    const hidden = drawing.current?.erased;
    for (const s of strokesRef.current) if (!hidden?.has(s.id)) drawStroke(g, s, W, H);
    const d = drawing.current;
    if (d && tool !== 'eraser' && d.points.length) drawStroke(g, { tool, color, width: size, points: d.points }, W, H);
  }, [box, tool, color, size]);

  const schedule = useCallback(() => {
    if (raf.current == null) raf.current = requestAnimationFrame(redraw);
  }, [redraw]);

  useEffect(() => schedule(), [strokes, box, schedule]);

  // load + live updates
  useEffect(() => {
    let alive = true;
    client.connectSocket();
    client.joinChannel(channelId);
    setStrokes([]);
    client
      .getWhiteboard(channelId)
      .then((l) => alive && setStrokes(l))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Tahta yüklenemedi'));
    const off = client.onWhiteboardEvent((e) => {
      if (e.channelId !== channelId) return;
      if (e.kind === 'clear') setStrokes([]);
      else if (e.kind === 'remove') setStrokes((p) => p.filter((s) => !e.strokeIds.includes(s.id)));
      else setStrokes((p) => (p.some((s) => s.id === e.stroke.id) ? p : [...p, e.stroke]));
    });
    return () => {
      alive = false;
      off();
    };
  }, [client, channelId]);

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  const eraseAt = (x: number, y: number) => {
    const d = drawing.current;
    if (!d) return;
    for (const s of strokesRef.current) if (!d.erased.has(s.id) && !s.pending && hits(s, x, y, ERASER_RADIUS)) d.erased.add(s.id);
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const [x, y] = pos(e);
    drawing.current = { points: [x, y], erased: new Set() };
    if (tool === 'eraser') eraseAt(x, y);
    schedule();
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drawing.current;
    if (!d) return;
    const [x, y] = pos(e);
    const lx = d.points[d.points.length - 2]!;
    const ly = d.points[d.points.length - 1]!;
    if (Math.abs(x - lx) + Math.abs(y - ly) < 0.002) return;
    if (tool === 'eraser') {
      // sweep the whole path, not just the sampled points (fast drags skip far)
      const steps = Math.max(1, Math.ceil(Math.hypot((x - lx) * ASPECT, y - ly) / (ERASER_RADIUS * 0.8)));
      for (let i = 1; i <= steps; i++) eraseAt(lx + ((x - lx) * i) / steps, ly + ((y - ly) * i) / steps);
      d.points.push(x, y);
    } else if (d.points.length < 3990) d.points.push(x, y);
    schedule();
  };

  const onUp = () => {
    const d = drawing.current;
    drawing.current = null;
    if (!d) return;
    if (tool === 'eraser') {
      const ids = [...d.erased];
      if (!ids.length) return schedule();
      setStrokes((p) => p.filter((s) => !d.erased.has(s.id)));
      void client.removeWhiteboardStrokes(channelId, ids).catch(() => setError('Silinemedi'));
      return;
    }
    const tmp: Local = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: meId,
      tool,
      color,
      width: size,
      points: d.points,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setStrokes((p) => [...p, tmp]);
    client
      .addWhiteboardStroke(channelId, { tool, color, width: size, points: d.points })
      .then((saved) => setStrokes((p) => {
        const without = p.filter((s) => s.id !== tmp.id);
        return without.some((s) => s.id === saved.id) ? without : [...without, saved];
      }))
      .catch((err) => {
        setStrokes((p) => p.filter((s) => s.id !== tmp.id));
        setError(err instanceof Error ? err.message : 'Çizgi kaydedilemedi');
      });
  };

  const undo = () => {
    const mine = [...strokesRef.current].reverse().find((s) => s.userId === meId && !s.pending);
    if (!mine) return;
    setStrokes((p) => p.filter((s) => s.id !== mine.id));
    void client.removeWhiteboardStrokes(channelId, [mine.id]).catch(() => undefined);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const save = () => {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `dracord-tahta-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  const toolBtn = (id: WhiteboardTool, icon: string, label: string) => (
    <button
      type="button"
      aria-pressed={tool === id}
      aria-label={label}
      title={label}
      onClick={() => setTool(id)}
      className={cn('h-9 w-9 rounded-lg grid place-items-center', tool === id ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-high')}
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
    </button>
  );

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-surface-container p-1.5" role="toolbar" aria-label="Tahta araçları">
        {toolBtn('pen', 'edit', 'Kalem')}
        {toolBtn('marker', 'ink_highlighter', 'Fosforlu kalem')}
        {toolBtn('eraser', 'ink_eraser', 'Silgi')}
        <span className="mx-1 h-6 w-px bg-outline-variant" aria-hidden />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Renk ${c}`}
            aria-pressed={color === c}
            onClick={() => {
              setColor(c);
              if (tool === 'eraser') setTool('pen');
            }}
            className={cn('h-6 w-6 rounded-full ring-offset-2 ring-offset-surface-container', color === c ? 'ring-2 ring-primary' : '')}
            style={{ background: c }}
          />
        ))}
        <span className="mx-1 h-6 w-px bg-outline-variant" aria-hidden />
        {SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-label={s.label}
            title={s.label}
            aria-pressed={size === s.w}
            onClick={() => setSize(s.w)}
            className={cn('h-9 w-9 rounded-lg grid place-items-center', size === s.w ? 'bg-surface-container-highest' : 'hover:bg-surface-container-high')}
          >
            <span className="rounded-full bg-on-surface" style={{ width: s.w + 2, height: s.w + 2 }} />
          </button>
        ))}
        <span className="flex-1" />
        <button type="button" onClick={undo} aria-label="Geri al (Ctrl+Z)" title="Geri al (Ctrl+Z)" className="h-9 w-9 rounded-lg grid place-items-center text-on-surface-variant hover:bg-surface-container-high">
          <span className="material-symbols-outlined text-[20px]">undo</span>
        </button>
        <button type="button" onClick={save} aria-label="PNG olarak indir" title="PNG olarak indir" className="h-9 w-9 rounded-lg grid place-items-center text-on-surface-variant hover:bg-surface-container-high">
          <span className="material-symbols-outlined text-[20px]">download</span>
        </button>
        {canClear ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Tahtadaki her şey herkes için silinsin mi?')) void client.clearWhiteboard(channelId).catch((e) => setError(e instanceof Error ? e.message : 'Temizlenemedi'));
            }}
            aria-label="Tahtayı temizle"
            title="Tahtayı temizle"
            className="h-9 w-9 rounded-lg grid place-items-center text-error hover:bg-error/10"
          >
            <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
          </button>
        ) : null}
      </div>
      <div ref={wrapRef} className="relative flex-1 min-h-[12rem] grid place-items-center">
        <canvas
          ref={canvasRef}
          style={{ width: box.w, height: box.h, touchAction: 'none', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
          className="rounded-xl shadow-float"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="Ortak beyaz tahta"
          role="img"
        />
      </div>
      {error ? (
        <p className="font-body-sm text-error" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
