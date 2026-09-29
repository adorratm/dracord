'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { cn } from '../lib/cn';
import {
  CURATED_GIFS,
  EMOJI_CATEGORIES,
  STICKER_PACKS,
  emojiMatchesQuery,
  mediaItemMatchesQuery,
  type MediaPackItem,
} from '../lib/media-packs';
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

export interface ChatInputProps {
  channelName?: string;
  placeholder?: string;
  disabled?: boolean;
  onSend?: (text: string) => void;
  onSendMedia?: (payload: ChatMediaPayload) => void;
  onEmojiClick?: () => void;
  onAttachClick?: () => void;
  onAttachFiles?: (files: FileList | File[]) => void;
  /** Tenor / harici GIF araması. Verilmezse yerel liste kullanılır. */
  searchGifs?: (query: string) => Promise<GifSearchResult[]>;
  loadFeaturedGifs?: () => Promise<GifSearchResult[]>;
  className?: string;
}

type PickerTab = 'emoji' | 'gif' | 'sticker';
type StickerSection = 'recent' | 'favorites' | 'mine' | 'packs';

function packStickerId(packId: string, stickerId: string) {
  return `pack:${packId}:${stickerId}`;
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
        return {
          id,
          kind: 'emoji',
          value: s.value,
          label: s.label,
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
  searchGifs,
  loadFeaturedGifs,
  className,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tab, setTab] = useState<PickerTab>('emoji');
  const [emojiCat, setEmojiCat] = useState(EMOJI_CATEGORIES[0]!.id);
  const [stickerSection, setStickerSection] = useState<StickerSection>('recent');
  const [customStickers, setCustomStickers] = useState<StoredSticker[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [stickerError, setStickerError] = useState<string | null>(null);
  const [mediaSearch, setMediaSearch] = useState('');
  const [remoteGifs, setRemoteGifs] = useState<GifSearchResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const stickerFileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);
  const gifReqId = useRef(0);

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
    onSend?.(trimmed);
    setValue('');
    setPickerOpen(false);
  }, [value, disabled, onSend]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  const handleFiles = (list: FileList | File[] | null) => {
    if (!list || (Array.isArray(list) ? list.length === 0 : list.length === 0)) return;
    onAttachFiles?.(list);
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
    onSendMedia?.({ type: 'sticker', emoji: item.value });
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
      className={cn('px-space-md pb-space-md pt-space-sm shrink-0 relative', className)}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="absolute inset-space-sm z-30 rounded-xl border-2 border-dashed border-primary-container bg-primary-container/10 flex items-center justify-center pointer-events-none">
          <p className="font-headline-md text-primary-container">Dosyaları buraya bırak</p>
        </div>
      )}

      {pickerOpen && (
        <div className="absolute bottom-full left-space-md right-space-md mb-2 z-20 max-w-md rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float overflow-hidden">
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
                <div className="flex gap-1 px-space-sm py-space-xs overflow-x-auto border-b border-surface-container-highest">
                  {EMOJI_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setEmojiCat(c.id)}
                      className={cn(
                        'h-7 px-space-sm rounded-full font-label-sm whitespace-nowrap',
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
              <div className="p-space-sm overflow-y-auto grid grid-cols-8 gap-1">
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
              <div className="flex gap-1 px-space-sm py-space-xs overflow-x-auto border-b border-surface-container-highest items-center">
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
                      'h-7 px-space-sm rounded-full font-label-sm whitespace-nowrap',
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
                          const asStored: StoredSticker = {
                            id,
                            kind: 'emoji',
                            value: s.value,
                            label: s.label,
                            createdAt: 0,
                          };
                          return (
                            <div key={s.id} className="relative group aspect-square">
                              <button
                                type="button"
                                onClick={() => pickPackSticker(pack.id, s)}
                                className="w-full h-full rounded-xl bg-surface-container-lowest hover:bg-surface-bright flex items-center justify-center text-3xl"
                                title={s.label}
                              >
                                {s.value}
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
        </div>
      )}

      <div className="flex items-center gap-space-sm bg-dracula-current rounded-lg px-space-md min-h-[44px]">
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
        <button
          type="button"
          onClick={() => {
            onAttachClick?.();
            fileRef.current?.click();
          }}
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-outline hover:text-primary-container hover:bg-surface-container transition-colors duration-200"
          aria-label="Dosya ekle"
        >
          <span className="material-symbols-outlined text-[22px] leading-none">add_circle</span>
        </button>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
          rows={1}
          placeholder={resolvedPlaceholder}
          className="flex-1 bg-transparent text-dracula-fg placeholder:text-dracula-comment font-body-md text-body-md resize-none outline-none min-h-[24px] max-h-40 py-2.5 leading-6 self-center"
        />
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
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
    </div>
  );
}
