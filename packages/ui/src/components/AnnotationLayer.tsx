'use client';

import { useEffect, useRef } from 'react';
import { ANNOTATION_COLORS } from '@dracord/types';
import { cn } from '../lib/cn';
import { strokeAlpha, type ScreenAnnotationController } from '../lib/use-screen-annotations';

/** Görüntünün object-contain içerik dikdörtgeni (kapsayıcıya göre) */
function contentRect(video: HTMLVideoElement | null, box: DOMRect) {
  const vw = video?.videoWidth || 16;
  const vh = video?.videoHeight || 9;
  const scale = Math.min(box.width / vw, box.height / vh);
  const w = vw * scale;
  const h = vh * scale;
  return { x: (box.width - w) / 2, y: (box.height - h) / 2, w, h };
}

/**
 * A4 — paylaşımın üstünde çizim katmanı + küçük araç çubuğu.
 * Çizim modu kapalıyken tıklamalar alttaki videoya geçer.
 */
export function AnnotationLayer({
  ctl,
  videoRef,
  className,
}: {
  ctl: ScreenAnnotationController;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | null>(null);
  const drawingNow = useRef(false);

  // Çizim döngüsü: çizgi varken çalışır, bitince durur
  useEffect(() => {
    const draw = () => {
      raf.current = null;
      const el = canvas.current;
      const box = wrap.current?.getBoundingClientRect();
      if (!el || !box) return;
      const dpr = window.devicePixelRatio || 1;
      if (el.width !== Math.round(box.width * dpr) || el.height !== Math.round(box.height * dpr)) {
        el.width = Math.round(box.width * dpr);
        el.height = Math.round(box.height * dpr);
      }
      const g = el.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, box.width, box.height);
      const r = contentRect(videoRef.current, box);
      const t = Date.now();
      let alive = 0;
      for (const [k, s] of ctl.strokesRef.current) {
        const a = strokeAlpha(s, t);
        if (a <= 0) {
          ctl.strokesRef.current.delete(k);
          continue;
        }
        alive++;
        if (!s.points.length) continue;
        g.globalAlpha = a;
        g.strokeStyle = ANNOTATION_COLORS[s.color] ?? ANNOTATION_COLORS[0];
        g.lineWidth = Math.max(3, Math.min(6, r.w / 320));
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.shadowColor = 'rgba(0,0,0,0.6)';
        g.shadowBlur = 3;
        g.beginPath();
        s.points.forEach(([x, y], i) => {
          const px = r.x + x * r.w;
          const py = r.y + y * r.h;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        });
        if (s.points.length === 1) g.lineTo(r.x + s.points[0]![0] * r.w + 0.1, r.y + s.points[0]![1] * r.h);
        g.stroke();
        if (s.userName && s.endedAt === null) {
          const [lx, ly] = s.points[s.points.length - 1]!;
          g.shadowBlur = 0;
          g.globalAlpha = 0.9;
          g.font = '600 11px system-ui, sans-serif';
          g.fillStyle = 'rgba(0,0,0,0.6)';
          const tw = g.measureText(s.userName).width;
          g.fillRect(r.x + lx * r.w + 8, r.y + ly * r.h - 18, tw + 8, 16);
          g.fillStyle = '#fff';
          g.fillText(s.userName, r.x + lx * r.w + 12, r.y + ly * r.h - 6);
        }
      }
      g.globalAlpha = 1;
      if (alive > 0) raf.current = requestAnimationFrame(draw);
    };
    if (raf.current === null) raf.current = requestAnimationFrame(draw);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [ctl.version, ctl.strokesRef, videoRef]);

  const toNorm = (e: React.PointerEvent) => {
    const box = wrap.current!.getBoundingClientRect();
    const r = contentRect(videoRef.current, box);
    const nx = (e.clientX - box.left - r.x) / r.w;
    const ny = (e.clientY - box.top - r.y) / r.h;
    return { nx: Math.min(1, Math.max(0, nx)), ny: Math.min(1, Math.max(0, ny)) };
  };

  return (
    <div ref={wrap} className={cn('absolute inset-0 z-[3]', ctl.drawing ? 'cursor-crosshair' : 'pointer-events-none', className)}>
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          if (!ctl.drawing || e.button !== 0) return;
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drawingNow.current = true;
          const { nx, ny } = toNorm(e);
          ctl.begin(nx, ny);
        }}
        onPointerMove={(e) => {
          if (!drawingNow.current) return;
          const { nx, ny } = toNorm(e);
          ctl.move(nx, ny);
        }}
        onPointerUp={() => {
          if (!drawingNow.current) return;
          drawingNow.current = false;
          ctl.end();
        }}
        onPointerCancel={() => {
          if (!drawingNow.current) return;
          drawingNow.current = false;
          ctl.end();
        }}
      />
    </div>
  );
}

/** Paylaşım üstü küçük araç çubuğu: kalem aç/kapat, renk, temizle */
export function AnnotationToolbar({ ctl, className }: { ctl: ScreenAnnotationController; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1 rounded-full bg-black/65 p-1 backdrop-blur', className)}>
      <button
        type="button"
        onClick={() => ctl.setDrawing(!ctl.drawing)}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-white',
          ctl.drawing ? 'bg-primary-container text-on-primary-container' : 'hover:bg-white/15',
        )}
        aria-pressed={ctl.drawing}
        aria-label={ctl.drawing ? 'Çizimi kapat' : 'Paylaşıma çiz'}
        title={ctl.drawing ? 'Çizimi kapat' : 'Paylaşıma çiz (herkes görür, birkaç sn sonra silinir)'}
      >
        <span className="material-symbols-outlined text-[18px]">draw</span>
      </button>
      {ctl.drawing ? (
        <>
          {ANNOTATION_COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              onClick={() => ctl.setColor(i)}
              className={cn('h-5 w-5 rounded-full border-2', ctl.color === i ? 'border-white' : 'border-transparent')}
              style={{ backgroundColor: c }}
              aria-label={`Renk ${i + 1}`}
            />
          ))}
          <button
            type="button"
            onClick={ctl.clearMine}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-white/15"
            aria-label="Çizimlerimi sil"
            title="Çizimlerimi sil"
          >
            <span className="material-symbols-outlined text-[18px]">ink_eraser</span>
          </button>
        </>
      ) : null}
    </div>
  );
}
