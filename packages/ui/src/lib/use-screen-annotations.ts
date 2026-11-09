'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ANNOTATION_LIMITS, sanitizeAnnotation, type ScreenAnnotationPayload } from '@dracord/types';

export type AnnotationStroke = {
  key: string;
  userId: string;
  userName: string | null;
  color: number;
  points: Array<[number, number]>;
  endedAt: number | null;
  updatedAt: number;
};

export type AnnotationClient = {
  sendScreenAnnotation(p: ScreenAnnotationPayload): void;
  onScreenAnnotation(h: (p: ScreenAnnotationPayload) => void): () => void;
};

export type ScreenAnnotationController = {
  /** Çizim modu açık mı */
  drawing: boolean;
  setDrawing: (v: boolean) => void;
  color: number;
  setColor: (c: number) => void;
  begin: (nx: number, ny: number) => void;
  move: (nx: number, ny: number) => void;
  end: () => void;
  clearMine: () => void;
  /** Canlı çizgiler (ref — her karede okunur) */
  strokesRef: React.MutableRefObject<Map<string, AnnotationStroke>>;
  /** Yeni veri geldi sayacı (çizimi uyandırmak için) */
  version: number;
};

const now = () => Date.now();

/**
 * A4 — ekran paylaşımı üzerine geçici çizim. Çizgiler bittikten sonra
 * holdMs bekler, fadeMs içinde kaybolur ("lazer" kalem).
 */
export function useScreenAnnotations(
  client: AnnotationClient | null | undefined,
  ctx: { guildId: string; channelId: string; sharerId: string } | null,
  meId: string | null | undefined,
): ScreenAnnotationController {
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState(0);
  const [version, setVersion] = useState(0);
  const strokesRef = useRef(new Map<string, AnnotationStroke>());
  const ctxKey = ctx ? `${ctx.guildId}:${ctx.channelId}:${ctx.sharerId}` : '';
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const cur = useRef<{ id: string; pending: Array<[number, number]>; last: [number, number] | null } | null>(null);
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const colorRef = useRef(color);
  colorRef.current = color;

  // Paylaşım değişti → temizle
  useEffect(() => {
    strokesRef.current.clear();
    setDrawing(false);
    setVersion((v) => v + 1);
  }, [ctxKey]);

  useEffect(() => {
    if (!client || !ctxKey) return;
    return client.onScreenAnnotation((raw) => {
      const c = ctxRef.current;
      const p = sanitizeAnnotation(raw);
      if (!c || !p || p.guildId !== c.guildId || p.channelId !== c.channelId || p.sharerId !== c.sharerId) return;
      const uid = String((raw as ScreenAnnotationPayload).userId ?? '');
      if (!uid) return;
      const map = strokesRef.current;
      if (p.clear) {
        for (const [k, s] of map) if (s.userId === uid) map.delete(k);
      } else {
        const key = `${uid}:${p.strokeId}`;
        const s =
          map.get(key) ??
          ({ key, userId: uid, userName: (raw as ScreenAnnotationPayload).userName ?? null, color: p.color, points: [], endedAt: null, updatedAt: now() } as AnnotationStroke);
        s.points.push(...p.points);
        if (s.points.length > 4000) s.points.splice(0, s.points.length - 4000);
        s.updatedAt = now();
        if (p.end) s.endedAt = now();
        map.set(key, s);
      }
      setVersion((v) => v + 1);
    });
  }, [client, ctxKey]);

  const send = useCallback(
    (extra: Partial<ScreenAnnotationPayload>) => {
      const c = ctxRef.current;
      const s = cur.current;
      if (!client || !c) return;
      client.sendScreenAnnotation({
        guildId: c.guildId,
        channelId: c.channelId,
        sharerId: c.sharerId,
        strokeId: s?.id ?? 'x',
        color: colorRef.current,
        points: [],
        ...extra,
      });
    },
    [client],
  );

  const flush = useCallback(
    (end = false) => {
      const s = cur.current;
      if (!s) return;
      while (s.pending.length > ANNOTATION_LIMITS.pointsPerMessage) {
        send({ strokeId: s.id, points: s.pending.splice(0, ANNOTATION_LIMITS.pointsPerMessage) });
      }
      if (s.pending.length || end) send({ strokeId: s.id, points: s.pending.splice(0), end });
    },
    [send],
  );

  const begin = useCallback(
    (nx: number, ny: number) => {
      if (!meId || !ctxRef.current) return;
      const id = `${now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      cur.current = { id, pending: [[nx, ny]], last: [nx, ny] };
      strokesRef.current.set(`${meId}:${id}`, {
        key: `${meId}:${id}`,
        userId: meId,
        userName: null,
        color: colorRef.current,
        points: [[nx, ny]],
        endedAt: null,
        updatedAt: now(),
      });
      setVersion((v) => v + 1);
      if (flushTimer.current) clearInterval(flushTimer.current);
      flushTimer.current = setInterval(() => flush(false), 50);
    },
    [meId, flush],
  );

  const move = useCallback((nx: number, ny: number) => {
    const s = cur.current;
    if (!s || !meId) return;
    const l = s.last;
    if (l && Math.abs(l[0] - nx) < 0.002 && Math.abs(l[1] - ny) < 0.002) return;
    s.last = [nx, ny];
    s.pending.push([nx, ny]);
    const local = strokesRef.current.get(`${meId}:${s.id}`);
    if (local) {
      local.points.push([nx, ny]);
      local.updatedAt = now();
    }
    setVersion((v) => v + 1);
  }, [meId]);

  const end = useCallback(() => {
    const s = cur.current;
    if (!s || !meId) return;
    flush(true);
    if (flushTimer.current) clearInterval(flushTimer.current);
    flushTimer.current = null;
    const local = strokesRef.current.get(`${meId}:${s.id}`);
    if (local) local.endedAt = now();
    cur.current = null;
    setVersion((v) => v + 1);
  }, [meId, flush]);

  const clearMine = useCallback(() => {
    if (!meId) return;
    for (const [k, s] of strokesRef.current) if (s.userId === meId) strokesRef.current.delete(k);
    send({ strokeId: 'clear', clear: true });
    setVersion((v) => v + 1);
  }, [meId, send]);

  useEffect(
    () => () => {
      if (flushTimer.current) clearInterval(flushTimer.current);
    },
    [],
  );

  return useMemo(
    () => ({ drawing, setDrawing, color, setColor, begin, move, end, clearMine, strokesRef, version }),
    [drawing, color, begin, move, end, clearMine, version],
  );
}

/** Çizgi görünürlüğü (0–1); 0 → silinebilir */
export function strokeAlpha(s: AnnotationStroke, t = now()): number {
  if (s.endedAt === null) return t - s.updatedAt > 15_000 ? 0 : 1;
  const age = t - s.endedAt;
  if (age <= ANNOTATION_LIMITS.holdMs) return 1;
  return Math.max(0, 1 - (age - ANNOTATION_LIMITS.holdMs) / ANNOTATION_LIMITS.fadeMs);
}
