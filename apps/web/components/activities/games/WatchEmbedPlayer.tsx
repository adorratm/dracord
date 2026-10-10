'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import type { WatchMediaRef } from '@/lib/watch-party-media';

type YTPlayer = {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  mute: () => void;
  unMute: () => void;
  setVolume: (n: number) => void;
  setSize?: (width: number, height: number) => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          videoId: string;
          width?: number | string;
          height?: number | string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number; target: YTPlayer }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState?: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;

function loadYtApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector('script[data-dracord-yt]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.dataset.dracordYt = '1';
      document.head.appendChild(s);
    }
    // Zaten yüklenmiş olabilir
    const t = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(t);
        resolve();
      }
    }, 100);
  });
  return ytApiPromise;
}

export type EmbedPlayerHandle = {
  getCurrentTime: () => number;
  getDuration: () => number;
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  setMuted: (m: boolean) => void;
  setVolume: (v: number) => void;
};

type Props = {
  media: WatchMediaRef;
  playing: boolean;
  at: number;
  isHost: boolean;
  muted: boolean;
  volume: number;
  className?: string;
  onReady?: () => void;
  onTime?: (t: number, duration: number) => void;
  onEnded?: () => void;
  playerRef?: MutableRefObject<EmbedPlayerHandle | null>;
};

/**
 * Platform embed oynatıcı — YouTube/Vimeo/Dailymotion senkronlu;
 * Instagram/TikTok/Facebook/X görüntüleme odaklı.
 */
