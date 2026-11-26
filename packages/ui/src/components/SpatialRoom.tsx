'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { SPATIAL_FAR, SPATIAL_NEAR } from '@dracord/types';
import { MAHALLE_ASPECT, type SpatialVoice } from '../lib/use-spatial-voice';
import { Avatar } from './Avatar';

export interface SpatialRoomPerson {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  speaking?: boolean;
  muted?: boolean;
}

export interface SpatialRoomProps {
  spatial: SpatialVoice;
  meId: string;
  people: SpatialRoomPerson[];
  onClose?: () => void;
}

/** harita 16:10 — konumlar 0..1; mesafe hesabı en-boy oranından bağımsız (kare birim) */
const ASPECT = MAHALLE_ASPECT;
const STEP = 0.025;

/** sabit mahalle yerleri (dekor + buluşma noktaları) */
const SPOTS = [
  { x: 0.5, y: 0.55, r: 0.11, label: 'Meydan', fill: '#bd93f922', stroke: '#bd93f955', icon: '⛲' },
  { x: 0.17, y: 0.25, r: 0.09, label: 'Çay bahçesi', fill: '#50fa7b1f', stroke: '#50fa7b50', icon: '🫖' },
  { x: 0.83, y: 0.25, r: 0.09, label: 'Kahvehane', fill: '#ffb86c1f', stroke: '#ffb86c50', icon: '🎲' },
  { x: 0.17, y: 0.82, r: 0.08, label: 'Park', fill: '#8be9fd1a', stroke: '#8be9fd50', icon: '🌳' },
  { x: 0.83, y: 0.82, r: 0.08, label: 'Sahil', fill: '#ff79c61a', stroke: '#ff79c650', icon: '🌊' },
] as const;

