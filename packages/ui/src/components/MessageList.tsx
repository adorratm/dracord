'use client';

import type { MessageDto, PublicUser } from '@dracord/types';
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
import {
  MediaLightbox,
  MessageAttachmentView,
  type ImageModerationProps,
} from './MessageAttachmentView';
import { MessageEmbedView } from './MessageEmbedView';
import { UserHoverCard } from './UserHoverCard';

export interface MessageItemActions {
  currentUserId?: string | null;
  canManageMessages?: boolean;
  guildId?: string | null;
  /** DM ise true — link formatı için */
  isDm?: boolean;
  onEdit?: (message: MessageDto) => void;
  onDelete?: (message: MessageDto) => void;
  onReact?: (message: MessageDto, emoji: string) => void;
  onHide?: (message: MessageDto, permanent: boolean) => void;
  onUnhide?: (message: MessageDto) => void;
  onBlockAuthor?: (message: MessageDto) => void;
  onVotePoll?: (message: MessageDto, optionId: string) => void;
  onReply?: (message: MessageDto) => void;
  onForward?: (message: MessageDto) => void;
  onPin?: (message: MessageDto, pin: boolean) => void;
  onBookmark?: (message: MessageDto, bookmark: boolean) => void;
  onOpenThread?: (message: MessageDto) => void;
  onCreateHeading?: (message: MessageDto) => void;
  onMarkUnread?: (message: MessageDto) => void;
  onJumpToMessage?: (messageId: string) => void;
  /** Mesaj bildir (moderasyon) */
  onReport?: (message: MessageDto) => void;
  /** Geliştirici modu: ID kopyala */
  developerMode?: boolean;
  /** Yazar adına tıklanınca */
  onAuthorClick?: (author: PublicUser) => void;
}

export interface MessageItemProps {
  message: MessageDto;
  compact?: boolean;
  /** Görünüm: kompakt mesaj yoğunluğu (sıkı satır aralığı) */
  dense?: boolean;
  showAvatar?: boolean;
  mentionNames?: string[];
  channelNames?: string[];
  censorLinkPreviews?: boolean;
  hideEmbeds?: boolean;
  hour24?: boolean;
  locale?: string;
  actions?: MessageItemActions;
  className?: string;
  imageModeration?: ImageModerationProps | null;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
const MENU_QUICK_EMOJIS = ['👍', '👀', '😂', '😀'];
const REACT_PICKER_EMOJIS = [
  ...QUICK_EMOJIS,
  '🔥',
  '👏',
  '💯',
  '👀',
  '✨',
  '🙏',
  '💪',
  '🤔',
  '😎',
  '🥳',
  '😀',
];

function MenuDivider() {
  return <div className="h-px my-1 mx-2 bg-outline-variant/40" role="separator" />;
}

function MenuRow({
  icon,
  label,
  onClick,
  danger,
  chevron,
  disabled,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  chevron?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-[6px] rounded mx-1 my-0.5 text-left font-body-sm transition-colors disabled:opacity-40',
        danger
          ? 'text-error hover:bg-error/15'
          : 'text-on-surface hover:bg-surface-bright',
      )}
      style={{ width: 'calc(100% - 8px)' }}
    >
      <span
        className={cn(
          'material-symbols-outlined text-[18px] leading-none shrink-0',
          danger ? 'text-error' : 'text-on-surface-variant',
        )}
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {chevron && (
        <span className="material-symbols-outlined text-[16px] text-outline leading-none">
          chevron_right
        </span>
      )}
    </button>
  );
}

function formatTimestamp(iso: string, hour24 = true, locale = 'tr-TR'): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: !hour24,
    });
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

function isStickerMediaUrl(value: string): boolean {
  return (
    /^https?:\/\//i.test(value) ||
    value.startsWith('data:image') ||
    value.startsWith('/')
  );
}