export function WatchEmbedPlayer({
  media,
  playing,
  at,
  isHost,
  muted,
  volume,
  className,
  onReady,
  onTime,
  onEnded,
  playerRef,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const ytRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const lastSeekRef = useRef(-1);
  const playingRef = useRef(playing);
  const atRef = useRef(at);
  playingRef.current = playing;
  atRef.current = at;

  const postVimeo = (method: string, value?: unknown) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const msg =
      value === undefined
        ? { method }
        : { method, value };
    win.postMessage(JSON.stringify(msg), 'https://player.vimeo.com');
  };

  const postDm = (command: string, params?: Record<string, unknown>) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      JSON.stringify({ command, parameters: params ?? [] }),
      'https://www.dailymotion.com',
    );
  };

  // Handle API
  useEffect(() => {
    if (!playerRef) return;
    playerRef.current = {
      getCurrentTime: () => {
        try {
          if (ytRef.current) return ytRef.current.getCurrentTime() || 0;
        } catch {
          /* ignore */
        }
        return atRef.current;
      },
      getDuration: () => {
        try {
          if (ytRef.current) return ytRef.current.getDuration() || 0;
        } catch {
          /* ignore */
        }
        return 0;
      },
      play: () => {
        ytRef.current?.playVideo();
        if (media.provider === 'vimeo') postVimeo('play');
        if (media.provider === 'dailymotion') postDm('play');
      },
      pause: () => {
        ytRef.current?.pauseVideo();
        if (media.provider === 'vimeo') postVimeo('pause');
        if (media.provider === 'dailymotion') postDm('pause');
      },
      seek: (t: number) => {
        ytRef.current?.seekTo(t, true);
        if (media.provider === 'vimeo') postVimeo('setCurrentTime', t);
        if (media.provider === 'dailymotion') postDm('seek', { to: t });
      },
      setMuted: (m: boolean) => {
        if (ytRef.current) {
          if (m) ytRef.current.mute();
          else ytRef.current.unMute();
        }
        if (media.provider === 'vimeo') postVimeo(m ? 'setVolume' : 'setVolume', m ? 0 : volume);
        if (media.provider === 'dailymotion') postDm('muted', { muted: m });
      },
      setVolume: (v: number) => {
        ytRef.current?.setVolume(Math.round(v * 100));
        if (media.provider === 'vimeo') postVimeo('setVolume', v);
        if (media.provider === 'dailymotion') postDm('volume', { volume: v });
      },
    };
    return () => {
      playerRef.current = null;
    };
  }, [media.provider, playerRef, volume]);

  const fitFill = (root: HTMLElement) => {
    root.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;overflow:hidden;';
    root.querySelectorAll('iframe, object, embed').forEach((node) => {
      const el = node as HTMLElement;
      el.removeAttribute('width');
      el.removeAttribute('height');
      el.style.cssText =
        'position:absolute;inset:0;width:100%!important;height:100%!important;border:0;max-width:none;max-height:none;';
    });
    root.querySelectorAll(':scope > div').forEach((node) => {
      const el = node as HTMLElement;
      el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    });
  };

  // YouTube — %100 doldur + resize
  useEffect(() => {
    if (media.provider !== 'youtube' || !media.id || !hostRef.current) return;
    let cancelled = false;
    const mount = hostRef.current;
    mount.innerHTML = '';
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    mount.appendChild(el);
    fitFill(mount);

    const syncSize = () => {
      const w = Math.max(1, Math.round(mount.clientWidth));
      const h = Math.max(1, Math.round(mount.clientHeight));
      const p = ytRef.current as YTPlayer & { setSize?: (a: number, b: number) => void };
      try {
        p?.setSize?.(w, h);
      } catch {
        /* ignore */
      }
      fitFill(mount);
    };

    void loadYtApi().then(() => {
      if (cancelled || !window.YT?.Player) return;
      const w = Math.max(1, Math.round(mount.clientWidth)) || 640;
      const h = Math.max(1, Math.round(mount.clientHeight)) || 360;
      const player = new window.YT.Player(el, {
        width: w,
        height: h,
        videoId: media.id!,
        playerVars: {
          enablejsapi: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
          start: Math.max(0, Math.floor(atRef.current)),
        },
        events: {
          onReady: (e) => {
            ytRef.current = e.target;
            readyRef.current = true;
            syncSize();
            e.target.setVolume(Math.round(volume * 100));
            if (muted) e.target.mute();
            else e.target.unMute();
            if (playingRef.current) e.target.playVideo();
            else e.target.pauseVideo();
            onReady?.();
          },
          onStateChange: (e) => {
            const ended = window.YT?.PlayerState?.ENDED ?? 0;
            if (e.data === ended) onEnded?.();
          },
        },
      });
      ytRef.current = player;
      // iframe DOM’a yazıldıktan sonra stilleri zorla
      window.setTimeout(syncSize, 0);
      window.setTimeout(syncSize, 200);
    });

    const tick = window.setInterval(() => {
      const p = ytRef.current;
      if (!p || !readyRef.current) return;
      try {
        onTime?.(p.getCurrentTime(), p.getDuration());
      } catch {
        /* ignore */
      }
    }, 500);

    const ro = new ResizeObserver(() => syncSize());
    ro.observe(mount);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      ro.disconnect();
      try {
        ytRef.current?.destroy();
      } catch {
        /* ignore */
      }
      ytRef.current = null;
      readyRef.current = false;
      mount.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.provider, media.id]);

  // Vimeo / Dailymotion / sosyal iframe
  useEffect(() => {
    if (media.provider === 'youtube' || media.isDirectFile) return;
    if (!hostRef.current || !media.embedUrl) return;
    const mount = hostRef.current;
    mount.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;';
    let src = media.embedUrl;
    if (media.provider === 'vimeo' || media.provider === 'dailymotion') {
      const start = Math.max(0, Math.floor(atRef.current));
      const sep = src.includes('?') ? '&' : '?';
      if (media.provider === 'vimeo' && start > 0) src = `${src}${sep}#t=${start}s`;
      if (media.provider === 'dailymotion' && start > 0) {
        src = `${src}${sep}start=${start}`;
      }
      if (playingRef.current) {
        src += `${src.includes('?') ? '&' : '?'}autoplay=1`;
      }
    }
    iframe.src = src;
    iframeRef.current = iframe;
    mount.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;overflow:hidden;';
    mount.appendChild(iframe);
    fitFill(mount);
    readyRef.current = true;
    onReady?.();

    const onMsg = (ev: MessageEvent) => {
      if (media.provider === 'vimeo' && ev.origin === 'https://player.vimeo.com') {
        try {
          const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
          if (data?.event === 'finish') onEnded?.();
          if (data?.event === 'playProgress' && typeof data.data?.seconds === 'number') {
            onTime?.(data.data.seconds, data.data.duration ?? 0);
          }
        } catch {
          /* ignore */
        }
      }
      if (media.provider === 'dailymotion' && String(ev.origin).includes('dailymotion.com')) {
        try {
          const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
          if (data?.event === 'end') onEnded?.();
          if (data?.event === 'timeupdate' && typeof data?.time === 'number') {
            onTime?.(data.time, data.duration ?? 0);
          }
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener('message', onMsg);

    // Vimeo event subscription
    if (media.provider === 'vimeo') {
      const t = window.setTimeout(() => {
        postVimeo('addEventListener', 'playProgress');
        postVimeo('addEventListener', 'finish');
        if (playingRef.current) postVimeo('play');
        else postVimeo('pause');
      }, 800);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener('message', onMsg);
        iframeRef.current = null;
        mount.innerHTML = '';
        readyRef.current = false;
      };
    }

    return () => {
      window.removeEventListener('message', onMsg);
      iframeRef.current = null;
      mount.innerHTML = '';
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.provider, media.embedUrl, media.id]);

  // Senkron: play / pause / seek
  useEffect(() => {
    if (!readyRef.current) return;
    if (media.provider === 'youtube' && ytRef.current) {
      try {
        if (Math.abs(ytRef.current.getCurrentTime() - at) > (isHost ? 1.2 : 2.5)) {
          if (Math.abs(lastSeekRef.current - at) > 0.4) {
            ytRef.current.seekTo(at, true);
            lastSeekRef.current = at;
          }
        }
        if (playing) ytRef.current.playVideo();
        else ytRef.current.pauseVideo();
      } catch {
        /* ignore */
      }
      return;
    }
    if (media.provider === 'vimeo') {
      if (Math.abs(lastSeekRef.current - at) > 1.5) {
        postVimeo('setCurrentTime', at);
        lastSeekRef.current = at;
      }
      if (playing) postVimeo('play');
      else postVimeo('pause');
      return;
    }
    if (media.provider === 'dailymotion') {
      if (Math.abs(lastSeekRef.current - at) > 1.5) {
        postDm('seek', { to: at });
        lastSeekRef.current = at;
      }
      if (playing) postDm('play');
      else postDm('pause');
    }
  }, [playing, at, media.provider, isHost]);

  useEffect(() => {
    if (media.provider === 'youtube' && ytRef.current) {
      try {
        if (muted) ytRef.current.mute();
        else ytRef.current.unMute();
        ytRef.current.setVolume(Math.round(volume * 100));
      } catch {
        /* ignore */
      }
    }
    if (media.provider === 'vimeo') {
      postVimeo('setVolume', muted ? 0 : volume);
    }
    if (media.provider === 'dailymotion') {
      postDm('muted', { muted });
      postDm('volume', { volume });
    }
  }, [muted, volume, media.provider]);

  return (
    <div
      ref={hostRef}
      className={
        className ??
        'absolute inset-0 h-full w-full overflow-hidden bg-black [&_iframe]:!absolute [&_iframe]:!inset-0 [&_iframe]:!h-full [&_iframe]:!w-full'
      }
    />
  );
}
