'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';
import { tokenizeMessageContent } from '../lib/mentions';
import {
  CURATED_GIFS,
  EMOJI_CATEGORIES,
  STICKER_PACKS,
  emojiMatchesQuery,
  isMediaUrl,
  mediaItemMatchesQuery,
  type MediaPackItem,
} from '../lib/media-packs';
import { filterBotSlashCommands, type BotSlashCommand } from '../lib/bot-slash-commands';
import {
  addCustomSticker,
  loadCustomStickers,
  loadFavoriteIds,
  loadRecentIds,
  pushRecentId,
  readImageFileAsSticker,
  removeCustomSticker,
  toggleFavoriteId,
  type StoredSticker,
} from '../lib/sticker-store';
import { Avatar } from './Avatar';
import { VideoStickerTrimmer } from './VideoStickerTrimmer';
export type ChatMediaPayload =
  | { type: 'gif'; url: string; label: string }
  | { type: 'sticker'; emoji: string }
  | { type: 'sticker-image'; url: string; label: string; contentType?: string };

export interface GifSearchResult {
  id: string;
  url: string;
  previewUrl?: string;
  label: string;
}

export interface ChatMentionUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface ChatMentionChannel {
  id: string;
  name: string;
  type?: string;
}

export interface ChatInputProps {
  channelName?: string;
  placeholder?: string;
  disabled?: boolean;
  onSend?: (text: string, meta?: { replyToId?: string }) => void;
  onSendMedia?: (payload: ChatMediaPayload) => void;
  onEmojiClick?: () => void;
  onAttachClick?: () => void;
  onAttachFiles?: (files: FileList | File[]) => void;
  /** Anket oluşturma (üstte + menüsünden) */
  onPollClick?: () => void;
  /** Bölüm başlığı oluştur */
  onHeadingClick?: () => void;
  /** Yanıtlanan mesaj (composer quote) */
  replyTo?: {
    id: string;
    authorName: string;
    contentPreview: string;
  } | null;
  onCancelReply?: () => void;
  /** Tenor / harici GIF araması. Verilmezse yerel liste kullanılır. */
  searchGifs?: (query: string) => Promise<GifSearchResult[]>;
  loadFeaturedGifs?: () => Promise<GifSearchResult[]>;
  mentionUsers?: ChatMentionUser[];
  mentionChannels?: ChatMentionChannel[];
  /** Tarayıcı yazım denetimi */
  spellCheck?: boolean;
  /** Videodan sticker: GIF’i S3’e yükle (yoksa data URL kaydedilir) */
  uploadStickerFile?: (file: File) => Promise<{ url: string; contentType?: string }>;
  className?: string;
}

type PickerTab = 'emoji' | 'gif' | 'sticker';
type StickerSection = 'recent' | 'favorites' | 'mine' | 'packs';

function packStickerId(packId: string, stickerId: string) {
  return `pack:${packId}:${stickerId}`;
}

type MentionTrigger = {
  kind: 'user' | 'channel' | 'slash';
  start: number;
  query: string;
};