function contentIsOnlyMediaUrls(
  content: string,
  mediaUrls: Set<string>,
): boolean {
  const t = content.trim();
  if (!t || !mediaUrls.size) return false;
  if (mediaUrls.has(t)) return true;
  const urls = t.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  if (!urls.length) return false;
  const rest = t.replace(/https?:\/\/[^\s<>"')\]]+/gi, '').trim();
  return !rest && urls.every((u) => mediaUrls.has(u.replace(/[.,;:!?)]+$/, '')));
}

function renderMessageContent(
  content: string,
  mentionNames: string[],
  channelNames: string[],
  opts?: {
    hideUrls?: Set<string>;
    onStickerClick?: (url: string) => void;
  },
): ReactNode {
  if (isStickerOnly(content)) {
    const glyph = stickerGlyph(content);
    if (isStickerMediaUrl(glyph)) {
      return (
        <button
          type="button"
          onClick={() => opts?.onStickerClick?.(glyph)}
          className="block text-left"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={glyph}
            alt="sticker"
            className="max-w-[160px] max-h-[160px] w-auto h-auto object-contain select-none cursor-zoom-in"
            loading="lazy"
          />
        </button>
      );
    }
    return (
      <span className="text-5xl leading-none select-none" role="img" aria-label="sticker">
        {glyph}
      </span>
    );
  }

  const tokens = tokenizeMessageContent(content, { mentionNames, channelNames });
  return tokens.map((t, i) => {
    if (t.type === 'slash') {
      return (
        <span
          key={i}
          className="inline text-[#8be9fd] bg-[#8be9fd]/12 rounded px-1 font-semibold tracking-tight"
        >
          {t.value}
        </span>
      );
    }
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
      const cleaned = t.value.replace(/[.,;:!?)]+$/, '');
      if (opts?.hideUrls?.has(cleaned) || opts?.hideUrls?.has(t.value)) {
        return null;
      }
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
  dense = false,
  showAvatar = true,
  mentionNames = [],
  channelNames = [],
  censorLinkPreviews = false,
  hideEmbeds = false,
  hour24 = true,
  locale = 'tr-TR',
  actions,
  className,
  imageModeration = null,
}: MessageItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactPickerOpen, setReactPickerOpen] = useState(false);
  const [submenu, setSubmenu] = useState<'react' | 'apps' | 'interaction' | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [contentCopied, setContentCopied] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [stickerLightbox, setStickerLightbox] = useState<string | null>(null);
  /** Popover: aşağıda yer yoksa yukarı aç */
  const [popoverPlacement, setPopoverPlacement] = useState<'up' | 'down'>('down');
  const menuRef = useRef<HTMLDivElement>(null);
  const popoverPanelRef = useRef<HTMLDivElement>(null);
  const author = message.author;
  const isMine = Boolean(actions?.currentUserId && author.id === actions.currentUserId);
  const canDelete = isMine || Boolean(actions?.canManageMessages);
  const canEdit = isMine && message.type !== 'heading';
  const canPin = Boolean(actions?.canManageMessages) || !actions?.guildId;
  const sticker = isStickerOnly(message.content);
  const isSelfMention = contentHasSelfMention(message.content, mentionNames);
  const isHeading = message.type === 'heading';
  const mediaUrls = useMemo(() => {
    const set = new Set<string>();
    for (const a of message.attachments ?? []) set.add(a.url);
    for (const e of message.embeds ?? []) {
      set.add(e.url);
      if (e.imageUrl) set.add(e.imageUrl);
    }
    if (sticker) {
      const g = stickerGlyph(message.content);
      if (isStickerMediaUrl(g)) set.add(g);
    }
    return set;
  }, [message.attachments, message.embeds, message.content, sticker]);
  const hidePlainContent =
    Boolean(message.poll) ||
    sticker ||
    (message.attachments?.length === 1 && !message.content.trim()) ||
    (message.attachments?.length === 1 &&
      message.attachments[0] &&
      message.content.trim() === message.attachments[0].filename) ||
    contentIsOnlyMediaUrls(message.content, mediaUrls);
  const hideMediaEmbeds =
    hideEmbeds ||
    sticker ||
    Boolean(message.attachments?.length) ||
    contentIsOnlyMediaUrls(message.content, mediaUrls);

  const computePlacement = useCallback((estimatedHeight: number) => {
    const el = menuRef.current;
    if (!el || typeof window === 'undefined') return 'down' as const;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    if (spaceBelow >= estimatedHeight) return 'down' as const;
    if (spaceAbove >= estimatedHeight) return 'up' as const;
    return spaceAbove > spaceBelow ? ('up' as const) : ('down' as const);
  }, []);

  useEffect(() => {
    if (!menuOpen && !reactPickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
        setReactPickerOpen(false);
        setSubmenu(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen, reactPickerOpen]);

  useLayoutEffect(() => {
    if (!menuOpen && !reactPickerOpen) return;
    const panel = popoverPanelRef.current;
    const height = panel?.offsetHeight ?? (reactPickerOpen || submenu === 'react' ? 180 : 420);
    setPopoverPlacement(computePlacement(height));
  }, [menuOpen, reactPickerOpen, submenu, computePlacement]);

  const popoverPosClass =
    popoverPlacement === 'up'
      ? 'bottom-full mb-1'
      : 'top-full mt-1';

  const closeAllMenus = () => {
    setMenuOpen(false);
    setReactPickerOpen(false);
    setSubmenu(null);
  };

  const openMenu = () => {
    setReactPickerOpen(false);
    setSubmenu(null);
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    setPopoverPlacement(computePlacement(420));
    setMenuOpen(true);
  };

  const openReactSubmenu = () => {
    setSubmenu((s) => (s === 'react' ? null : 'react'));
    setReactPickerOpen(false);
  };

  const openReactPicker = () => {
    setMenuOpen(false);
    setSubmenu(null);
    if (reactPickerOpen) {
      setReactPickerOpen(false);
      return;
    }
    setPopoverPlacement(computePlacement(180));
    setReactPickerOpen(true);
  };

  const copyLink = async () => {
    const path = actions?.isDm
      ? `/channels/@me/${message.channelId}?messageId=${message.id}`
      : actions?.guildId
        ? `/channels/${actions.guildId}/${message.channelId}?messageId=${message.id}`
        : `${typeof window !== 'undefined' ? window.location.pathname : ''}?messageId=${message.id}`;
    const url =
      typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      // ignore
    }
    closeAllMenus();
  };

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
        (compact || dense) && !isHeading && 'py-0.5',
        dense && isHeading && 'py-space-sm mt-space-xs',
        isSelfMention && 'bg-primary-container/10 hover:bg-primary-container/15',
        isHeading && !dense && 'py-space-md mt-space-sm border-t border-surface-container-highest/80',
        isHeading && dense && 'border-t border-surface-container-highest/80',
        (menuOpen || reactPickerOpen) && 'z-[3]',
        className,
      )}
      data-menu-open={menuOpen || reactPickerOpen ? '' : undefined}
    >
      {isSelfMention && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary-container" aria-hidden />
      )}
      {isHeading ? (
        <div className="w-12 shrink-0 flex justify-center pt-1" aria-hidden>
          <span className="material-symbols-outlined text-outline text-[22px]">title</span>
        </div>
      ) : showAvatar ? (
        <Avatar displayName={author.displayName} imageUrl={author.avatarUrl} size="lg" status={author.status} statusRing={false} className="mt-0.5" />
      ) : (
        <div className="w-12 shrink-0" aria-hidden />
      )}
      <div className="flex flex-col min-w-0 flex-1">
        {isHeading ? (
          <h3 className="font-headline-lg text-xl text-on-surface tracking-tight">{message.content}</h3>
        ) : (
          <>
            <header className="flex items-baseline gap-space-sm flex-wrap">
              <UserHoverCard user={author}>
                <button
                  type="button"
                  className="font-headline-md text-headline-md hover:underline cursor-pointer"
                  style={author.bannerColor ? { color: author.bannerColor } : { color: '#bd93f9' }}
                  onClick={() => actions?.onAuthorClick?.(author)}
                >
                  {author.displayName}
                </button>
              </UserHoverCard>
              <time className="font-label-sm text-label-sm text-outline" dateTime={message.createdAt}>{formatTimestamp(message.createdAt, hour24, locale)}</time>
              {message.updatedAt && <span className="font-label-sm text-label-sm text-outline">(düzenlendi)</span>}
              {message.pinnedAt && (
                <span className="font-label-sm text-label-sm text-primary-container inline-flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[14px] leading-none">push_pin</span>
                  Sabitlendi
                </span>
              )}
            </header>
            {message.replyTo && (
              <button type="button" onClick={() => actions?.onJumpToMessage?.(message.replyTo!.id)} className="mb-1 mt-0.5 max-w-md text-left rounded border-l-2 border-primary-container bg-surface-container-high/80 px-2 py-1 hover:bg-surface-bright">
                <span className="block font-label-sm text-primary-container truncate">{message.replyTo.authorName}</span>
                <span className="block font-body-sm text-outline truncate text-[12px]">{message.replyTo.contentPreview}</span>
              </button>
            )}
            {message.forwardedFrom && (
              <p className="mb-1 font-label-sm text-outline inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">forward</span>
                {message.forwardedFrom.authorName} mesajından iletildi
              </p>
            )}
            {!hidePlainContent && (
              <p className={cn('font-body-md text-body-md text-on-surface whitespace-pre-wrap break-words', sticker && 'mt-1')}>
                {renderMessageContent(message.content, mentionNames, channelNames, {
                  hideUrls: mediaUrls,
                })}
              </p>
            )}
            {sticker && (
              <div className="mt-1">
                {renderMessageContent(message.content, mentionNames, channelNames, {
                  onStickerClick: (url) => setStickerLightbox(url),
                })}
              </div>
            )}
          </>
        )}
        {!isHeading && message.attachments && message.attachments.length > 0 && (
          <ul className="flex flex-col gap-space-sm">
            {message.attachments.map((a) => (
              <li key={a.id}>
                <MessageAttachmentView
                  attachment={a}
                  imageModeration={imageModeration}
                />
              </li>
            ))}
          </ul>
        )}
        {!isHeading && !hideMediaEmbeds && message.embeds && message.embeds.length > 0 && (
          <div className="flex flex-col gap-space-xs">
            {message.embeds.map((embed) => (
              <MessageEmbedView key={embed.url} embed={embed} censored={censorLinkPreviews} />
            ))}
          </div>
        )}
        {!isHeading && message.poll && (
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
                    'relative w-full text-left rounded-lg overflow-hidden border px-space-sm py-space-xs transition-colors',
                    opt.voted
                      ? 'border-[#bd93f9] bg-[#bd93f9]/25 shadow-[inset_0_0_0_1px_rgba(189,147,249,0.35)]'
                      : 'border-surface-container-highest hover:bg-surface-bright',
                  )}
                >
                  <span
                    className={cn(
                      'absolute inset-y-0 left-0',
                      opt.voted ? 'bg-[#bd93f9]/35' : 'bg-primary-container/20',
                    )}
                    style={{ width: pct + '%' }}
                  />
                  <span className="relative flex items-center justify-between gap-space-sm font-body-sm">
                    <span className={cn(opt.voted && 'text-[#f8f8f2] font-semibold')}>{opt.text}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {(opt.voters?.length ?? 0) > 0 && (
                        <span className="flex -space-x-1.5">
                          {opt.voters!.slice(0, 3).map((v) => (
                            <Avatar
                              key={v.id}
                              displayName={v.displayName}
                              imageUrl={v.avatarUrl}
                              size="sm"
                              className="!h-5 !w-5 ring-1 ring-surface-container-low"
                            />
                          ))}
                        </span>
                      )}
                      <span className={cn('text-outline tabular-nums', opt.voted && 'text-[#bd93f9]')}>
                        {opt.voteCount} · %{pct}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <MediaLightbox
          attachment={
            stickerLightbox
              ? {
                  id: 'sticker',
                  url: stickerLightbox,
                  filename: 'sticker',
                  contentType: 'image/png',
                  size: 0,
                }
              : null
          }
          onClose={() => setStickerLightbox(null)}
        />
        {!isHeading && message.reactions && message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <div key={r.emoji} className="relative group/rxn">
                <button
                  type="button"
                  onClick={() => actions?.onReact?.(message, r.emoji)}
                  className={cn(
                    'h-7 px-2 rounded-full text-sm inline-flex items-center gap-1 border transition-transform duration-150 hover:scale-105 active:scale-95',
                    r.me
                      ? 'border-primary-container bg-primary-container/20'
                      : 'border-surface-container-highest bg-surface-container-low hover:bg-surface-bright',
                  )}
                >
                  <span className="dracord-pop">{r.emoji}</span>
                  <span className="font-label-sm text-outline">{r.count}</span>
                </button>
                {(r.users?.length ?? 0) > 0 && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[80] opacity-0 scale-95 group-hover/rxn:opacity-100 group-hover/rxn:scale-100 group-focus-within/rxn:opacity-100 transition-[opacity,transform] duration-150 origin-bottom"
                  >
                    <div className="min-w-[10rem] max-w-[14rem] rounded-xl border border-surface-container-highest bg-surface-container-high shadow-float px-2.5 py-2 dracord-fade-in">
                      <p className="font-label-sm text-outline mb-1.5 flex items-center gap-1">
                        <span>{r.emoji}</span>
                        <span>
                          {r.count} tepki
                          {r.me ? ' · sen' : ''}
                        </span>
                      </p>
                      <ul className="space-y-1 max-h-40 overflow-y-auto">
                        {(r.users ?? []).map((u) => (
                          <li key={u.id} className="flex items-center gap-2 min-w-0">
                            <Avatar
                              displayName={u.displayName}
                              imageUrl={u.avatarUrl}
                              size="sm"
                              statusRing={false}
                            />
                            <span className="font-label-sm text-on-surface truncate">
                              {u.displayName}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {!isHeading && !message.threadRootId && actions?.onOpenThread && (
            <button
              type="button"
              onClick={() => actions.onOpenThread?.(message)}
              className="mt-1 self-start inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-label-sm text-primary-container hover:bg-primary-container/10"
            >
              <span className="material-symbols-outlined text-[16px]">forum</span>
              {(message.threadReplyCount ?? 0) > 0
                ? `${message.threadReplyCount} yanıt — Thread’i gör`
                : 'Thread başlat'}
            </button>
          )}
      </div>

      {actions && (
        <div
          className={cn(
            'absolute right-space-sm transition-opacity flex items-center gap-0.5 rounded-lg bg-surface-container-high border border-surface-container-highest shadow-bar p-0.5 z-10 pointer-events-none [&_button]:pointer-events-auto',
            sticker ? 'bottom-1 top-auto' : '-top-3',
            menuOpen || reactPickerOpen
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
          )}
        >
          {!isHeading &&
            QUICK_EMOJIS.slice(0, 3).map((emoji) => (
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
          {!isHeading && (
            <button
              type="button"
              className="h-7 w-7 rounded hover:bg-surface-bright flex items-center justify-center text-outline"
              title="Tepki ekle"
              onClick={openReactPicker}
            >
              <span className="material-symbols-outlined text-[16px] leading-none">
                sentiment_satisfied
              </span>
            </button>
          )}
          {!isHeading && (
            <button
              type="button"
              className="h-7 w-7 rounded hover:bg-surface-bright flex items-center justify-center text-outline"
              title="Yanıtla"
              onClick={() => actions.onReply?.(message)}
            >
              <span className="material-symbols-outlined text-[16px] leading-none">reply</span>
            </button>
          )}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="h-7 w-7 rounded hover:bg-surface-bright flex items-center justify-center text-outline"
              aria-label="Daha fazla"
              aria-expanded={menuOpen}
              onClick={openMenu}
            >
              <span className="material-symbols-outlined text-[16px] leading-none">more_horiz</span>
            </button>
            {menuOpen && (
              <div
                ref={popoverPanelRef}
                className={cn(
                  'absolute right-0 w-[240px] rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float py-1.5 z-[60]',
                  popoverPosClass,
                )}
              >
                {!isHeading && (
                  <>
                    <div className="flex items-center justify-center gap-1.5 px-2.5 pb-1.5 pt-0.5">
                      {MENU_QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          title="Tepki"
                          className="h-8 w-8 rounded-md bg-surface-container-highest hover:bg-surface-bright text-[18px] flex items-center justify-center"
                          onClick={() => {
                            actions.onReact?.(message, emoji);
                            closeAllMenus();
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <MenuRow
                        icon="sentiment_satisfied"
                        label="Tepki Ekle"
                        chevron
                        onClick={openReactSubmenu}
                      />
                      {submenu === 'react' && (
                        <div className="absolute right-full top-0 mr-1 w-52 p-2 rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float flex flex-wrap gap-1 z-[70]">
                          {REACT_PICKER_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="h-8 w-8 rounded-md hover:bg-surface-bright text-lg"
                              onClick={() => {
                                actions.onReact?.(message, emoji);
                                closeAllMenus();
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <MenuDivider />
                    <MenuRow
                      icon="reply"
                      label="Yanıtla"
                      onClick={() => {
                        closeAllMenus();
                        actions.onReply?.(message);
                      }}
                    />
                    <MenuRow
                      icon="forward"
                      label="İlet"
                      onClick={() => {
                        closeAllMenus();
                        actions.onForward?.(message);
                      }}
                    />
                    <MenuRow
                      icon="title"
                      label="Alt Başlık Oluştur"
                      onClick={() => {
                        closeAllMenus();
                        actions.onCreateHeading?.(message);
                      }}
                    />
                    {actions.onOpenThread && (
                      <MenuRow
                        icon="forum"
                        label="Thread’de yanıtla"
                        onClick={() => {
                          closeAllMenus();
                          actions.onOpenThread?.(message);
                        }}
                      />
                    )}
                    <MenuDivider />
                  </>
                )}
                {canPin && (
                  <MenuRow
                    icon="push_pin"
                    label={message.pinnedAt ? 'Sabitlemeyi Kaldır' : 'Mesajı Sabitle'}
                    onClick={() => {
                      closeAllMenus();
                      actions.onPin?.(message, !message.pinnedAt);
                    }}
                  />
                )}
                {actions.onBookmark && (
                  <MenuRow
                    icon="bookmark"
                    label={message.bookmarked ? 'Yer imini kaldır' : 'Yer imine ekle'}
                    onClick={() => {
                      closeAllMenus();
                      actions.onBookmark?.(message, !message.bookmarked);
                    }}
                  />
                )}
                {!isHeading && (
                  <div className="relative">
                    <MenuRow
                      icon="apps"
                      label="Uygulamalar"
                      chevron
                      onClick={() =>
                        setSubmenu((s) => (s === 'apps' ? null : 'apps'))
                      }
                    />
                    {submenu === 'apps' && (
                      <div className="absolute right-full top-0 mr-1 w-52 py-1.5 rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float z-[70]">
                        <MenuRow
                          icon="content_copy"
                          label={contentCopied ? 'Kopyalandı!' : 'İçeriği Kopyala'}
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(message.content || '')
                              .then(() => {
                                setContentCopied(true);
                                window.setTimeout(() => setContentCopied(false), 1200);
                              })
                              .catch(() => undefined);
                          }}
                        />
                        <MenuRow
                          icon="format_quote"
                          label="Alıntılayarak Yanıtla"
                          onClick={() => {
                            closeAllMenus();
                            actions.onReply?.(message);
                          }}
                        />
                        {message.attachments?.[0]?.url && (
                          <MenuRow
                            icon="attach_file"
                            label="Ek Bağlantısını Kopyala"
                            onClick={() => {
                              void navigator.clipboard
                                .writeText(message.attachments![0]!.url)
                                .catch(() => undefined);
                              closeAllMenus();
                            }}
                          />
                        )}
                        {message.poll && (
                          <MenuRow
                            icon="poll"
                            label="Anket Özetini Kopyala"
                            onClick={() => {
                              const poll = message.poll!;
                              const text = [
                                poll.question,
                                ...poll.options.map(
                                  (o) => `• ${o.text}: ${o.voteCount}`,
                                ),
                              ].join('\n');
                              void navigator.clipboard.writeText(text).catch(() => undefined);
                              closeAllMenus();
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
                <MenuRow
                  icon="mark_chat_unread"
                  label="Okunmadı Olarak İşaretle"
                  onClick={() => {
                    closeAllMenus();
                    actions.onMarkUnread?.(message);
                  }}
                />
                <MenuRow
                  icon="link"
                  label={linkCopied ? 'Kopyalandı!' : 'Mesaj Bağlantısını Kopyala'}
                  onClick={() => void copyLink()}
                />
                {!isHeading && (
                  <div className="relative">
                    <MenuRow
                      icon="info"
                      label="Etkileşim Bilgilerini Görüntüle"
                      chevron
                      onClick={() =>
                        setSubmenu((s) => (s === 'interaction' ? null : 'interaction'))
                      }
                    />
                    {submenu === 'interaction' && (
                      <div className="absolute right-full top-0 mr-1 w-56 p-3 rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float z-[70] space-y-2">
                        <p className="font-label-sm text-outline uppercase tracking-wide">
                          Etkileşim
                        </p>
                        <p className="font-body-sm text-on-surface">
                          Yazar: {author.displayName}
                        </p>
                        <p className="font-body-sm text-on-surface-variant break-all">
                          ID: {message.id}
                        </p>
                        <p className="font-body-sm text-on-surface-variant">
                          {formatTimestamp(message.createdAt, hour24, locale)}
                        </p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {(message.reactions ?? []).length === 0 ? (
                            <span className="font-body-sm text-outline">Tepki yok</span>
                          ) : (
                            (message.reactions ?? []).map((r) => (
                              <span
                                key={r.emoji}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-highest font-body-sm"
                              >
                                {r.emoji} {r.count}
                              </span>
                            ))
                          )}
                        </div>
                        <button
                          type="button"
                          className="w-full mt-1 h-8 rounded-lg bg-surface-container-highest font-label-sm hover:bg-surface-bright"
                          onClick={() => {
                            const lines = [
                              `Mesaj: ${message.id}`,
                              `Yazar: ${author.displayName} (${author.id})`,
                              `Tepki: ${(message.reactions ?? []).map((r) => `${r.emoji} ${r.count}`).join(', ') || 'yok'}`,
                              `Zaman: ${message.createdAt}`,
                            ];
                            void navigator.clipboard.writeText(lines.join('\n')).catch(() => undefined);
                          }}
                        >
                          Bilgiyi Kopyala
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {(canEdit || canDelete || !isHeading) && <MenuDivider />}
                {canEdit && (
                  <MenuRow
                    icon="edit"
                    label="Düzenle"
                    onClick={() => {
                      closeAllMenus();
                      actions.onEdit?.(message);
                    }}
                  />
                )}
                {canDelete && (
                  <MenuRow
                    icon="delete"
                    label="Mesajı Sil"
                    danger
                    onClick={() => {
                      closeAllMenus();
                      actions.onDelete?.(message);
                    }}
                  />
                )}
                {!isHeading && !isMine && (
                  <MenuRow
                    icon="flag"
                    label={reportDone ? 'Bildirildi' : 'Mesaj Bildir'}
                    danger
                    onClick={() => {
                      if (actions.onReport) {
                        actions.onReport(message);
                      } else {
                        actions.onHide?.(message, true);
                      }
                      setReportDone(true);
                      window.setTimeout(() => {
                        setReportDone(false);
                        closeAllMenus();
                      }, 800);
                    }}
                  />
                )}
                {!isHeading && (
                  <>
                    <MenuRow
                      icon="visibility_off"
                      label="Gizle"
                      onClick={() => {
                        closeAllMenus();
                        actions.onHide?.(message, false);
                      }}
                    />
                    {!isMine && (
                      <MenuRow
                        icon="block"
                        label="Kullanıcıyı Engelle"
                        danger
                        onClick={() => {
                          closeAllMenus();
                          actions.onBlockAuthor?.(message);
                        }}
                      />
                    )}
                  </>
                )}
                <MenuDivider />
                <MenuRow
                  icon="tag"
                  label={idCopied ? 'Kopyalandı!' : 'Mesaj ID’sini Kopyala'}
                  onClick={() => {
                    void navigator.clipboard.writeText(message.id).then(() => {
                      setIdCopied(true);
                      window.setTimeout(() => setIdCopied(false), 1200);
                    }).catch(() => undefined);
                  }}
                />
                {actions?.developerMode && (
                  <MenuRow
                    icon="person"
                    label="Kullanıcı ID’sini Kopyala"
                    onClick={() => {
                      void navigator.clipboard.writeText(author.id).catch(() => undefined);
                      closeAllMenus();
                    }}
                  />
                )}
              </div>
            )}
            {reactPickerOpen && !menuOpen && (
              <div
                ref={popoverPanelRef}
                className={cn(
                  'absolute right-0 p-2 rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float z-[60] flex flex-wrap gap-1 w-52',
                  popoverPosClass,
                )}
              >
                {REACT_PICKER_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="h-8 w-8 rounded-md hover:bg-surface-bright text-lg"
                    onClick={() => {
                      actions.onReact?.(message, emoji);
                      closeAllMenus();
                    }}
                  >
                    {emoji}
                  </button>
                ))}
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
  hideEmbeds?: boolean;
  messageGrouping?: boolean;
  /** Görünüm ayarı: kompakt mesaj yoğunluğu */
  dense?: boolean;
  hour24?: boolean;
  locale?: string;
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
  imageModeration?: ImageModerationProps | null;
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
  hideEmbeds = false,
  messageGrouping = true,
  dense = false,
  hour24 = true,
  locale = 'tr-TR',
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
  imageModeration = null,
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

  const scrollToBottom = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const last = messages.length - 1;
    if (last >= 0) {
      try {
        virtualizer.scrollToIndex(last, { align: 'end', behavior: 'auto' });
      } catch {
        // ignore
      }
    }
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      const next = parentRef.current;
      if (next) next.scrollTop = next.scrollHeight;
    });
  }, [messages.length, virtualizer]);

  // Viewport yüksekliğini izle — player açılınca da alta yapış
  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setParentHeight(el.clientHeight);
      if (stickToBottomRef.current && !activeHighlightId) {
        el.scrollTop = el.scrollHeight;
      }
    });
    ro.observe(el);
    setParentHeight(el.clientHeight);
    return () => ro.disconnect();
  }, [activeHighlightId]);

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
    prevLenRef.current = 0;

    if (highlightMessageId) {
      stickToBottomRef.current = false;
      setScrolledAway(true);
      onLiveEdgeChange?.(false);
      return;
    }

    stickToBottomRef.current = true;
    setScrolledAway(false);
    onLiveEdgeChange?.(true);
    requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(() => scrollToBottom());
    });
  }, [scrollKey, highlightMessageId, onLiveEdgeChange, scrollToBottom]);

  // Canlı kenarda yeni mesaj / ilk yükleme
  useLayoutEffect(() => {
    if (highlightMessageId || activeHighlightId) {
      prevLenRef.current = messages.length;
      return;
    }
    if (!stickToBottomRef.current) {
      prevLenRef.current = messages.length;
      return;
    }
    if (messages.length === 0) {
      prevLenRef.current = 0;
      return;
    }
    // Uzunluk arttı veya kanalda ilk dolu liste
    if (messages.length !== prevLenRef.current || prevLenRef.current === 0) {
      scrollToBottom();
    }
    prevLenRef.current = messages.length;
  }, [messages.length, highlightMessageId, activeHighlightId, scrollToBottom, scrollKey]);

  // Ölçüm / spacer değişince de alta yapış (embed, görsel, player)
  const totalSizeForStick = virtualizer.getTotalSize();
  useLayoutEffect(() => {
    if (!stickToBottomRef.current || highlightMessageId || activeHighlightId) return;
    const el = parentRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [totalSizeForStick, parentHeight, highlightMessageId, activeHighlightId]);

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
    <div className={cn('relative z-0 flex-1 min-h-0 flex flex-col isolate', className)}>
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto min-h-0 relative z-0"
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
              messageGrouping &&
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
                  'relative z-0 transition-[background-color,box-shadow] duration-300',
                  // Menü açıkken komşu satırların üstüne çık; hover z yükseltme yapma (picker/jump ile çakışır)
                  '[&:has([data-menu-open])]:z-[3] focus-within:z-[2]',
                  highlighted &&
                    'bg-primary-container/25 ring-2 ring-inset ring-primary-container/60 rounded-lg shadow-[inset_0_0_0_1px_rgba(189,147,249,0.35)]',
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
                  dense={dense}
                  showAvatar={!compact}
                  mentionNames={mentionNames}
                  channelNames={channelNames}
                  censorLinkPreviews={censorLinkPreviews}
                  hideEmbeds={hideEmbeds}
                  hour24={hour24}
                  locale={locale}
                  actions={messageActions}
                  imageModeration={imageModeration}
                />
              </div>
            );
          })}
        </div>
      </div>

      {showJump && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[50] flex justify-center px-space-md">
          <button
            type="button"
            onClick={() => {
              stickToBottomRef.current = true;
              setScrolledAway(false);
              setActiveHighlightId(null);
              highlightDoneRef.current = null;
              onJumpToPresent?.();
              requestAnimationFrame(() => {
                scrollToBottom();
                onLiveEdgeChange?.(true);
                requestAnimationFrame(() => scrollToBottom());
              });
            }}
            className="pointer-events-auto relative z-[50] h-9 px-4 rounded-full flex items-center justify-center gap-space-xs border border-surface-container-highest bg-surface-container-high/95 text-on-surface font-label-sm shadow-float backdrop-blur-sm hover:bg-surface-bright hover:border-primary-container/50 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] leading-none text-primary-container">
              keyboard_double_arrow_down
            </span>
            {pendingNewCount > 0
              ? `${pendingNewCount} yeni mesaj · Günümüze git`
              : 'Günümüze git'}
          </button>
        </div>
      )}
    </div>
  );
}
