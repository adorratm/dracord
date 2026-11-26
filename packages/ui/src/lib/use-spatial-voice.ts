'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeSpatial, spatialGain, type VoiceSpatialPayload } from '@dracord/types';
import { setSpatialGains } from './game-audio';

export type SpatialClient = {
  sendVoiceSpatial(p: VoiceSpatialPayload): void;
  onVoiceSpatial(h: (p: VoiceSpatialPayload) => void): () => void;
};

type Pos = { x: number; y: number };
type Seen = Pos & { at: number };

/** harita en-boy oranı: y ekseni bu oranla küçültülür ki mesafe ekranda görünen daireyle aynı olsun */
export const MAHALLE_ASPECT = 16 / 10;
const KEY = 'dracord:mahalle';
const HEARTBEAT_MS = 4000;
const STALE_MS = 15_000;
const SEND_EVERY_MS = 120;

/** meydan çevresinde rastgele doğuş noktası */
function spawn(): Pos {
  const a = Math.random() * Math.PI * 2;
  const r = 0.06 + Math.random() * 0.08;
  return { x: 0.5 + Math.cos(a) * r, y: 0.55 + Math.sin(a) * r * 0.8 };
}

export type SpatialVoice = {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  me: Pos;
  /** kendini taşı (0..1) */
  moveTo: (p: Pos) => void;
  /** diğerlerinin konumu (yalnız Mahalle'yi açmış olanlar) */
  positions: Map<string, Pos>;
  /** dinleyici olarak kişi başı kazanç */
  gains: Map<string, number>;
};

/**
 * D3 — Mahalle: ses kanalında 2B harita, yakındakini daha yüksek duyarsın.
 * Konumlar yalnız aynı kanaldakilere aktarılır, sunucuda saklanmaz.
 * Mahalle'yi açmamış kişiler herkesçe tam sesle duyulur.
 */
export function useSpatialVoice(
  client: SpatialClient | null | undefined,
  ctx: { guildId: string; channelId: string } | null,
  meId: string | null | undefined,
  participantIds: string[],
): SpatialVoice {
  const [enabled, setEnabledState] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  const [me, setMe] = useState<Pos>(spawn);
  const meRef = useRef(me);
  meRef.current = me;
  const [seen, setSeen] = useState<Map<string, Seen>>(new Map());
  const lastSent = useRef(0);
  const pending = useRef<number | null>(null);
  const ctxKey = ctx ? `${ctx.guildId}:${ctx.channelId}` : null;

  const send = useCallback(
    (p: Pos | null) => {
      if (!client || !ctx) return;
      client.sendVoiceSpatial({ guildId: ctx.guildId, channelId: ctx.channelId, x: p?.x ?? null, y: p?.y ?? null });
      lastSent.current = Date.now();
    },
    // ctxKey: ctx nesnesi her render yeni olabilir
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, ctxKey],
  );

  const setEnabled = useCallback(
    (on: boolean) => {
      setEnabledState(on);
      try {
        localStorage.setItem(KEY, on ? '1' : '0');
      } catch {
        /* depolama yok */
      }
      if (!on) send(null);
    },
    [send],
  );

  // gelen konumlar
  useEffect(() => {
    if (!client || !ctxKey) return;
    setSeen(new Map());
    return client.onVoiceSpatial((raw) => {
      const p = sanitizeSpatial(raw);
      const uid = (raw as VoiceSpatialPayload)?.userId;
      if (!p || !uid || uid === meId || `${p.guildId}:${p.channelId}` !== ctxKey) return;
      setSeen((prev) => {
        const next = new Map(prev);
        if (p.x === null || p.y === null) next.delete(uid);
        else next.set(uid, { x: p.x, y: p.y, at: Date.now() });
        return next;
      });
    });
  }, [client, ctxKey, meId]);

  // açılışta + nabız: geç katılanlar da konumumu görsün; bayatları temizle
  useEffect(() => {
    if (!enabled || !ctxKey) return;
    send(meRef.current);
    const id = setInterval(() => {
      send(meRef.current);
      const now = Date.now();
      setSeen((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [k, v] of prev) if (now - v.at > STALE_MS) (next.delete(k), (changed = true));
        return changed ? next : prev;
      });
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [enabled, ctxKey, send]);

  // kanaldan çıkınca / bileşen kalkınca
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );

  const moveTo = useCallback(
    (p: Pos) => {
      const c = { x: Math.min(0.98, Math.max(0.02, p.x)), y: Math.min(0.97, Math.max(0.03, p.y)) };
      setMe(c);
      meRef.current = c;
      if (!enabled) return;
      const wait = SEND_EVERY_MS - (Date.now() - lastSent.current);
      if (wait <= 0) send(c);
      else if (!pending.current) {
        pending.current = window.setTimeout(() => {
          pending.current = null;
          send(meRef.current);
        }, wait);
      }
    },
    [enabled, send],
  );

  const ids = participantIds.join(',');
  const positions = useMemo(() => {
    const present = new Set(ids.split(','));
    const m = new Map<string, Pos>();
    for (const [k, v] of seen) if (present.has(k)) m.set(k, { x: v.x, y: v.y });
    return m;
  }, [seen, ids]);

  const gains = useMemo(() => {
    const m = new Map<string, number>();
    for (const [k, p] of positions) m.set(k, spatialGain({ x: me.x, y: me.y / MAHALLE_ASPECT }, { x: p.x, y: p.y / MAHALLE_ASPECT }));
    return m;
  }, [positions, me]);

  // ses motoruna ilet
  useEffect(() => {
    setSpatialGains(enabled && ctxKey ? gains : null);
  }, [enabled, ctxKey, gains]);
  useEffect(() => () => setSpatialGains(null), []);

  return { enabled, setEnabled, me, moveTo, positions, gains };
}
