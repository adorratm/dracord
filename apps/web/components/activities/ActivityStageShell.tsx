'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '@dracord/ui';

function usePanelResize(
  width: number,
  onChange: ((w: number) => void) | undefined,
  min: number,
  max: number,
  invert = false,
) {
  const startRef = useRef<{ x: number; w: number } | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!onChange) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      startRef.current = { x: e.clientX, w: width };
    },
    [onChange, width],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!onChange || !startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      const delta = invert ? -dx : dx;
      onChange(Math.min(max, Math.max(min, startRef.current.w + delta)));
    },
    [onChange, min, max, invert],
  );

  const onPointerUp = useCallback(() => {
    startRef.current = null;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}

/**
 * Oyun / watch party için ses kanalına benzer sol sohbet + sağ üyeler kabuğu.
 * Mobilde overlay drawer.
 */
export function ActivityStageShell({
  header,
  children,
  chatPanel,
  participantsPanel,
  chatOpen,
  participantsOpen,
  onToggleChat,
  onToggleParticipants,
  chatPanelWidth = 320,
  onChatPanelWidthChange,
  participantsPanelWidth = 280,
  onParticipantsPanelWidthChange,
  className,
}: {
  header: ReactNode;
  children: ReactNode;
  chatPanel?: ReactNode;
  participantsPanel?: ReactNode;
  chatOpen?: boolean;
  participantsOpen?: boolean;
  onToggleChat?: () => void;
  onToggleParticipants?: () => void;
  chatPanelWidth?: number;
  onChatPanelWidthChange?: (w: number) => void;
  participantsPanelWidth?: number;
  onParticipantsPanelWidthChange?: (w: number) => void;
  className?: string;
}) {
  const [localChatW, setLocalChatW] = useState(chatPanelWidth);
  const [localPartW, setLocalPartW] = useState(participantsPanelWidth);

  useEffect(() => setLocalChatW(chatPanelWidth), [chatPanelWidth]);
  useEffect(() => setLocalPartW(participantsPanelWidth), [participantsPanelWidth]);

  const setChatW = useCallback(
    (w: number) => {
      setLocalChatW(w);
      onChatPanelWidthChange?.(w);
    },
    [onChatPanelWidthChange],
  );
  const setPartW = useCallback(
    (w: number) => {
      setLocalPartW(w);
      onParticipantsPanelWidthChange?.(w);
    },
    [onParticipantsPanelWidthChange],
  );

  const chatResize = usePanelResize(localChatW, setChatW, 220, 520);
  const partResize = usePanelResize(localPartW, setPartW, 220, 420, true);

  const showChat = Boolean(chatOpen && chatPanel);
  const showParts = Boolean(participantsOpen && participantsPanel);

  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 min-w-0 max-w-[100vw] flex-col overflow-hidden bg-[#11131e]',
        className,
      )}
    >
      <div className="flex min-h-12 shrink-0 items-center gap-1 border-b border-surface-container-highest bg-surface-container-low px-2 sm:gap-2 sm:px-3">
        <div className="min-w-0 flex-1 overflow-hidden">{header}</div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onToggleChat}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
              chatOpen
                ? 'bg-surface-container-high text-on-surface'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
            )}
            aria-label="Sohbet"
            aria-pressed={chatOpen}
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
          </button>
          <button
            type="button"
            onClick={onToggleParticipants}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
              participantsOpen
                ? 'bg-surface-container-high text-on-surface'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
            )}
            aria-label="Üyeler"
            aria-pressed={participantsOpen}
          >
            <span className="material-symbols-outlined text-[20px]">group</span>
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* Desktop sol sohbet */}
        {showChat && (
          <aside
            className="relative hidden h-full min-h-0 shrink-0 border-r border-surface-container-highest bg-surface md:flex md:flex-col"
            style={{ width: localChatW }}
          >
            <div className="min-h-0 flex-1 overflow-hidden">{chatPanel}</div>
            <div
              role="separator"
              aria-orientation="vertical"
              className="absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize hover:bg-primary-container/40"
              onPointerDown={chatResize.onPointerDown}
              onPointerMove={chatResize.onPointerMove}
              onPointerUp={chatResize.onPointerUp}
            />
          </aside>
        )}

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>

        {/* Desktop sağ üyeler */}
        {showParts && (
          <aside
            className="relative hidden h-full min-h-0 shrink-0 border-l border-surface-container-highest bg-surface md:flex md:flex-col"
            style={{ width: localPartW }}
          >
            <div
              role="separator"
              aria-orientation="vertical"
              className="absolute inset-y-0 left-0 z-10 w-1 cursor-col-resize hover:bg-primary-container/40"
              onPointerDown={partResize.onPointerDown}
              onPointerMove={partResize.onPointerMove}
              onPointerUp={partResize.onPointerUp}
            />
            <div className="min-h-0 flex-1 overflow-hidden">{participantsPanel}</div>
          </aside>
        )}

        {/* Mobil overlay drawer’lar */}
        {showChat && (
          <div className="absolute inset-0 z-30 flex md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Sohbeti kapat"
              onClick={onToggleChat}
            />
            <aside className="relative z-10 flex h-full w-[min(100%,20rem)] max-w-[100vw] flex-col overflow-hidden bg-surface shadow-xl">
              {chatPanel}
            </aside>
          </div>
        )}
        {showParts && (
          <div className="absolute inset-0 z-30 flex justify-end md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Üyeleri kapat"
              onClick={onToggleParticipants}
            />
            <aside className="relative z-10 flex h-full w-[min(100%,18rem)] max-w-[100vw] flex-col overflow-hidden bg-surface shadow-xl">
              {participantsPanel}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
