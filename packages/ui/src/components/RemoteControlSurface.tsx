import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export type RemoteControlPointerEvent = {
  type: 'move' | 'down' | 'up' | 'wheel';
  nx: number;
  ny: number;
  button?: number;
  deltaY?: number;
};

export type RemoteControlKeyEvent = {
  type: 'key';
  keyAction: 'down' | 'up';
  key: string;
  code: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
};

type Norm = { nx: number; ny: number };

/** Esc basılı tutma süresi (ms) — kontrolü bırakır */
const ESC_HOLD_MS = 800;
const LONG_PRESS_MS = 550;
const TOUCH_SLOP_PX = 8;

/**
 * Uzak kontrol yüzeyi (controller tarafı).
 * Çıkış yolları: üstteki "Bırak" butonu · Esc basılı tut · Ctrl+Alt+Esc · odak kaybı (tuşlar bırakılır).
 * Dokunmatik: dokunuş = sol tık, uzun bas = sağ tık, sürükle = basılı sürükleme, iki parmak = kaydırma.
 */
export function RemoteControlSurface({
  mapPointerToNorm,
  onPointer,
  onKey,
  onStop,
}: {
  mapPointerToNorm: (clientX: number, clientY: number) => Norm | null;
  onPointer?: (ev: RemoteControlPointerEvent) => void;
  onKey?: (ev: RemoteControlKeyEvent) => void;
  onStop?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastNorm = useRef<Norm>({ nx: 0.5, ny: 0.5 });
  const buttonsDown = useRef(new Set<number>());
  const keysDown = useRef(new Map<string, RemoteControlKeyEvent>());
  const escTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const escConsumed = useRef(false);
  const [escHolding, setEscHolding] = useState(false);
  const [focused, setFocused] = useState(false);
  // dokunmatik
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const touchPending = useRef<{
    id: number;
    x: number;
    y: number;
    norm: Norm;
    timer: ReturnType<typeof setTimeout> | null;
    dragging: boolean;
    longPressed: boolean;
  } | null>(null);
  const twoFingerY = useRef<number | null>(null);

  const norm = useCallback(
    (x: number, y: number, clamp = false): Norm | null => {
      const n = mapPointerToNorm(x, y);
      if (n) {
        lastNorm.current = n;
        return n;
      }
      return clamp ? lastNorm.current : null;
    },
    [mapPointerToNorm],
  );

  const releaseAll = useCallback(() => {
    for (const ev of keysDown.current.values()) onKey?.({ ...ev, keyAction: 'up' });
    keysDown.current.clear();
    for (const b of buttonsDown.current) onPointer?.({ type: 'up', ...lastNorm.current, button: b });
    buttonsDown.current.clear();
  }, [onKey, onPointer]);

  const stop = useCallback(() => {
    if (escTimer.current) clearTimeout(escTimer.current);
    escTimer.current = null;
    setEscHolding(false);
    releaseAll();
    onStop?.();
  }, [onStop, releaseAll]);

  // Açılınca odak al; kapanınca takılı tuş/tık bırakma
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      if (escTimer.current) clearTimeout(escTimer.current);
      if (touchPending.current?.timer) clearTimeout(touchPending.current.timer);
      releaseAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keyPayload = (e: ReactKeyboardEvent, action: 'down' | 'up'): RemoteControlKeyEvent => ({
    type: 'key',
    keyAction: action,
    key: e.key,
    code: e.code,
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey,
    meta: e.metaKey,
  });

  const onKeyDown = (e: ReactKeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      if (e.ctrlKey && e.altKey) {
        stop();
        return;
      }
      if (e.repeat || escTimer.current) return;
      escConsumed.current = false;
      setEscHolding(true);
      escTimer.current = setTimeout(() => {
        escTimer.current = null;
        escConsumed.current = true;
        stop();
      }, ESC_HOLD_MS);
      return;
    }
    const ev = keyPayload(e, 'down');
    keysDown.current.set(e.code || e.key, ev);
    onKey?.(ev);
  };

  const onKeyUp = (e: ReactKeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      setEscHolding(false);
      if (escTimer.current) {
        // Kısa basış: Esc karşıya normal tuş olarak gider
        clearTimeout(escTimer.current);
        escTimer.current = null;
        onKey?.(keyPayload(e, 'down'));
        onKey?.(keyPayload(e, 'up'));
      }
      escConsumed.current = false;
      return;
    }
    keysDown.current.delete(e.code || e.key);
    onKey?.(keyPayload(e, 'up'));
  };

  // ---- fare / kalem
  const mouseDown = (e: ReactPointerEvent) => {
    const n = norm(e.clientX, e.clientY);
    if (!n) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    buttonsDown.current.add(e.button);
    onPointer?.({ type: 'down', ...n, button: e.button });
  };
  const mouseUp = (e: ReactPointerEvent) => {
    const n = norm(e.clientX, e.clientY, true)!;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!buttonsDown.current.has(e.button)) return;
    buttonsDown.current.delete(e.button);
    onPointer?.({ type: 'up', ...n, button: e.button });
  };

  // ---- dokunmatik
  const touchDown = (e: ReactPointerEvent) => {
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.current.size === 2) {
      // iki parmak: bekleyen tıkı iptal et, kaydırma moduna geç
      const tp = touchPending.current;
      if (tp?.timer) clearTimeout(tp.timer);
      if (tp?.dragging) {
        buttonsDown.current.delete(0);
        onPointer?.({ type: 'up', ...lastNorm.current, button: 0 });
      }
      touchPending.current = null;
      const ys = [...touches.current.values()].map((t) => t.y);
      twoFingerY.current = (ys[0]! + ys[1]!) / 2;
      return;
    }
    if (touches.current.size > 2) return;
    const n = norm(e.clientX, e.clientY);
    if (!n) return;
    onPointer?.({ type: 'move', ...n });
    const timer = setTimeout(() => {
      const tp = touchPending.current;
      if (!tp || tp.dragging) return;
      tp.longPressed = true;
      onPointer?.({ type: 'down', ...tp.norm, button: 2 });
      onPointer?.({ type: 'up', ...tp.norm, button: 2 });
    }, LONG_PRESS_MS);
    touchPending.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      norm: n,
      timer,
      dragging: false,
      longPressed: false,
    };
  };
  const touchMove = (e: ReactPointerEvent) => {
    if (!touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.current.size === 2 && twoFingerY.current !== null) {
      const ys = [...touches.current.values()].map((t) => t.y);
      const mid = (ys[0]! + ys[1]!) / 2;
      const dy = twoFingerY.current - mid;
      if (Math.abs(dy) >= 12) {
        twoFingerY.current = mid;
        onPointer?.({ type: 'wheel', ...lastNorm.current, deltaY: dy * 4 });
      }
      return;
    }
    const tp = touchPending.current;
    if (!tp || tp.id !== e.pointerId || tp.longPressed) return;
    const n = norm(e.clientX, e.clientY);
    if (!n) return;
    if (!tp.dragging && Math.hypot(e.clientX - tp.x, e.clientY - tp.y) > TOUCH_SLOP_PX) {
      if (tp.timer) clearTimeout(tp.timer);
      tp.dragging = true;
      buttonsDown.current.add(0);
      onPointer?.({ type: 'down', ...tp.norm, button: 0 });
    }
    if (tp.dragging) onPointer?.({ type: 'move', ...n });
  };
  const touchUp = (e: ReactPointerEvent) => {
    touches.current.delete(e.pointerId);
    if (touches.current.size < 2) twoFingerY.current = null;
    const tp = touchPending.current;
    if (!tp || tp.id !== e.pointerId) return;
    if (tp.timer) clearTimeout(tp.timer);
    touchPending.current = null;
    if (tp.longPressed) return;
    const n = norm(e.clientX, e.clientY, true)!;
    if (tp.dragging) {
      buttonsDown.current.delete(0);
      onPointer?.({ type: 'up', ...n, button: 0 });
    } else {
      onPointer?.({ type: 'down', ...tp.norm, button: 0 });
      onPointer?.({ type: 'up', ...tp.norm, button: 0 });
    }
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-[3] outline-none"
      style={{ cursor: 'crosshair', touchAction: 'none' }}
      tabIndex={0}
      role="application"
      aria-label="Uzak kontrol yüzeyi. Bırakmak için Esc tuşunu basılı tutun."
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        releaseAll();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMove={(e) => {
        if (e.pointerType === 'touch') return touchMove(e);
        const n = norm(e.clientX, e.clientY);
        if (n) onPointer?.({ type: 'move', ...n });
      }}
      onPointerDown={(e) => {
        rootRef.current?.focus({ preventScroll: true });
        if (e.pointerType === 'touch') return touchDown(e);
        mouseDown(e);
      }}
      onPointerUp={(e) => (e.pointerType === 'touch' ? touchUp(e) : mouseUp(e))}
      onPointerCancel={(e) => (e.pointerType === 'touch' ? touchUp(e) : mouseUp(e))}
      onLostPointerCapture={(e) => {
        if (e.pointerType !== 'touch' && buttonsDown.current.has(e.button)) mouseUp(e);
      }}
      onWheel={(e) => {
        const n = norm(e.clientX, e.clientY);
        if (n) onPointer?.({ type: 'wheel', ...n, deltaY: e.deltaY });
      }}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
    >
      <div
        className="absolute left-1/2 top-2 -translate-x-1/2 z-[5] flex items-center gap-2 rounded-full bg-black/75 pl-3 pr-1 py-1 text-white shadow-lg max-w-[calc(100%-1rem)]"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        style={{ cursor: 'default' }}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-dracula-green animate-pulse" aria-hidden />
        <span className="font-label-sm truncate">
          {escHolding
            ? 'Bırakılıyor…'
            : focused
              ? 'Kontrol ediyorsun · Esc basılı tut = bırak'
              : 'Klavye için yüzeye tıkla'}
        </span>
        <button
          type="button"
          className="h-7 shrink-0 rounded-full bg-dracula-orange/90 px-3 font-label-sm text-black hover:bg-dracula-orange"
          onClick={(e) => {
            e.stopPropagation();
            stop();
          }}
        >
          Bırak
        </button>
      </div>
    </div>
  );
}
