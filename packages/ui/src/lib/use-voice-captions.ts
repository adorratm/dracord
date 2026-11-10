'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CAPTION_LIMITS, sanitizeCaption, type VoiceCaptionPayload } from '@dracord/types';
import { pickCaptionEngine, startCaptions, WHISPER_DOWNLOAD_MB, type CaptionEngine, type CaptionSession } from './captions-local';

export type CaptionLine = { key: string; userId: string; name: string; text: string; final: boolean; at: number };

export type CaptionsClient = {
  sendVoiceCaption(p: VoiceCaptionPayload): void;
  onVoiceCaption(h: (p: VoiceCaptionPayload) => void): () => void;
};

export type MyCaptionState =
  | { kind: 'off' }
  | { kind: 'consent'; engine: CaptionEngine; mb: number }
  | { kind: 'starting'; progress?: number }
  | { kind: 'on'; engine: CaptionEngine }
  | { kind: 'error'; message: string };

const SHOW_KEY = 'dracord:captions-show';

/**
 * A7 — ses kanalı canlı altyazı. Görüntüleme herkese açık seçenek; kendi konuşmanı
 * altyazılamak ayrı bir onaydır (cihazında tanınır, yalnız metin gönderilir).
 */
export function useVoiceCaptions(
  client: CaptionsClient | null | undefined,
  ctx: { guildId: string; channelId: string } | null,
  me: { id: string; name: string } | null,
  opts: { muted: boolean; lang?: string },
) {
  const [show, setShowState] = useState(() => {
    try {
      return localStorage.getItem(SHOW_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [mine, setMine] = useState<MyCaptionState>({ kind: 'off' });
  const session = useRef<CaptionSession | null>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const ctxKey = ctx ? `${ctx.guildId}:${ctx.channelId}` : '';
  const lang = (opts.lang || (typeof navigator !== 'undefined' ? navigator.language : 'tr') || 'tr').split('-')[0]!.toLowerCase();

  const setShow = useCallback((v: boolean) => {
    setShowState(v);
    try {
      localStorage.setItem(SHOW_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const upsert = useCallback((l: CaptionLine) => {
    setLines((prev) => {
      const t = Date.now();
      const next = prev.filter((x) => x.key !== l.key && t - x.at < CAPTION_LIMITS.holdMs);
      next.push(l);
      return next.slice(-6);
    });
  }, []);

  // Gelen altyazılar
  useEffect(() => {
    setLines([]);
    if (!client || !ctxKey) return;
    return client.onVoiceCaption((raw) => {
      const c = ctxRef.current;
      const p = sanitizeCaption(raw);
      if (!c || !p || p.guildId !== c.guildId || p.channelId !== c.channelId) return;
      const uid = String((raw as VoiceCaptionPayload).userId ?? '');
      if (!uid) return;
      upsert({ key: `${uid}:${p.id}`, userId: uid, name: (raw as VoiceCaptionPayload).userName || 'Üye', text: p.text, final: p.final, at: Date.now() });
    });
  }, [client, ctxKey, upsert]);

  // Süresi dolanları temizle
  useEffect(() => {
    if (!lines.length) return;
    const t = setTimeout(() => setLines((prev) => prev.filter((x) => Date.now() - x.at < CAPTION_LIMITS.holdMs)), 1000);
    return () => clearTimeout(t);
  }, [lines]);

  const stopMine = useCallback(() => {
    session.current?.stop();
    session.current = null;
    setMine({ kind: 'off' });
  }, []);

  const startMine = useCallback(
    async (consented = false) => {
      if (!client || !ctxRef.current || !me) return;
      const pick = await pickCaptionEngine(lang);
      if (!pick.engine) {
        setMine({ kind: 'error', message: 'Bu cihazda cihaz üstü konuşma tanıma yok' });
        return;
      }
      if (pick.needsDownload && !consented) {
        setMine({ kind: 'consent', engine: pick.engine, mb: pick.engine === 'whisper' ? WHISPER_DOWNLOAD_MB : 0 });
        return;
      }
      setMine({ kind: 'starting' });
      try {
        const s = await startCaptions(
          lang,
          ({ id, text, final }) => {
            const c = ctxRef.current;
            if (!c) return;
            client.sendVoiceCaption({ guildId: c.guildId, channelId: c.channelId, id, text, final, lang });
            upsert({ key: `${me.id}:${id}`, userId: me.id, name: me.name, text, final, at: Date.now() });
          },
          {
            prefer: pick.engine,
            onError: (m) => setMine({ kind: 'error', message: m }),
            onProgress: (p) => setMine((cur) => (cur.kind === 'starting' ? { kind: 'starting', progress: p } : cur)),
          },
        );
        session.current = s;
        setMine({ kind: 'on', engine: s.engine });
      } catch (e) {
        setMine({ kind: 'error', message: e instanceof Error ? e.message : 'Başlatılamadı' });
      }
    },
    [client, me, lang, upsert],
  );

  // Susturulunca tanımayı duraklat; kanaldan çıkınca kapat
  useEffect(() => {
    session.current?.setPaused(opts.muted);
  }, [opts.muted]);
  useEffect(() => {
    if (!ctxKey) stopMine();
  }, [ctxKey, stopMine]);
  useEffect(() => () => session.current?.stop(), []);

  return { show, setShow, lines, mine, startMine, stopMine, cancelConsent: () => setMine({ kind: 'off' }) };
}

export type VoiceCaptionsController = ReturnType<typeof useVoiceCaptions>;
