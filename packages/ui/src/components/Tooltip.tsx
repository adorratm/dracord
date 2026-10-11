'use client';

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  side?: TooltipSide;
  delayMs?: number;
  disabled?: boolean;
  className?: string;
}

type Pos = { x: number; y: number; side: TooltipSide };

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as { current: T | null }).current = node;
    }
  };
}

/**
 * Discord-style dark tooltip via portal.
 * Desktop: hover/focus. Mobile: child should keep aria-label (no sticky hover).
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  delayMs = 180,
  disabled = false,
  className,
}: TooltipProps) {
  const tipId = useId();
  const anchorRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0, side });

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const place = useCallback(() => {
    const el = anchorRef.current;
    const tip = tipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const tipW = tip?.offsetWidth ?? 120;
    const tipH = tip?.offsetHeight ?? 28;
    const gap = 8;
    let nextSide = side;
    let x = 0;
    let y = 0;

    const trySide = (s: TooltipSide) => {
      switch (s) {
        case 'top':
          x = rect.left + rect.width / 2 - tipW / 2;
          y = rect.top - tipH - gap;
          break;
        case 'bottom':
          x = rect.left + rect.width / 2 - tipW / 2;
          y = rect.bottom + gap;
          break;
        case 'left':
          x = rect.left - tipW - gap;
          y = rect.top + rect.height / 2 - tipH / 2;
          break;
        case 'right':
          x = rect.right + gap;
          y = rect.top + rect.height / 2 - tipH / 2;
          break;
      }
    };

    trySide(side);
    if (side === 'top' && y < 4) {
      nextSide = 'bottom';
      trySide('bottom');
    } else if (side === 'bottom' && y + tipH > window.innerHeight - 4) {
      nextSide = 'top';
      trySide('top');
    } else if (side === 'left' && x < 4) {
      nextSide = 'right';
      trySide('right');
    } else if (side === 'right' && x + tipW > window.innerWidth - 4) {
      nextSide = 'left';
      trySide('left');
    }

    x = Math.max(4, Math.min(x, window.innerWidth - tipW - 4));
    y = Math.max(4, Math.min(y, window.innerHeight - tipH - 4));
    setPos({ x, y, side: nextSide });
  }, [side]);

  const show = () => {
    if (disabled || content == null || content === '') return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setOpen(true);
    }, delayMs);
  };

  const hide = () => {
    clearTimer();
    setOpen(false);
  };

  useEffect(() => () => clearTimer(), []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, place, content]);

  type ChildProps = {
    onMouseEnter?: (e: MouseEvent) => void;
    onMouseLeave?: (e: MouseEvent) => void;
    onFocus?: (e: FocusEvent) => void;
    onBlur?: (e: FocusEvent) => void;
    'aria-describedby'?: string;
    ref?: Ref<HTMLElement>;
  };

  const child = children as ReactElement<ChildProps>;
  const trigger = cloneElement(child, {
    ref: mergeRefs(anchorRef, (child as { ref?: Ref<HTMLElement> }).ref),
    'aria-describedby': open ? tipId : child.props['aria-describedby'],
    onMouseEnter: (e: MouseEvent) => {
      child.props.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e: MouseEvent) => {
      child.props.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e: FocusEvent) => {
      child.props.onFocus?.(e);
      show();
    },
    onBlur: (e: FocusEvent) => {
      child.props.onBlur?.(e);
      hide();
    },
  } as ChildProps);

  return (
    <>
      {trigger}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className={cn(
              'pointer-events-none fixed z-[9999] px-2.5 py-1.5 rounded-md',
              'bg-surface-container-highest text-on-surface font-label-sm text-[12px] font-semibold',
              'shadow-lg border border-outline-variant/20 max-w-[240px] text-center',
              className,
            )}
            style={{ left: pos.x, top: pos.y }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