function detectMentionTrigger(text: string, caret: number): MentionTrigger | null {
  const before = text.slice(0, caret);
  // Slash komut: satır başında /
  const slash = before.match(/(?:^|\n)\/([a-zA-Z0-9çğıöşüÇĞİÖŞÜ_-]*)$/u);
  if (slash && slash.index != null) {
    const query = slash[1] ?? '';
    const start = caret - query.length - 1;
    return { kind: 'slash', start, query };
  }
  const match = before.match(/(?:^|[\s])([@#])([a-zA-Z0-9_.-]*)$/);
  if (!match || match.index == null) return null;
  const token = match[1]!;
  const query = match[2] ?? '';
  const start = caret - query.length - 1;
  return {
    kind: token === '@' ? 'user' : 'channel',
    start,
    query,
  };
}

function resolveStickerById(
  id: string,
  custom: StoredSticker[],
): StoredSticker | null {
  const customHit = custom.find((s) => s.id === id);
  if (customHit) return customHit;
  if (id.startsWith('pack:')) {
    const parts = id.split(':');
    const packId = parts[1];
    const stickerId = parts.slice(2).join(':');
    for (const pack of STICKER_PACKS) {
      if (pack.id !== packId) continue;
      const s = pack.stickers.find((x) => x.id === stickerId);
      if (s) {
        const image = isMediaUrl(s.value);
        return {
          id,
          kind: image ? 'image' : 'emoji',
          value: s.value,
          label: s.label,
          contentType: image ? 'image/gif' : undefined,
          createdAt: 0,
        };
      }
    }
  }
  return null;
}

export function ChatInput({
  channelName,
  placeholder,
  disabled,
  onSend,
  onSendMedia,
  onEmojiClick,
  onAttachClick,
  onAttachFiles,
  onPollClick,
  onHeadingClick,
  replyTo,
  onCancelReply,
  searchGifs,
  loadFeaturedGifs,
  mentionUsers = [],
  mentionChannels = [],
  spellCheck = true,
  uploadStickerFile,
  className,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachDragging, setAttachDragging] = useState(false);
  const [tab, setTab] = useState<PickerTab>('emoji');
  const [emojiCat, setEmojiCat] = useState(EMOJI_CATEGORIES[0]!.id);
  const [stickerSection, setStickerSection] = useState<StickerSection>('recent');
  const [customStickers, setCustomStickers] = useState<StoredSticker[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [stickerError, setStickerError] = useState<string | null>(null);
  const [videoTrimmerOpen, setVideoTrimmerOpen] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const [remoteGifs, setRemoteGifs] = useState<GifSearchResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mention, setMention] = useState<MentionTrigger | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const stickerFileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pickerPanelRef = useRef<HTMLDivElement>(null);
  const mentionPanelRef = useRef<HTMLDivElement>(null);
  const [pickerBox, setPickerBox] = useState<{
    bottom: number;
    left: number;
    width: number;
  } | null>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragDepth = useRef(0);
  const attachDragDepth = useRef(0);
  const gifReqId = useRef(0);

  const LINE_HEIGHT_PX = 24;
  const MAX_LINES = 8;
  const MAX_TEXTAREA_PX = LINE_HEIGHT_PX * MAX_LINES;
  const [expanded, setExpanded] = useState(false);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(Math.max(el.scrollHeight, LINE_HEIGHT_PX), MAX_TEXTAREA_PX);
    el.style.height = `${next}px`;
    setExpanded(next > LINE_HEIGHT_PX + 2);
  }, [LINE_HEIGHT_PX, MAX_TEXTAREA_PX]);

  useLayoutEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);


  const resolvedPlaceholder =
    placeholder ?? (channelName ? `#${channelName} kanalına mesaj gönder` : 'Mesaj yazın…');

  const refreshStickerState = useCallback(() => {
    setCustomStickers(loadCustomStickers());
    setFavoriteIds(loadFavoriteIds());
    setRecentIds(loadRecentIds());
  }, []);

  useEffect(() => {
    refreshStickerState();
  }, [refreshStickerState, pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) setMediaSearch('');
  }, [pickerOpen]);

  useEffect(() => {
    setMediaSearch('');
  }, [tab]);

  useEffect(() => {
    if (!pickerOpen || tab !== 'gif') return;
    if (!searchGifs && !loadFeaturedGifs) {
      setRemoteGifs([]);
      setGifError(null);
      setGifLoading(false);
      return;
    }

    const req = ++gifReqId.current;
    const q = mediaSearch.trim();
    const handle = window.setTimeout(() => {
      setGifLoading(true);
      setGifError(null);
      void (async () => {
        try {
          const list = q
            ? await (searchGifs?.(q) ?? Promise.resolve([]))
            : await (loadFeaturedGifs?.() ?? searchGifs?.('') ?? Promise.resolve([]));
          if (gifReqId.current !== req) return;
          setRemoteGifs(list);
        } catch (err) {
          if (gifReqId.current !== req) return;
          setRemoteGifs([]);
          setGifError(err instanceof Error ? err.message : 'GIF araması başarısız');
        } finally {
          if (gifReqId.current === req) setGifLoading(false);
        }
      })();
    }, q ? 350 : 0);

    return () => window.clearTimeout(handle);
  }, [pickerOpen, tab, mediaSearch, searchGifs, loadFeaturedGifs]);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend?.(trimmed, replyTo ? { replyToId: replyTo.id } : undefined);
    setValue('');
    setPickerOpen(false);
    setMention(null);
    onCancelReply?.();
    requestAnimationFrame(() => resizeTextarea());
  }, [value, disabled, onSend, replyTo, onCancelReply, resizeTextarea]);

  const mentionUserOptions = useMemo(() => {
    const q = (mention?.kind === 'user' ? mention.query : '').toLowerCase();
    const specials = [
      { id: '__everyone', username: 'everyone', displayName: '@everyone', avatarUrl: null as string | null },
      { id: '__all', username: 'all', displayName: '@all', avatarUrl: null as string | null },
    ].filter(
      (s) =>
        !q ||
        s.username.includes(q) ||
        s.displayName.toLowerCase().includes(q),
    );
    const users = mentionUsers.filter((u) => {
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q)
      );
    });
    return [...specials, ...users].slice(0, 12);
  }, [mention, mentionUsers]);

  const mentionChannelOptions = useMemo(() => {
    const q = (mention?.kind === 'channel' ? mention.query : '').toLowerCase();
    return mentionChannels
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [mention, mentionChannels]);

  const slashOptions = useMemo(() => {
    if (mention?.kind !== 'slash') return [] as BotSlashCommand[];
    return filterBotSlashCommands(mention.query).slice(0, 10);
  }, [mention]);

  const mentionOptionsCount =
    mention?.kind === 'user'
      ? mentionUserOptions.length
      : mention?.kind === 'channel'
        ? mentionChannelOptions.length
        : slashOptions.length;

  useEffect(() => {
    setMentionIndex(0);
  }, [mention?.kind, mention?.query]);

  const insertMention = useCallback(
    (token: string) => {
      if (!mention) return;
      const before = value.slice(0, mention.start);
      const after = value.slice(mention.start + 1 + mention.query.length);
      const spacer = mention.kind === 'slash' && !token.endsWith(' ') ? ' ' : ' ';
      const next = `${before}${token}${spacer}${after.replace(/^\s*/, '')}`;
      setValue(next);
      setMention(null);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        const pos = before.length + token.length + spacer.length;
        el.focus();
        el.setSelectionRange(pos, pos);
        resizeTextarea();
      });
    },
    [mention, value, resizeTextarea],
  );

  const syncMentionFromCaret = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const trigger = detectMentionTrigger(el.value, el.selectionStart ?? el.value.length);
    setMention(trigger);
  }, []);

  const highlightNames = useMemo(
    () => [
      'everyone',
      'all',
      ...mentionUsers.map((u) => u.username),
      ...mentionUsers.map((u) => u.displayName),
    ],
    [mentionUsers],
  );
  const highlightChannels = useMemo(
    () => mentionChannels.map((c) => c.name),
    [mentionChannels],
  );

  const highlightNodes = useMemo((): ReactNode => {
    if (!value) return '\u00a0';
    const tokens = tokenizeMessageContent(value, {
      mentionNames: highlightNames,
      channelNames: highlightChannels,
    });
    return tokens.map((t, i) => {
      if (t.type === 'mention' || t.type === 'channel') {
        // px ekleme — textarea caret ile görsel metin kayar
        return (
          <span key={i} className="text-primary-container bg-primary-container/25 rounded-[2px]">
            {t.value}
          </span>
        );
      }
      if (t.type === 'slash') {
        return (
          <span key={i} className="text-secondary-container bg-secondary-container/25 rounded-[2px]">
            {t.value}
          </span>
        );
      }
      if (t.type === 'url') {
        return (
          <span key={i} className="text-primary-container underline underline-offset-2">
            {t.value}
          </span>
        );
      }
      return <span key={i}>{t.value}</span>;
    });
  }, [value, highlightNames, highlightChannels]);

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && mentionOptionsCount > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionOptionsCount);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionOptionsCount) % mentionOptionsCount);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (mention.kind === 'user') {
          const opt = mentionUserOptions[mentionIndex];
          if (opt) insertMention(`@${opt.username}`);
        } else if (mention.kind === 'channel') {
          const opt = mentionChannelOptions[mentionIndex];
          if (opt) insertMention(`#${opt.name}`);
        } else if (mention.kind === 'slash') {
          const opt = slashOptions[mentionIndex];
          if (opt) insertMention(`/${opt.name}${opt.argRequired ? ' ' : ''}`);
        }
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  useEffect(() => {
    if (!attachOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!attachRef.current?.contains(e.target as Node)) setAttachOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [attachOpen]);

  useLayoutEffect(() => {
    if (!pickerOpen && !mention) {
      setPickerBox(null);
      return;
    }
    const update = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pad = 12;
      const maxW = 448;
      setPickerBox({
        bottom: Math.max(8, window.innerHeight - rect.top + 8),
        left: Math.max(8, rect.left + pad),
        width: Math.min(maxW, Math.max(240, rect.width - pad * 2)),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [pickerOpen, mention, expanded, replyTo]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (pickerPanelRef.current?.contains(t)) return;
      setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  const handleFiles = (list: FileList | File[] | null) => {
    if (!list || (Array.isArray(list) ? list.length === 0 : list.length === 0)) return;
    const files = Array.isArray(list) ? list : Array.from(list);
    if (!files.length) return;
    onAttachFiles?.(files);
    setAttachOpen(false);
    setAttachDragging(false);
  };

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes('Files')) setDragging(true);
  };
  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const sendStoredSticker = (sticker: StoredSticker) => {
    setRecentIds(pushRecentId(sticker.id));
    if (sticker.kind === 'emoji') {
      onSendMedia?.({ type: 'sticker', emoji: sticker.value });
    } else {
      onSendMedia?.({
        type: 'sticker-image',
        url: sticker.value,
        label: sticker.label,
        contentType: sticker.contentType,
      });
    }
    setPickerOpen(false);
  };

  const pickGif = (item: MediaPackItem | GifSearchResult) => {
    const url = 'value' in item ? item.value : item.url;
    onSendMedia?.({ type: 'gif', url, label: item.label });
    setPickerOpen(false);
  };

  const displayedGifs = useMemo(() => {
    if (searchGifs || loadFeaturedGifs) {
      return remoteGifs.map(
        (g): MediaPackItem & { previewUrl?: string } => ({
          id: g.id,
          label: g.label,
          value: g.url,
          kind: 'gif',
          preview: g.previewUrl,
        }),
      );
    }
    return CURATED_GIFS.filter((g) => mediaItemMatchesQuery(g, mediaSearch));
  }, [searchGifs, loadFeaturedGifs, remoteGifs, mediaSearch]);

  const pickPackSticker = (packId: string, item: MediaPackItem) => {
    const id = packStickerId(packId, item.id);
    setRecentIds(pushRecentId(id));
    if (isMediaUrl(item.value)) {
      onSendMedia?.({
        type: 'sticker-image',
        url: item.value,
        label: item.label,
        contentType: 'image/gif',
      });
    } else {
      onSendMedia?.({ type: 'sticker', emoji: item.value });
    }
    setPickerOpen(false);
  };

  const onCreateSticker = async (file: File | null) => {
    if (!file) return;
    setStickerError(null);
    try {
      const draft = await readImageFileAsSticker(file);
      addCustomSticker(draft);
      refreshStickerState();
      setStickerSection('mine');
    } catch (err) {
      setStickerError(err instanceof Error ? err.message : 'Sticker eklenemedi');
    }
  };

  const activeEmojis = useMemo(() => {
    const q = mediaSearch.trim();
    if (q) {
      return EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((emoji) =>
        emojiMatchesQuery(emoji, q),
      );
    }
    return EMOJI_CATEGORIES.find((c) => c.id === emojiCat)?.emojis ?? EMOJI_CATEGORIES[0]!.emojis;
  }, [mediaSearch, emojiCat]);

  const recentStickers = useMemo(    () =>
      recentIds
        .map((id) => resolveStickerById(id, customStickers))
        .filter((s): s is StoredSticker => Boolean(s))
        .filter((s) => mediaItemMatchesQuery(s, mediaSearch)),
    [recentIds, customStickers, mediaSearch],
  );

  const favoriteStickers = useMemo(
    () =>
      favoriteIds
        .map((id) => resolveStickerById(id, customStickers))
        .filter((s): s is StoredSticker => Boolean(s))
        .filter((s) => mediaItemMatchesQuery(s, mediaSearch)),
    [favoriteIds, customStickers, mediaSearch],
  );

  const filteredCustomStickers = useMemo(
    () => customStickers.filter((s) => mediaItemMatchesQuery(s, mediaSearch)),
    [customStickers, mediaSearch],
  );
  const renderStickerTile = (sticker: StoredSticker, opts?: { showDelete?: boolean }) => {
    const fav = favoriteIds.includes(sticker.id);
    return (
      <div key={sticker.id} className="relative group aspect-square">
        <button
          type="button"
          onClick={() => sendStoredSticker(sticker)}
          className="w-full h-full rounded-xl bg-surface-container-lowest hover:bg-surface-bright flex items-center justify-center overflow-hidden"
          title={sticker.label}
        >
          {sticker.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sticker.value} alt={sticker.label} className="w-full h-full object-contain" />
          ) : (
            <span className="text-3xl leading-none">{sticker.value}</span>
          )}
        </button>
        <button
          type="button"
          className={cn(
            'absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[12px] opacity-0 group-hover:opacity-100 transition-opacity',
            fav ? 'bg-primary-container text-on-primary-container opacity-100' : 'bg-black/50 text-white',
          )}
          aria-label={fav ? 'Favoriden çıkar' : 'Favorilere ekle'}
          onClick={(e) => {
            e.stopPropagation();
            setFavoriteIds(toggleFavoriteId(sticker.id));
          }}
        >
          <span
            className="material-symbols-outlined leading-none"
            style={{ fontSize: 12, fontVariationSettings: fav ? "'FILL' 1" : "'FILL' 0" }}
          >
            star
          </span>
        </button>
        {opts?.showDelete && (
          <button
            type="button"
            className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
            aria-label="Sticker sil"
            onClick={(e) => {
              e.stopPropagation();
              removeCustomSticker(sticker.id);
              refreshStickerState();
            }}
          >
            <span className="material-symbols-outlined leading-none" style={{ fontSize: 12 }}>
              close
            </span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        'px-space-md flex flex-col shrink-0 relative box-border',
        expanded || replyTo ? 'min-h-16 justify-end py-2' : 'h-16 justify-center',
        (pickerOpen || attachOpen || mention) && 'z-[90]',
        className,
      )}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="absolute inset-1 z-30 rounded-xl border-2 border-dashed border-primary-container bg-primary-container/10 flex items-center justify-center pointer-events-none">
          <p className="font-headline-md text-primary-container">Dosyaları buraya bırak (çoklu)</p>
        </div>
      )}

      {replyTo && (
        <div className="mb-1.5 mx-0 flex items-center gap-2 rounded-lg bg-surface-container-high border-l-4 border-primary-container px-3 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="font-label-sm text-primary-container truncate">
              {replyTo.authorName} yanıtlanıyor
            </p>
            <p className="font-body-sm text-outline truncate text-[12px]">{replyTo.contentPreview}</p>
          </div>
          <button
            type="button"
            onClick={() => onCancelReply?.()}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-outline hover:bg-surface-bright"
            aria-label="Yanıtı iptal et"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {pickerOpen &&
        pickerBox &&
        typeof document !== 'undefined' &&
        createPortal(
        <div
          ref={pickerPanelRef}
          className="fixed z-[200] max-w-md rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float overflow-hidden isolate"
          style={{
            bottom: pickerBox.bottom,
            left: pickerBox.left,
            width: pickerBox.width,
          }}
        >
          <div className="flex border-b border-surface-container-highest">
            {(
              [
                ['emoji', 'Emoji'],
                ['gif', 'GIF'],
                ['sticker', 'Sticker'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'flex-1 h-10 font-label-md text-label-md transition-colors',
                  tab === id
                    ? 'text-primary-container border-b-2 border-primary-container'
                    : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="px-space-sm py-space-xs border-b border-surface-container-highest">
            <div className="flex items-center gap-space-xs h-9 px-space-sm rounded-lg bg-surface-container-lowest">
              <span className="material-symbols-outlined text-[18px] text-outline leading-none">
                search
              </span>
              <input
                value={mediaSearch}
                onChange={(e) => setMediaSearch(e.target.value)}
                placeholder={
                  tab === 'emoji'
                    ? 'Emoji ara (mutlu, kalp…)'
                    : tab === 'gif'
                      ? 'Klipy’de GIF ara…'
                      : 'Sticker ara…'
                }
                className="flex-1 bg-transparent outline-none font-body-sm text-on-surface placeholder:text-outline min-w-0"
              />
              {mediaSearch && (
                <button
                  type="button"
                  className="text-outline hover:text-on-surface"
                  aria-label="Aramayı temizle"
                  onClick={() => setMediaSearch('')}
                >
                  <span className="material-symbols-outlined text-[16px] leading-none">close</span>
                </button>
              )}
            </div>
          </div>

          {tab === 'emoji' && (
            <div className="flex flex-col max-h-64">
              {!mediaSearch.trim() && (
                <div className="flex gap-1 px-space-sm py-space-xs overflow-x-auto overflow-y-hidden shrink-0 border-b border-surface-container-highest [scrollbar-width:thin] [-ms-overflow-style:auto]">
                  {EMOJI_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEmojiCat(c.id)}
                      className={cn(
                        'h-7 px-space-sm rounded-full font-label-sm whitespace-nowrap shrink-0',
                        emojiCat === c.id
                          ? 'bg-primary-container text-on-primary-container'
                          : 'text-on-surface-variant hover:bg-surface-bright',
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="p-space-sm overflow-y-auto max-h-52 grid grid-cols-8 gap-1">
                {activeEmojis.length === 0 ? (
                  <p className="col-span-8 font-label-sm text-outline text-center py-space-md">
                    Sonuç bulunamadı
                  </p>
                ) : (
                  activeEmojis.map((emoji) => (
                    <button
                      key={emoji + (mediaSearch || emojiCat)}
                      type="button"
                      className="h-9 w-9 flex items-center justify-center rounded hover:bg-surface-bright text-xl"
                      onClick={() => {
                        setValue((v) => v + emoji);
                        onEmojiClick?.();
                      }}
                    >
                      {emoji}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'gif' && (
            <div className="p-space-sm max-h-64 overflow-y-auto">
              {(searchGifs || loadFeaturedGifs) && (
                <p className="font-label-sm text-outline mb-space-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] leading-none">gif_box</span>
                  Klipy
                  {!mediaSearch.trim() && ' · Öne çıkanlar'}
                </p>
              )}
              {gifLoading && (
                <p className="font-label-sm text-outline text-center py-space-md">Aranıyor…</p>
              )}
              {!gifLoading && gifError && (
                <div className="space-y-space-sm">
                  <p className="font-label-sm text-error text-center">{gifError}</p>
                  <div className="grid grid-cols-3 gap-space-sm">
                    {CURATED_GIFS.filter((g) => mediaItemMatchesQuery(g, mediaSearch)).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => pickGif(g)}
                        className="aspect-square rounded-lg overflow-hidden bg-surface-container-lowest hover:ring-2 ring-primary-container"
                        title={g.label}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.value} alt={g.label} className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!gifLoading && !gifError && displayedGifs.length === 0 ? (
                <p className="font-label-sm text-outline text-center py-space-md">Sonuç bulunamadı</p>
              ) : null}
              {!gifLoading && !gifError && displayedGifs.length > 0 && (
                <div className="grid grid-cols-3 gap-space-sm">
                  {displayedGifs.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => pickGif(g)}
                      className="aspect-square rounded-lg overflow-hidden bg-surface-container-lowest hover:ring-2 ring-primary-container relative group"
                      title={g.label}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.preview || g.value}
                        alt={g.label}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <span
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
                        title="Sticker olarak kaydet"
                        onClick={(e) => {
                          e.stopPropagation();
                          addCustomSticker({
                            kind: 'image',
                            value: g.value,
                            label: g.label,
                            contentType: 'image/gif',
                          });
                          refreshStickerState();
                          setTab('sticker');
                          setStickerSection('mine');
                        }}
                        role="button"
                      >
                        <span className="material-symbols-outlined leading-none" style={{ fontSize: 14 }}>
                          add
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'sticker' && (
            <div className="flex flex-col max-h-72">
              <div className="flex gap-1 px-space-sm py-space-xs overflow-x-auto overflow-y-hidden shrink-0 border-b border-surface-container-highest items-center [scrollbar-width:thin]">
                {(
                  [
                    ['recent', 'Son'],
                    ['favorites', 'Favoriler'],
                    ['mine', 'Benimkiler'],
                    ['packs', 'Paketler'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStickerSection(id)}
                    className={cn(
                      'h-7 px-space-sm rounded-full font-label-sm whitespace-nowrap shrink-0',
                      stickerSection === id
                        ? 'bg-primary-container text-on-primary-container'
                        : 'text-on-surface-variant hover:bg-surface-bright',
                    )}
                  >
                    {label}
                  </button>
                ))}
                <input
                  ref={stickerFileRef}
                  type="file"
                  accept="image/*,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    void onCreateSticker(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="ml-auto h-7 px-space-sm rounded-full bg-surface-container-highest font-label-sm text-on-surface hover:bg-surface-bright flex items-center gap-1"
                  onClick={() => stickerFileRef.current?.click()}
                >
                  <span className="material-symbols-outlined leading-none" style={{ fontSize: 14 }}>
                    add_photo_alternate
                  </span>
                  Oluştur
                </button>
                <button
                  type="button"
                  className="h-7 px-space-sm rounded-full bg-surface-container-highest font-label-sm text-on-surface hover:bg-surface-bright flex items-center gap-1"
                  onClick={() => setVideoTrimmerOpen(true)}
                  title="Videodan sticker (max 15 sn)"
                >
                  <span className="material-symbols-outlined leading-none" style={{ fontSize: 14 }}>
                    movie
                  </span>
                  Video
                </button>
              </div>
              {stickerError && (
                <p className="px-space-sm pt-space-xs font-label-sm text-error">{stickerError}</p>
              )}
              <div className="p-space-sm overflow-y-auto space-y-space-md">
                {stickerSection === 'recent' && (
                  recentStickers.length === 0 ? (
                    <p className="font-label-sm text-outline text-center py-space-md">
                      Henüz kullanılan sticker yok
                    </p>
                  ) : (
                    <div className="grid grid-cols-6 gap-space-sm">
                      {recentStickers.map((s) => renderStickerTile(s))}
                    </div>
                  )
                )}
                {stickerSection === 'favorites' && (
                  favoriteStickers.length === 0 ? (
                    <p className="font-label-sm text-outline text-center py-space-md">
                      Favori sticker eklemek için yıldızla
                    </p>
                  ) : (
                    <div className="grid grid-cols-6 gap-space-sm">
                      {favoriteStickers.map((s) => renderStickerTile(s))}
                    </div>
                  )
                )}
                {stickerSection === 'mine' && (
                  filteredCustomStickers.length === 0 ? (
                    <p className="font-label-sm text-outline text-center py-space-md">
                      {mediaSearch.trim()
                        ? 'Sonuç bulunamadı'
                        : 'GIF veya görsel yükleyerek sticker oluştur'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-6 gap-space-sm">
                      {filteredCustomStickers.map((s) => renderStickerTile(s, { showDelete: true }))}                    </div>
                  )
                )}
                {stickerSection === 'packs' &&
                  STICKER_PACKS.map((pack) => {
                    const stickers = pack.stickers.filter((s) =>
                      mediaItemMatchesQuery(s, mediaSearch),
                    );
                    if (stickers.length === 0) return null;
                    return (
                    <div key={pack.id}>
                      <p className="font-label-sm text-outline mb-space-xs px-1">{pack.label}</p>
                      <div className="grid grid-cols-6 gap-space-sm">
                        {stickers.map((s) => {
                          const id = packStickerId(pack.id, s.id);
                          const image = isMediaUrl(s.value);
                          const asStored: StoredSticker = {
                            id,
                            kind: image ? 'image' : 'emoji',
                            value: s.value,
                            label: s.label,
                            contentType: image ? 'image/gif' : undefined,
                            createdAt: 0,
                          };
                          return (
                            <div key={s.id} className="relative group aspect-square">
                              <button
                                type="button"
                                onClick={() => pickPackSticker(pack.id, s)}
                                className="w-full h-full rounded-xl bg-surface-container-lowest hover:bg-surface-bright flex items-center justify-center overflow-hidden"
                                title={s.label}
                              >
                                {image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={s.preview || s.value}
                                    alt={s.label}
                                    className="w-full h-full object-contain"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="text-3xl leading-none">{s.value}</span>
                                )}
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  'absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100',
                                  favoriteIds.includes(id)
                                    ? 'bg-primary-container text-on-primary-container opacity-100'
                                    : 'bg-black/50 text-white',
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFavoriteIds(toggleFavoriteId(asStored.id));
                                }}
                              >
                                <span
                                  className="material-symbols-outlined leading-none"
                                  style={{
                                    fontSize: 12,
                                    fontVariationSettings: favoriteIds.includes(id)
                                      ? "'FILL' 1"
                                      : "'FILL' 0",
                                  }}
                                >
                                  star
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}              </div>
            </div>
          )}
        </div>,
        document.body,
      )}

      {mention && mentionOptionsCount > 0 &&
        pickerBox &&
        typeof document !== 'undefined' &&
        createPortal(
        <div
          ref={mentionPanelRef}
          className="fixed z-[200] max-w-sm rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float overflow-hidden"
          style={{
            bottom: pickerBox.bottom,
            left: pickerBox.left,
            width: Math.min(pickerBox.width, 384),
          }}
        >
          <div className="px-space-sm py-space-xs border-b border-surface-container-highest flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[16px] text-outline leading-none">
              {mention.kind === 'slash' ? 'smart_toy' : 'search'}
            </span>
            <span className="font-label-sm text-outline truncate">
              {mention.kind === 'user'
                ? 'Kullanıcı etiketle'
                : mention.kind === 'channel'
                  ? 'Kanal etiketle'
                  : 'Bot komutları'}{' '}
              · {mention.query || '…'}
            </span>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {mention.kind === 'user'
              ? mentionUserOptions.map((u, i) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className={cn(
                        'w-full flex items-center gap-space-sm px-space-sm py-2 text-left',
                        i === mentionIndex
                          ? 'bg-primary-container/20 text-on-surface'
                          : 'hover:bg-surface-bright text-on-surface',
                      )}
                      onMouseEnter={() => setMentionIndex(i)}
                      onClick={() => insertMention(`@${u.username}`)}
                    >
                      {u.id.startsWith('__') ? (
                        <span className="w-8 h-8 shrink-0 rounded-full bg-primary-container/25 text-primary-container inline-flex items-center justify-center">
                          <span
                            className="material-symbols-outlined leading-none"
                            style={{ fontSize: 18 }}
                          >
                            groups
                          </span>
                        </span>
                      ) : (
                        <Avatar
                          displayName={u.displayName}
                          imageUrl={u.avatarUrl}
                          size="md"
                          statusRing={false}
                          className="shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1 flex flex-col justify-center leading-tight">
                        <p className="font-label-md truncate">{u.displayName}</p>
                        {!u.id.startsWith('__') && (
                          <p className="font-label-sm text-outline truncate">@{u.username}</p>
                        )}
                      </div>
                    </button>
                  </li>
                ))
              : mention.kind === 'channel'
                ? mentionChannelOptions.map((c, i) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={cn(
                          'w-full flex items-center gap-space-sm px-space-sm py-2 text-left',
                          i === mentionIndex
                            ? 'bg-primary-container/20 text-on-surface'
                            : 'hover:bg-surface-bright text-on-surface',
                        )}
                        onMouseEnter={() => setMentionIndex(i)}
                        onClick={() => insertMention(`#${c.name}`)}
                      >
                        <span className="w-8 h-8 shrink-0 rounded-lg bg-surface-container-lowest text-outline inline-flex items-center justify-center">
                          <span className="font-headline-md leading-none">#</span>
                        </span>
                        <span className="font-label-md truncate self-center">{c.name}</span>
                      </button>
                    </li>
                  ))
                : slashOptions.map((c, i) => (
                    <li key={c.name}>
                      <button
                        type="button"
                        className={cn(
                          'w-full flex items-start gap-space-sm px-space-sm py-2 text-left',
                          i === mentionIndex
                            ? 'bg-primary-container/20 text-on-surface'
                            : 'hover:bg-surface-bright text-on-surface',
                        )}
                        onMouseEnter={() => setMentionIndex(i)}
                        onClick={() =>
                          insertMention(`/${c.name}${c.argRequired ? ' ' : ''}`)
                        }
                      >
                        <span className="w-8 h-8 shrink-0 rounded-lg bg-secondary-container/25 text-secondary-container inline-flex items-center justify-center mt-0.5">
                          <span className="font-label-md">/</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-label-md truncate">
                            /{c.name}
                            {c.aliases?.length ? (
                              <span className="text-outline font-label-sm">
                                {' '}
                                · {c.aliases.map((a) => `/${a}`).join(' ')}
                              </span>
                            ) : null}
                          </p>
                          <p className="font-label-sm text-outline truncate">{c.description}</p>
                          <p className="font-label-sm text-outline/80 truncate">{c.usage}</p>
                        </div>
                      </button>
                    </li>
                  ))}
          </ul>
        </div>,
        document.body,
      )}

      <div
        className={cn(
          'flex gap-space-xs w-full bg-dracula-current rounded-lg px-space-sm',
          expanded ? 'items-end py-1.5 min-h-[44px]' : 'items-center h-11',
        )}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div ref={attachRef} className="relative shrink-0">
          <button
            type="button"
            data-attach-trigger
            onClick={() => {
              onAttachClick?.();
              setAttachOpen((v) => !v);
              setPickerOpen(false);
            }}
            className={cn(
              'h-9 w-9 flex items-center justify-center rounded-lg transition-colors duration-200',
              attachOpen
                ? 'text-primary-container bg-surface-container'
                : 'text-outline hover:text-primary-container hover:bg-surface-container',
            )}
            aria-label="Ekle"
            aria-expanded={attachOpen}
          >
            <span className="material-symbols-outlined text-[22px] leading-none">add_circle</span>
          </button>
          {attachOpen && (
            <div className="absolute bottom-full left-0 mb-2 z-40 w-72 rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float overflow-hidden">
              <div className="p-2 flex flex-col gap-0.5">
                {onHeadingClick && (
                  <button
                    type="button"
                    onClick={() => {
                      setAttachOpen(false);
                      onHeadingClick();
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[22px] text-primary-container leading-none">
                      title
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="font-label-md text-on-surface">Bölüm başlığı</span>
                      <span className="font-body-sm text-outline text-[12px]">
                        Sohbette görsel bölüm ayırıcı
                      </span>
                    </span>
                  </button>
                )}
                {onPollClick && (
                  <button
                    type="button"
                    onClick={() => {
                      setAttachOpen(false);
                      onPollClick();
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left hover:bg-surface-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[22px] text-primary-container leading-none">
                      ballot
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="font-label-md text-on-surface">Anket oluştur</span>
                      <span className="font-body-sm text-outline text-[12px]">
                        Seçenekli oylama başlat
                      </span>
                    </span>
                  </button>
                )}
              </div>
              <button
                type="button"
                className={cn(
                  'mx-2 mb-2 w-[calc(100%-1rem)] rounded-lg border-2 border-dashed px-3 py-5 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer',
                  attachDragging
                    ? 'border-primary-container bg-primary-container/10 text-primary-container'
                    : 'border-surface-container-highest text-outline hover:border-primary-container/50',
                )}
                onClick={() => fileRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  attachDragDepth.current += 1;
                  if (e.dataTransfer.types.includes('Files')) setAttachDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  attachDragDepth.current = Math.max(0, attachDragDepth.current - 1);
                  if (attachDragDepth.current === 0) setAttachDragging(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  attachDragDepth.current = 0;
                  setAttachDragging(false);
                  handleFiles(e.dataTransfer.files);
                }}
              >
                <span className="material-symbols-outlined text-[28px] leading-none">
                  {attachDragging ? 'file_download' : 'upload_file'}
                </span>
                <p className="font-label-md text-center">
                  {attachDragging ? 'Bırak — yüklenecek' : 'Dosyaları sürükle veya tıkla'}
                </p>
                <p className="font-body-sm text-[11px] text-center opacity-80">
                  Çoklu dosya desteklenir
                </p>
              </button>
            </div>
          )}
        </div>
        <div className="relative flex-1 min-w-0">
          {/* Overlay ve textarea aynı tipografi/genişlik — scrollbar farkı caret kaydırır */}
          <div
            aria-hidden
            id="chat-input-highlight"
            className="pointer-events-none absolute inset-0 overflow-y-auto font-body-md text-body-md leading-6 whitespace-pre-wrap break-words text-dracula-fg [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ maxHeight: MAX_TEXTAREA_PX }}
          >
            {highlightNodes}
            {value.endsWith('\n') ? '\n' : null}
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              const caret = e.target.selectionStart ?? e.target.value.length;
              setMention(detectMentionTrigger(e.target.value, caret));
            }}
            onClick={syncMentionFromCaret}
            onKeyUp={syncMentionFromCaret}
            onSelect={syncMentionFromCaret}
            onScroll={(e) => {
              const mirror = document.getElementById('chat-input-highlight');
              if (mirror) mirror.scrollTop = e.currentTarget.scrollTop;
            }}
            onKeyDown={onComposerKeyDown}
            disabled={disabled}
            spellCheck={spellCheck}
            rows={1}
            placeholder={resolvedPlaceholder}
            className="relative block w-full m-0 border-0 bg-transparent placeholder:text-dracula-comment font-body-md text-body-md leading-6 resize-none outline-none overflow-y-auto whitespace-pre-wrap break-words min-h-[24px] text-transparent [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{
              maxHeight: MAX_TEXTAREA_PX,
              caretColor: '#f8f8f2',
              padding: 0,
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setPickerOpen((v) => !v);
            setAttachOpen(false);
          }}
          className={cn(
            'h-9 w-9 shrink-0 flex items-center justify-center rounded-lg transition-colors duration-200',
            pickerOpen
              ? 'text-primary-container bg-surface-container'
              : 'text-outline hover:text-primary-container hover:bg-surface-container',
          )}
          aria-label="Emoji, GIF ve sticker"
        >
          <span className="material-symbols-outlined text-[22px] leading-none">sentiment_satisfied</span>
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className={cn(
            'h-9 w-9 shrink-0 flex items-center justify-center rounded-lg transition-colors duration-200',
            value.trim()
              ? 'bg-primary-container text-on-primary-container hover:bg-primary'
              : 'text-outline cursor-not-allowed',
          )}
          aria-label="Gönder"
        >
          <span className="material-symbols-outlined text-[22px] leading-none">send</span>
        </button>
      </div>
      <VideoStickerTrimmer
        open={videoTrimmerOpen}
        onClose={() => setVideoTrimmerOpen(false)}
        onSaved={async ({ dataUrl, blob, label, contentType }) => {
          try {
            let value = dataUrl;
            if (uploadStickerFile) {
              const file = new File([blob], `${label || 'sticker'}.gif`, {
                type: contentType || 'image/gif',
              });
              const uploaded = await uploadStickerFile(file);
              value = uploaded.url;
            }
            addCustomSticker({
              kind: 'image',
              value,
              label: label || 'Video sticker',
              contentType: contentType || 'image/gif',
            });
            refreshStickerState();
            setStickerSection('mine');
            setTab('sticker');
            setPickerOpen(true);
          } catch (err) {
            setStickerError(err instanceof Error ? err.message : 'Sticker kaydedilemedi');
          }
        }}
      />
    </div>
  );
}