/** D3 — Mahalle haritası: tıkla/sürükle ya da ok tuşlarıyla yürü; yakındakini daha yüksek duyarsın */
export function SpatialRoom({ spatial, meId, people, onClose }: SpatialRoomProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  // harita her zaman tam 16:10 — kapsayıcıya sığacak en büyük boyut
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const w = Math.min(r.width, r.height * ASPECT);
      setSize({ w: Math.floor(w), h: Math.floor(w / ASPECT) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toPos = useCallback((e: PointerEvent) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }, []);

  const onKey = (e: KeyboardEvent) => {
    const d: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      w: [0, -1],
      s: [0, 1],
      a: [-1, 0],
      d: [1, 0],
    };
    const v = d[e.key];
    if (!v) return;
    e.preventDefault();
    spatial.moveTo({ x: spatial.me.x + v[0] * STEP, y: spatial.me.y + v[1] * STEP * ASPECT });
  };

  useEffect(() => {
    if (spatial.enabled) boxRef.current?.focus();
  }, [spatial.enabled]);

  const byId = new Map(people.map((p) => [p.id, p]));
  const me = byId.get(meId);
  const others = people.filter((p) => p.id !== meId);
  const outside = others.filter((p) => !spatial.positions.has(p.id));

  // kare birimde yarıçap → yüzde (yatayda en-boy oranı)
  const ringW = (r: number) => `${r * 2 * 100}%`;
  const ringH = (r: number) => `${r * 2 * 100 * ASPECT}%`;

  return (
    <div className="flex h-full w-full flex-col gap-2 bg-surface-container-lowest p-3">
      <div className="flex items-center gap-2">
        <span className="font-headline-sm text-on-surface">🏘️ Mahalle</span>
        <span className="font-label-sm text-on-surface-variant">Yakındakini yüksek, uzaktakini kısık duyarsın · ok tuşları / WASD ya da tıkla</span>
        <span className="ml-auto" />
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 font-label-sm text-on-surface hover:bg-surface-container-high">
            Sahneye dön
          </button>
        )}
      </div>
      <div ref={areaRef} className="relative flex min-h-0 flex-1 items-center justify-center">
        <div
          ref={boxRef}
          role="application"
          aria-label="Mahalle haritası. Ok tuşlarıyla hareket et."
          tabIndex={0}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            const p = toPos(e);
            if (!p) return;
            dragging.current = true;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            spatial.moveTo(p);
          }}
          onPointerMove={(e) => {
            if (!dragging.current) return;
            const p = toPos(e);
            if (p) spatial.moveTo(p);
          }}
          onPointerUp={() => (dragging.current = false)}
          className="relative shrink-0 cursor-crosshair touch-none select-none overflow-hidden rounded-2xl outline-none ring-primary focus-visible:ring-2"
          style={{
            width: size.w || undefined,
            height: size.h || undefined,
            visibility: size.w ? 'visible' : 'hidden',
            background:
              'radial-gradient(circle at 50% 55%, #2a2440 0%, #1b1d2b 55%, #15161f 100%), repeating-linear-gradient(0deg, transparent 0 39px, #ffffff07 39px 40px)',
          }}
        >
          {/* sokaklar */}
          <div className="pointer-events-none absolute left-0 right-0 top-[52%] h-[6%] bg-[#ffffff08]" />
          <div className="pointer-events-none absolute bottom-0 top-0 left-[48.5%] w-[3%] bg-[#ffffff08]" />
          {SPOTS.map((s) => (
            <div
              key={s.label}
              className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border"
              style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: ringW(s.r), height: ringH(s.r), background: s.fill, borderColor: s.stroke }}
            >
              <span className="text-2xl opacity-80">{s.icon}</span>
              <span className="font-label-sm text-on-surface-variant opacity-80">{s.label}</span>
            </div>
          ))}
          {/* duyma menzili */}
          {spatial.enabled && (
            <>
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-primary/30 motion-safe:transition-all motion-safe:duration-150"
                style={{ left: `${spatial.me.x * 100}%`, top: `${spatial.me.y * 100}%`, width: ringW(SPATIAL_FAR), height: ringH(SPATIAL_FAR) }}
              />
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 motion-safe:transition-all motion-safe:duration-150"
                style={{ left: `${spatial.me.x * 100}%`, top: `${spatial.me.y * 100}%`, width: ringW(SPATIAL_NEAR), height: ringH(SPATIAL_NEAR) }}
              />
            </>
          )}
          {others.map((p) => {
            const pos = spatial.positions.get(p.id);
            if (!pos) return null;
            const g = spatial.gains.get(p.id) ?? 1;
            return <Dot key={p.id} person={p} x={pos.x} y={pos.y} dim={g < 0.05} label={g < 0.05 ? 'duyulmuyor' : `%${Math.round(g * 100)}`} />;
          })}
          {me && <Dot person={me} x={spatial.me.x} y={spatial.me.y} self label="sen" />}
          {!spatial.enabled && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-[2px]">
              <p className="max-w-sm text-center font-body-md text-on-surface">
                Mahalle'de herkesin haritada bir yeri var. Yanına yürüdüğün kişileri duyarsın; uzaklaşınca ses kısılır. Mahalle'ye girmeyenler herkesi tam sesle duymaya devam eder.
              </p>
              <button type="button" onClick={() => spatial.setEnabled(true)} className="rounded-full bg-primary px-5 py-2 font-label-md text-on-primary">
                Mahalle'ye gir
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 font-label-sm text-on-surface-variant">
        {spatial.enabled && (
          <button type="button" onClick={() => spatial.setEnabled(false)} className="rounded-lg px-2 py-1 text-on-surface hover:bg-surface-container-high">
            Mahalle'den çık (herkesi tam duy)
          </button>
        )}
        {outside.length > 0 && (
          <span>
            Dışarıda (tam ses): {outside.map((p) => p.displayName).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}

function Dot({ person, x, y, self, dim, label }: { person: SpatialRoomPerson; x: number; y: number; self?: boolean; dim?: boolean; label: string }) {
  return (
    <div
      className={`pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center motion-safe:transition-[left,top] motion-safe:duration-150 ${dim ? 'opacity-40' : ''}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      <span className={`rounded-full p-0.5 ${person.speaking ? 'bg-[#50fa7b] shadow-[0_0_12px_#50fa7b]' : self ? 'bg-primary' : 'bg-surface-container-highest'}`}>
        <Avatar imageUrl={person.avatarUrl ?? null} displayName={person.displayName} size="md" />
      </span>
      <span className="mt-0.5 max-w-[7rem] truncate rounded bg-black/55 px-1.5 font-label-sm text-white">
        {person.muted ? '🔇 ' : ''}
        {person.displayName}
        <span className="ml-1 text-white/60">{label}</span>
      </span>
    </div>
  );
}

/** ses kontrol çubuğu düğmesi (Altyazı düğmesiyle aynı biçim) */
export function MahalleButton({ open, active, onToggle }: { open: boolean; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      title={active ? 'Mahalle açık — yakındakini yüksek duyuyorsun' : 'Mahalle: konumlu ses'}
      className={`flex h-9 items-center gap-1.5 rounded-full px-3 font-label-sm transition-colors ${
        open || active ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">holiday_village</span>
      Mahalle
    </button>
  );
}
