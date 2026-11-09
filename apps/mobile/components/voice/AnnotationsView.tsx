import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import type { DracordClient } from '@dracord/sdk';
import { ANNOTATION_COLORS, ANNOTATION_LIMITS, sanitizeAnnotation, type ScreenAnnotationPayload } from '@dracord/types';

type Stroke = { color: number; points: Array<[number, number]>; endedAt: number | null; updatedAt: number };

const alpha = (s: Stroke, t: number) => {
  if (s.endedAt === null) return t - s.updatedAt > 15_000 ? 0 : 1;
  const age = t - s.endedAt;
  if (age <= ANNOTATION_LIMITS.holdMs) return 1;
  return Math.max(0, 1 - (age - ANNOTATION_LIMITS.holdMs) / ANNOTATION_LIMITS.fadeMs);
};

/** A4 — mobil: paylaşım üzerindeki çizimleri göster (salt görüntüleme) */
export function AnnotationsView({
  client,
  guildId,
  channelId,
  sharerId,
  box,
  videoW,
  videoH,
}: {
  client: DracordClient;
  guildId: string;
  channelId: string;
  sharerId: string;
  box: { w: number; h: number };
  videoW: number;
  videoH: number;
}) {
  const strokes = useRef(new Map<string, Stroke>());
  const [, setTick] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    strokes.current.clear();
    const ensureTimer = () => {
      if (timer.current) return;
      timer.current = setInterval(() => {
        const t = Date.now();
        for (const [k, s] of strokes.current) if (alpha(s, t) <= 0) strokes.current.delete(k);
        setTick((n) => n + 1);
        if (!strokes.current.size && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
      }, 80);
    };
    const off = client.onScreenAnnotation((raw) => {
      const p = sanitizeAnnotation(raw);
      if (!p || p.guildId !== guildId || p.channelId !== channelId || p.sharerId !== sharerId) return;
      const uid = String((raw as ScreenAnnotationPayload).userId ?? '');
      if (!uid) return;
      if (p.clear) {
        for (const k of [...strokes.current.keys()]) if (k.startsWith(`${uid}:`)) strokes.current.delete(k);
      } else {
        const key = `${uid}:${p.strokeId}`;
        const s = strokes.current.get(key) ?? { color: p.color, points: [], endedAt: null, updatedAt: Date.now() };
        s.points.push(...p.points);
        s.updatedAt = Date.now();
        if (p.end) s.endedAt = Date.now();
        strokes.current.set(key, s);
      }
      setTick((n) => n + 1);
      ensureTimer();
    });
    return () => {
      off();
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [client, guildId, channelId, sharerId]);

  if (!strokes.current.size) return null;
  const a = videoW / Math.max(1, videoH);
  const cw = Math.min(box.w, box.h * a);
  const ch = cw / a;
  const ox = (box.w - cw) / 2;
  const oy = (box.h - ch) / 2;
  const t = Date.now();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <Svg width={box.w} height={box.h}>
        {[...strokes.current.entries()].map(([k, s]) => (
          <Polyline
            key={k}
            points={s.points.map(([x, y]) => `${ox + x * cw},${oy + y * ch}`).join(' ')}
            fill="none"
            stroke={ANNOTATION_COLORS[s.color] ?? ANNOTATION_COLORS[0]}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={alpha(s, t)}
          />
        ))}
      </Svg>
    </View>
  );
}
