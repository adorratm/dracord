'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GAME_EMBED, type GameLaunchDto, type GameSessionDto } from '@dracord/types';
import { cn } from '../lib/cn';
import type { GamesClient } from '../lib/use-game-sessions';

type Participant = { id: string; displayName: string; avatarUrl: string | null };

/**
 * Harici oyunu sandbox iframe'de çalıştırır, @dracord/embedded-sdk ile konuşur.
 * Güvenlik: yalnız oyunun origin'inden ve kendi iframe'inden gelen mesajlar işlenir;
 * token yalnız oyunun origin'ine gönderilir. Oyun kimliği sunucuda /v1/games/verify ile doğrular.
 */
export function GameFrame({
  client,
  session,
  platform,
  apiBase,
  resolveParticipant,
  onClose,
  onInvite,
  onSetStatus,
  className,
}: {
  client: GamesClient;
  session: GameSessionDto;
  platform: 'web' | 'desktop' | 'mobile';
  apiBase: string;
  resolveParticipant: (userId: string) => Participant;
  onClose: (opts?: { leave?: boolean }) => void;
  onInvite?: () => void;
  onSetStatus?: (text: string | null) => void;
  className?: string;
}) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const launchRef = useRef<GameLaunchDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  let origin = '';
  try {
    origin = new URL(session.game.entryUrl).origin;
  } catch {
    /* geçersiz */
  }

  const post = useCallback(
    (type: string, payload: unknown) => {
      const w = frame.current?.contentWindow;
      if (!w || !origin) return;
      w.postMessage({ source: GAME_EMBED.hostSource, type, payload }, origin);
    },
    [origin],
  );

  const participants = useCallback(
    (s: GameSessionDto) => s.participantIds.map((id) => resolveParticipant(id)),
    [resolveParticipant],
  );

  // Oturum değişince oyuna bildir
  useEffect(() => {
    if (!launchRef.current) return;
    post('SESSION_UPDATE', {
      session: { ...session, game: undefined },
      participants: participants(session),
    });
  }, [session, post, participants]);

  useEffect(() => {
    const onMsg = async (ev: MessageEvent) => {
      if (!frame.current || ev.source !== frame.current.contentWindow || ev.origin !== origin) return;
      const d = ev.data as { source?: string; type?: string; payload?: Record<string, unknown> };
      if (!d || d.source !== GAME_EMBED.embedSource) return;
      switch (d.type) {
        case 'READY': {
          try {
            const l = await client.launchGameSession(session.id);
            launchRef.current = l;
            setLoading(false);
            post('INIT', {
              protocol: GAME_EMBED.version,
              token: l.token,
              expiresAt: l.expiresAt,
              user: l.user,
              session: { ...l.session, game: undefined },
              participants: participants(l.session),
              platform,
              locale: typeof navigator !== 'undefined' ? navigator.language : 'tr-TR',
              theme: 'dark',
              testMode: l.session.game.status !== 'approved',
              apiBase,
            });
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Oyun başlatılamadı');
            post('ERROR', { code: 'launch_failed', message: 'Dracord oturumu açılamadı' });
          }
          break;
        }
        case 'REFRESH_TOKEN': {
          try {
            const l = await client.launchGameSession(session.id);
            launchRef.current = l;
            post('TOKEN', { token: l.token, expiresAt: l.expiresAt });
          } catch {
            post('ERROR', { code: 'refresh_failed', message: 'Token yenilenemedi' });
          }
          break;
        }
        case 'CLOSE':
          onClose();
          break;
        case 'INVITE':
          onInvite?.();
          break;
        case 'OPEN_EXTERNAL': {
          const url = String(d.payload?.url ?? '');
          if (/^https:\/\//i.test(url) && window.confirm(`Oyun harici bir bağlantı açmak istiyor:\n${url}\n\nAçılsın mı?`)) {
            window.open(url, '_blank', 'noopener,noreferrer');
          }
          break;
        }
        case 'TOAST': {
          const t = String(d.payload?.text ?? '').slice(0, 140);
          if (t) {
            setToast(t);
            window.setTimeout(() => setToast(null), 3500);
          }
          break;
        }
        case 'SET_STATUS':
          onSetStatus?.(d.payload?.text ? String(d.payload.text).slice(0, 100) : null);
          break;
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [client, session.id, origin, post, participants, platform, apiBase, onClose, onInvite, onSetStatus]);

  // Sekme görünürlüğü
  useEffect(() => {
    const onVis = () => post('VISIBILITY', { visible: document.visibilityState === 'visible' });
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [post]);

  if (!origin) {
    return <p className="p-4 font-body-sm text-error">Oyun adresi geçersiz.</p>;
  }

  return (
    <div className={cn('relative flex h-full w-full flex-col bg-black', className)}>
      <div className="flex h-10 shrink-0 items-center gap-2 bg-surface-container px-2">
        {session.game.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.game.iconUrl} alt="" className="h-6 w-6 rounded-md object-cover" />
        ) : (
          <span className="material-symbols-outlined text-[20px] text-primary-container">sports_esports</span>
        )}
        <span className="font-label-md text-on-surface truncate">{session.game.name}</span>
        {session.game.status !== 'approved' && (
          <span className="rounded bg-dracula-orange/20 px-1.5 font-label-sm text-dracula-orange">TEST</span>
        )}
        <span className="font-label-sm text-outline">{session.participantIds.length} oyuncu</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => frame.current?.requestFullscreen?.().catch(() => undefined)}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container-high hover:text-on-surface"
          aria-label="Tam ekran"
        >
          <span className="material-symbols-outlined text-[18px]">fullscreen</span>
        </button>
        <button
          type="button"
          onClick={() => onClose({ leave: false })}
          className="h-8 px-2 rounded-lg font-label-sm text-on-surface-variant hover:bg-surface-container-high"
          title="Oyunu gizle (oturumda kal)"
        >
          Küçült
        </button>
        <button
          type="button"
          onClick={() => onClose({ leave: true })}
          className="h-8 px-2 rounded-lg bg-error/90 font-label-sm text-on-error hover:bg-error"
        >
          Çık
        </button>
      </div>
      <iframe
        ref={frame}
        src={session.game.entryUrl}
        title={session.game.name}
        className="min-h-0 w-full flex-1 border-0 bg-black"
        // allow-same-origin: oyun KENDİ origin'inde depolama kullanabilsin (Dracord origin'inden ayrı)
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay; fullscreen; gamepad; clipboard-write"
        referrerPolicy="no-referrer"
      />
      {loading && !error && (
        <div className="pointer-events-none absolute inset-x-0 top-12 flex justify-center">
          <span className="rounded-lg bg-black/70 px-3 py-1.5 font-label-sm text-white">Oyun yükleniyor…</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-x-0 top-12 flex justify-center">
          <span className="rounded-lg bg-error-container px-3 py-1.5 font-label-sm text-on-error-container">{error}</span>
        </div>
      )}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <span className="rounded-lg bg-black/80 px-3 py-1.5 font-label-sm text-white">{toast}</span>
        </div>
      )}
    </div>
  );
}
