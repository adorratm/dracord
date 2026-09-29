'use client';

import type { MessageDto } from '@dracord/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn';
import { contentHasSelfMention, tokenizeMessageContent } from '../lib/mentions';
import { Avatar } from './Avatar';
import { MessageAttachmentView } from './MessageAttachmentView';
import { MessageEmbedView } from './MessageEmbedView';

export interface MessageItemActions {
  currentUserId?: string | null;
  canManageMessages?: boolean;
  onEdit?: (message: MessageDto) => void;
  onDelete?: (message: MessageDto) => void;
  onReact?: (message: MessageDto, emoji: string) => void;
  onHide?: (message: MessageDto, permanent: boolean) => void;
  onUnhide?: (message: MessageDto) => void;
  onBlockAuthor?: (message: MessageDto) => void;
  onVotePoll?: (message: MessageDto, optionId: string) => void;
}

export interface MessageItemProps {
  message: MessageDto;
  compact?: boolean;
  showAvatar?: boolean;
  mentionNames?: string[];
  channelNames?: string[];
  censorLinkPreviews?: boolean;
  actions?: MessageItemActions;
  className?: string;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function isStickerOnly(content: string): boolean {
  const t = content.trim();
  return /^sticker:\S+$/u.test(t) || /^\p{Extended_Pictographic}$/u.test(t);
}

function stickerGlyph(content: string): string {
  const t = content.trim();
  if (t.startsWith('sticker:')) return t.slice('sticker:'.length);
  return t;
}

function renderMessageContent(
  content: string,
  mentionNames: string[],
  channelNames: string[],
): ReactNode {
  if (isStickerOnly(content)) {
    return (
      <span className="text-5xl leading-none select-none" role="img" aria-label="sticker">
        {stickerGlyph(content)}
      </span>
    );
  }

  const tokens = tokenizeMessageContent(content, { mentionNames, channelNames });
  return tokens.map((t, i) => {
    if (t.type === 'mention' || t.type === 'channel') {
      return (
        <span
          key={i}
          className="text-primary-container bg-primary-container/15 hover:bg-primary-container/25 rounded px-0.5 cursor-pointer transition-colors"
        >
          {t.value}
        </span>
      );
    }
    if (t.type === 'url') {
      return (
        <a
          key={i}
          href={t.value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-container underline underline-offset-2 break-all"
        >
          {t.value}
        </a>
      );
    }
    return <span key={i}>{t.value}</span>;
  });
}

export function MessageItem({
  message,
  compact = false,
  showAvatar = true,
  mentionNames = [],
  channelNames = [],
  censorLinkPreviews = false,
  actions,
  className,
}: MessageItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const author = message.author;
  const isMine = Boolean(actions?.currentUserId && author.id === actions.currentUserId);
  const canDelete = isMine || Boolean(actions?.canManageMessages);
  const canEdit = isMine;
  const sticker = isStickerOnly(message.content);
  const isSelfMention = contentHasSelfMention(message.content, mentionNames);
  const hidePlainContent =
    sticker ||
    (message.attachments?.length === 1 && !message.content.trim()) ||
    (message.attachments?.length === 1 &&
      message.attachments[0] &&
      message.content.trim() === message.attachments[0].filename);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  if (message.viewerHide === 'hidden') {
    return (
      <article className="px-space-md py-space-sm flex items-center gap-space-sm text-outline">
        <span className="material-symbols-outlined text-[18px]">visibility_off</span>
        <span className="font-body-sm flex-1">Gizli mesaj</span>
        <button
          type="button"
          className="font-label-sm text-primary-container hover:underline"
          onClick={() => actions?.onUnhide?.(message)}
        >
          Göster
        </button>
        <button
          type="button"
          className="font-label-sm text-error hover:underline"
          onClick={() => actions?.onHide?.(message, true)}
        >
          Bir daha gösterme
        </button>
      </article>
    );
  }

  return (
    <article
      className={cn(
        'group flex gap-space-md px-space-md py-space-xs hover:bg-surface-container-low/60 transition-colors relative',
        compact && 'py-0.5',
        isSelfMention && 'bg-primary-container/10 hover:bg-primary-container/15',
        menuOpen && 'z-50',
        className,
      )}
      data-menu-open={menuOpen ? '' : undefined}
    >
      {isSelfMention && (
        <span
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary-container"
          aria-hidden
        />
      )}
      {showAvatar ? (
        <Avatar
          displayName={author.displayName}
          imageUrl={author.avatarUrl}
          size="lg"
          status={author.status}
          statusRing={false}
          className="mt-0.5"
        />
      ) : (
        <div className="w-12 shrink-0" aria-hidden />
      )}
      <div className="flex flex-col min-w-0 flex-1">
        <header className="flex items-baseline gap-space-sm flex-wrap">
          <span
            className="font-headline-md text-headline-md hover:underline cursor-pointer"
            style={author.bannerColor ? { color: author.bannerColor } : { color: '#bd93f9' }}
          >
            {author.displayName}
          </span>
          <time className="font-label-sm text-label-sm text-outline" dateTime={message.createdAt}>
            {formatTimestamp(message.createdAt)}
          </time>
          {message.updatedAt && (
            <span className="font-label-sm text-label-sm text-outline">(düzenlendi)</span>
          )}
        </header>
        {!hidePlainContent && (
          <p
            className={cn(
              'font-body-md text-body-md text-on-surface whitespace-pre-wrap break-words',
              sticker && 'mt-1',
            )}
          >
            {renderMessageContent(message.content, mentionNames, channelNames)}
          </p>
        )}
        {sticker && hidePlainContent && (
          <div className="mt-1">
            {renderMessageContent(message.content, mentionNames, channelNames)}
          </div>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <ul className="flex flex-col gap-space-sm">
            {message.attachments.map((a) => (
              <li key={a.id}>
                <MessageAttachmentView attachment={a} />
              </li>
            ))}
          </ul>
        )}
        {message.embeds && message.embeds.length > 0 && (
          <div className="flex flex-col gap-space-xs">
            {message.embeds.map((embed) => (
              <MessageEmbedView
                key={embed.url}
                embed={embed}
                censored={censorLinkPreviews}
              />
            ))}
          </div>
        )}
        {message.poll && (
          <div className="mt-space-sm max-w-md rounded-lg border border-surface-container-highest bg-surface-container-low p-space-sm space-y-space-xs">
            <p className="font-headline-md text-on-surface">{message.poll.question}</p>
            {message.poll.options.map((opt) => {
              const pct =
                message.poll!.totalVotes > 0
                  ? Math.round((opt.voteCount / message.poll!.totalVotes) * 100)
                  : 0;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={message.poll!.closed}
                  onClick={() => actions?.onVotePoll?.(message, opt.id)}
                  className={cn(
                    'relative w-full text-left rounded-lg overflow-hidden border px-space-sm py-space-xs',
                    opt.voted
                      ? 'border-primary-container bg-primary-container/15'
                      : 'border-surface-container-highest hover:bg-surface-bright',
                  )}
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-primary-container/20"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative flex justify-between gap-space-sm font-body-sm">
                    <span>{opt.text}</span>
                    <span className="text-outline">
                      {opt.voteCount} · %{pct}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => actions?.onReact?.(message, r.emoji)}
                className={cn(
                  'h-7 px-2 rounded-full text-sm border flex items-center gap-1',
                  r.me
                    ? 'border-primary-container bg-primary-container/20'
                    : 'border-surface-container-highest hover:bg-surface-bright',
                )}
              >
                <span>{r.emoji}</span>
                <span className="font-label-sm text-outline">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {actions && (
        <div
          className={cn(
            'absolute right-space-sm -top-3 transition-opacity flex items-center gap-0.5 rounded-lg bg-surface-container-high border border-surface-container-highest shadow-bar p-0.5 z-50',
            menuOpen
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
          )}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="h-7 w-7 rounded hover:bg-surface-bright text-sm"
              title="Tepki"
              onClick={() => actions.onReact?.(message, emoji)}
            >
              {emoji}
            </button>
          ))}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="h-7 w-7 rounded hover:bg-surface-bright flex items-center justify-center text-outline"
              aria-label="Daha fazla"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="material-symbols-outlined text-[16px] leading-none">more_horiz</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg bg-surface-container-high border border-surface-container-highest shadow-float py-1 z-[60]">
                {canEdit && (
                  <button
                    type="button"
                    className="w-full text-left px-space-sm py-1.5 font-body-sm hover:bg-surface-bright"
                    onClick={() => {
                      setMenuOpen(false);
                      actions.onEdit?.(message);
                    }}
                  >
                    Düzenle
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="w-full text-left px-space-sm py-1.5 font-body-sm text-error hover:bg-error/10"
                    onClick={() => {
                      setMenuOpen(false);
                      actions.onDelete?.(message);
                    }}
                  >
                    Sil
                  </button>
                )}
                <button
                  type="button"
                  className="w-full text-left px-space-sm py-1.5 font-body-sm hover:bg-surface-bright"
                  onClick={() => {
                    setMenuOpen(false);
                    actions.onHide?.(message, false);
                  }}
                >
                  Gizle
                </button>
                <button
                  type="button"
                  className="w-full text-left px-space-sm py-1.5 font-body-sm hover:bg-surface-bright"
                  onClick={() => {
                    setMenuOpen(false);
                    actions.onHide?.(message, true);
                  }}
                >
                  Bir daha gösterme
                </button>
                {!isMine && (
                  <button
                    type="button"
                    className="w-full text-left px-space-sm py-1.5 font-body-sm text-error hover:bg-error/10"
                    onClick={() => {
                      setMenuOpen(false);
                      actions.onBlockAuthor?.(message);
                    }}
                  >
                    Kullanıcıyı engelle
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export interface MessageListProps {
  messages: MessageDto[];
  mentionNames?: string[];
  channelNames?: string[];
  censorLinkPreviews?: boolean;
  messageActions?: MessageItemActions;
  emptyState?: ReactNode;
  className?: string;
  scrollKey?: string;
  hasMore?: boolean;
  loadingOlder?: boolean;
  pendingNewCount?: number;
  highlightMessageId?: string | null;
  onLoadOlder?: () => void;
  onJumpToPresent?: () => void;
  onLiveEdgeChange?: (atLive: boolean) => void;
  /** Arama vurgusu yerleştikten sonra (URL temizliği için) */
  onHighlightSettled?: (messageId: string) => void;
}

function dedupeMessages(messages: MessageDto[]): MessageDto[] {
  const seen = new Set<string>();
  const out: MessageDto[] = [];
  for (const m of messages) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

export function MessageList({
  messages: rawMessages,
  mentionNames = [],
  channelNames = [],
  censorLinkPreviews = false,
  messageActions,
  emptyState,
  className,
  scrollKey,
  hasMore,
  loadingOlder,
  pendingNewCount = 0,
  highlightMessageId,
  onLoadOlder,
  onJumpToPresent,
  onLiveEdgeChange,
  onHighlightSettled,
}: MessageListProps) {
  const messages = useMemo(() => dedupeMessages(rawMessages), [rawMessages]);
  const parentRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const prevScrollKey = useRef(scrollKey);
  const prevLenRef = useRef(messages.length);
  const highlightDoneRef = useRef<string | null>(null);
  const [scrolledAway, setScrolledAway] = useState(false);
  const [parentHeight, setParentHeight] = useState(0);
  /** Görsel vurgu: prop'tan kopyalanır, kısa süre sonra söner */
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
    getItemKey: (index) => messages[index]?.id ?? String(index),
  });

  // Viewport yüksekliğini izle (kısa liste spacer için)
  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setParentHeight(el.clientHeight);
    });
    ro.observe(el);
    setParentHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const checkLiveEdge = useCallback(() => {
    const el = parentRef.current;
    if (!el) return true;
    if (el.scrollHeight <= el.clientHeight + 4) {
      const atLive = !activeHighlightId;
      stickToBottomRef.current = atLive;
      setScrolledAway(!atLive);
      onLiveEdgeChange?.(atLive);
      return atLive;
    }
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atLive = dist < 80;
    stickToBottomRef.current = atLive;
    setScrolledAway(!atLive);
    onLiveEdgeChange?.(atLive);
    return atLive;
  }, [onLiveEdgeChange, activeHighlightId]);

  // Kanal değişince
  useLayoutEffect(() => {
    if (prevScrollKey.current === scrollKey) return;
    prevScrollKey.current = scrollKey;
    highlightDoneRef.current = null;
    setActiveHighlightId(null);

    if (highlightMessageId) {
      stickToBottomRef.current = false;
      setScrolledAway(true);
      onLiveEdgeChange?.(false);
      return;
    }

    stickToBottomRef.current = true;
    setScrolledAway(false);
    requestAnimationFrame(() => {
      const el = parentRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      onLiveEdgeChange?.(true);
    });
  }, [scrollKey, highlightMessageId, onLiveEdgeChange]);

  // Canlı kenarda yeni mesaj
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    if (
      !highlightMessageId &&
      !activeHighlightId &&
      stickToBottomRef.current &&
      messages.length > prevLenRef.current
    ) {
      el.scrollTop = el.scrollHeight;
    }
    prevLenRef.current = messages.length;
  }, [messages.length, highlightMessageId, activeHighlightId]);

  // Arama: tek mesaja kaydır + kısa vurgu
  useEffect(() => {
    if (!highlightMessageId || messages.length === 0) return;
    const idx = messages.findIndex((m) => m.id === highlightMessageId);
    if (idx < 0) return;

    const doneKey = `${scrollKey}:${highlightMessageId}`;
    if (highlightDoneRef.current === doneKey) return;
    highlightDoneRef.current = doneKey;

    setActiveHighlightId(highlightMessageId);
    stickToBottomRef.current = false;
    setScrolledAway(true);
    onLiveEdgeChange?.(false);

    let cancelled = false;
    const timers: number[] = [];

    const jump = () => {
      if (cancelled) return;
      virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'auto' });
    };

    const raf = requestAnimationFrame(() => {
      jump();
      // Görsel ölçüldükten sonra bir kez daha (üst üste measure() çağırma)
      timers.push(
        window.setTimeout(() => {
          jump();
          onHighlightSettled?.(highlightMessageId);
        }, 150),
      );
    });

    // Vurgusu birkaç saniye sonra kaldır (kalıcı çift highlight olmasın)
    timers.push(
      window.setTimeout(() => {
        if (!cancelled) setActiveHighlightId(null);
      }, 2500),
    );

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightMessageId, messages.length, scrollKey]);

  const onScroll = () => {
    const el = parentRef.current;
    if (!el) return;
    checkLiveEdge();
    if (el.scrollTop < 80 && hasMore && !loadingOlder) {
      const prevHeight = el.scrollHeight;
      const prevTop = el.scrollTop;
      onLoadOlder?.();
      requestAnimationFrame(() => {
        const next = parentRef.current;
        if (!next) return;
        next.scrollTop = prevTop + (next.scrollHeight - prevHeight);
      });
    }
  };

  if (messages.length === 0 && emptyState) {
    return (
      <div className={cn('flex-1 flex items-center justify-center text-outline', className)}>
        {emptyState}
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();
  const showJump = scrolledAway || pendingNewCount > 0;
  const totalSize = virtualizer.getTotalSize();
  // Kısa liste: üstten spacer — flex justify-end kullanma (virtualizer bozuluyor)
  const topPad = Math.max(0, parentHeight - totalSize);

  return (
    <div className={cn('relative flex-1 min-h-0 flex flex-col', className)}>
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto min-h-0"
        role="log"
        aria-live="polite"
        onScroll={onScroll}
      >
        {loadingOlder && (
          <div className="py-space-sm text-center font-label-sm text-outline">
            Eski mesajlar yükleniyor…
          </div>
        )}
        <div
          className="relative w-full"
          style={{ height: `${totalSize + topPad}px` }}
        >
          {items.map((virtualRow) => {
            const message = messages[virtualRow.index];
            if (!message) return null;
            const prev = messages[virtualRow.index - 1];
            const compact =
              !!prev &&
              prev.author.id === message.author.id &&
              new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() <
                5 * 60 * 1000;
            const highlighted = activeHighlightId === message.id;

            return (
              <div
                key={message.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={cn(
                  'hover:z-30 focus-within:z-40 [&:has([data-menu-open])]:z-50',
                  highlighted && 'bg-primary-container/20 rounded-lg',
                )}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start + topPad}px)`,
                }}
              >
                <MessageItem
                  message={message}
                  compact={compact}
                  showAvatar={!compact}
                  mentionNames={mentionNames}
                  channelNames={channelNames}
                  censorLinkPreviews={censorLinkPreviews}
                  actions={messageActions}
                />
              </div>
            );
          })}
        </div>
      </div>

      {showJump && (
        <button
          type="button"
          onClick={() => {
            stickToBottomRef.current = true;
            setScrolledAway(false);
            setActiveHighlightId(null);
            highlightDoneRef.current = null;
            onJumpToPresent?.();
            requestAnimationFrame(() => {
              const el = parentRef.current;
              if (el) el.scrollTop = el.scrollHeight;
              onLiveEdgeChange?.(true);
            });
          }}
          className="absolute bottom-space-md right-space-md z-10 h-9 px-space-md rounded-lg bg-primary-container text-on-primary-container font-label-sm shadow-bar hover:opacity-95"
        >
          {pendingNewCount > 0 ? `${pendingNewCount} yeni mesaj · Günümüze git` : 'Günümüze git'}
        </button>
      )}
    </div>
  );
}
