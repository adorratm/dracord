'use client';

import type { PresenceStatus } from '@dracord/types';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';
import { presenceDotClass, presenceLabelTr } from '../lib/presence';

export type SidebarChannelType = 'text' | 'voice';

export interface SidebarVoiceMember {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  muted?: boolean;
  deafened?: boolean;
  speaking?: boolean;
}

export interface SidebarCategory {
  id: string;
  label: string;
  collapsed?: boolean;
  onToggle?: () => void;
  onAddChannel?: () => void;
  channels: SidebarChannelItem[];
}

export interface SidebarChannelItem {
  id: string;
  name: string;
  type: SidebarChannelType;
  active?: boolean;
  unread?: boolean;
  badgeCount?: number;
  memberCount?: string;
  voiceMembers?: SidebarVoiceMember[];
  onClick?: () => void;
  onContextMenu?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export interface UserPanelProps {
  displayName: string;
  avatarUrl?: string | null;
  status?: PresenceStatus;
  customStatus?: string | null;
  muted?: boolean;
  deafened?: boolean;
  noiseCancellation?: boolean;
  noiseNote?: string | null;
  voiceConnected?: boolean;
  voiceChannelName?: string | null;
  onProfileClick?: () => void;
  onStatusChange?: (status: PresenceStatus, customStatus?: string | null) => void;
  onMicClick?: () => void;
  onHeadphonesClick?: () => void;
  onNoiseClick?: () => void;
  onSettingsClick?: () => void;
  onVoiceReturnClick?: () => void;
  onVoiceDisconnectClick?: () => void;
}

function HeadphonesIcon({ deafened, size = 18 }: { deafened?: boolean; size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="material-symbols-outlined leading-none"
        style={{ fontSize: size, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
      >
        headphones
      </span>
      {deafened && (
        <span
          className="absolute left-1/2 top-1/2 block w-[120%] h-[2px] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg] rounded-full bg-current"
          style={{ boxShadow: '0 0 0 1px color-mix(in srgb, currentColor 20%, transparent)' }}
        />
      )}
    </span>
  );
}

export function UserPanel({
  displayName,
  avatarUrl,
  status = 'ONLINE',
  customStatus = null,
  muted,
  deafened,
  noiseCancellation,
  noiseNote,
  voiceConnected,
  voiceChannelName,
  onProfileClick,
  onStatusChange,
  onMicClick,
  onHeadphonesClick,
  onNoiseClick,
  onSettingsClick,
  onVoiceReturnClick,
  onVoiceDisconnectClick,
}: UserPanelProps) {
  const [noiseOpen, setNoiseOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [draftCustom, setDraftCustom] = useState(customStatus ?? '');
  const noiseRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftCustom(customStatus ?? '');
  }, [customStatus]);

  useEffect(() => {
    if (!noiseOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!noiseRef.current?.contains(e.target as Node)) setNoiseOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [noiseOpen]);

  useEffect(() => {
    if (!statusOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!statusRef.current?.contains(e.target as Node)) setStatusOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [statusOpen]);

  const statusOptions: PresenceStatus[] = ['ONLINE', 'IDLE', 'DND', 'OFFLINE'];

  return (
    <div className="bg-surface-container-lowest shrink-0">
      {voiceConnected && voiceChannelName && (
        <div className="px-space-sm pt-space-sm">
          <div className="rounded-lg bg-dracula-green/15 border border-dracula-green/30 px-space-sm py-space-xs flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[16px] text-dracula-green leading-none">
              signal_cellular_alt
            </span>
            <button
              type="button"
              onClick={onVoiceReturnClick}
              className="min-w-0 flex-1 text-left"
            >
              <p className="font-label-sm text-dracula-green leading-tight">Ses bağlı</p>
              <p className="font-label-sm text-on-surface truncate leading-tight">{voiceChannelName}</p>
            </button>
            <button
              type="button"
              onClick={onVoiceDisconnectClick}
              className="w-7 h-7 rounded flex items-center justify-center text-error hover:bg-error/15"
              aria-label="Sesten ayrıl"
              title="Sesten ayrıl"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">call_end</span>
            </button>
          </div>
        </div>
      )}
      <div className="h-16 px-space-sm flex items-center justify-between">
        <div className="relative flex-1 min-w-0" ref={statusRef}>
          <button
            type="button"
            onClick={() => {
              if (onStatusChange) setStatusOpen((v) => !v);
              else onProfileClick?.();
            }}
            className="flex items-center gap-space-xs min-w-0 p-space-xs rounded-lg hover:bg-surface-container transition-colors duration-200 w-full text-left"
          >
            <Avatar displayName={displayName} imageUrl={avatarUrl} size="md" status={status} />
            <div className="flex flex-col min-w-0 leading-none">
              <span className="font-label-md text-label-md text-on-surface truncate">{displayName}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                {presenceLabelTr(status, customStatus)}
              </span>
            </div>
          </button>
          {statusOpen && onStatusChange && (
            <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float p-space-sm z-50">
              <p className="font-label-md text-on-surface mb-space-xs">Durum</p>
              <div className="space-y-0.5 mb-space-sm">
                {statusOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      onStatusChange(s, customStatus);
                      setStatusOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left font-label-sm',
                      status === s
                        ? 'bg-surface-bright text-on-surface'
                        : 'hover:bg-surface-container text-on-surface-variant',
                    )}
                  >
                    <span className={cn('w-2.5 h-2.5 rounded-full', presenceDotClass(s))} />
                    {presenceLabelTr(s)}
                  </button>
                ))}
              </div>
              <label className="block space-y-1">
                <span className="font-label-sm text-on-surface-variant">Özel durum</span>
                <input
                  className="w-full h-9 rounded-lg bg-surface-container-lowest px-2 text-on-surface font-body-sm outline-none"
                  value={draftCustom}
                  maxLength={128}
                  placeholder="Ne yapıyorsun?"
                  onChange={(e) => setDraftCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onStatusChange(status, draftCustom.trim() || null);
                      setStatusOpen(false);
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="mt-2 w-full h-8 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
                onClick={() => {
                  onStatusChange(status, draftCustom.trim() || null);
                  setStatusOpen(false);
                }}
              >
                Kaydet
              </button>
              {onProfileClick && (
                <button
                  type="button"
                  className="mt-1 w-full h-8 rounded-lg text-on-surface-variant font-label-sm hover:bg-surface-container"
                  onClick={() => {
                    setStatusOpen(false);
                    onProfileClick();
                  }}
                >
                  Profili düzenle
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center text-on-surface-variant">
          {voiceConnected && (
            <div className="relative" ref={noiseRef}>
              <button
                type="button"
                onClick={() => {
                  setNoiseOpen((v) => !v);
                }}
                className={cn(
                  'w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container transition-colors duration-200',
                  noiseCancellation ? 'text-primary-container' : 'hover:text-on-surface',
                )}
                aria-label="Gürültü engelleme"
                title="Gürültü engelleme"
              >
                <span className="material-symbols-outlined text-[18px] leading-none">graphic_eq</span>
              </button>
              {noiseOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-56 rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float p-space-sm z-40">
                  <p className="font-label-md text-on-surface mb-1">Gürültü engelleme</p>
                  <p className="font-label-sm text-on-surface-variant mb-space-sm">
                    {noiseNote ||
                      (noiseCancellation
                        ? 'Açık — arka plan gürültüsü azaltılıyor.'
                        : 'Kapalı — DeepFilterNet ile arka plan gürültüsünü azalt.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onNoiseClick?.();
                    }}
                    className={cn(
                      'w-full h-8 rounded-lg font-label-sm transition-colors',
                      noiseCancellation
                        ? 'bg-primary-container text-on-primary-container'
                        : 'bg-surface-container-highest text-on-surface hover:bg-surface-bright',
                    )}
                  >
                    {noiseCancellation ? 'Kapat' : 'Aç'}
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onMicClick}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container transition-colors duration-200',
              muted ? 'text-error' : 'hover:text-on-surface',
              !voiceConnected && 'opacity-50 pointer-events-none',
            )}
            aria-label={muted ? 'Mikrofonu aç' : 'Mikrofonu kapat'}
            disabled={!voiceConnected}
          >
            <span className="material-symbols-outlined text-[18px] leading-none">
              {muted ? 'mic_off' : 'mic'}
            </span>
          </button>
          <button
            type="button"
            onClick={onHeadphonesClick}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container transition-colors duration-200',
              deafened ? 'text-error' : 'hover:text-on-surface',
              !voiceConnected && 'opacity-50 pointer-events-none',
            )}
            aria-label={deafened ? 'Sesi aç' : 'Kulaklığı sustur'}
            disabled={!voiceConnected}
          >
            <HeadphonesIcon deafened={deafened} size={18} />
          </button>
          <button
            type="button"
            onClick={onSettingsClick}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container hover:text-on-surface transition-colors duration-200"
            aria-label="Ayarlar"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ChannelSidebarProps {
  serverName: string;
  serverBannerUrl?: string | null;
  verified?: boolean;
  onServerHeaderClick?: () => void;
  categories: SidebarCategory[];
  userPanel: UserPanelProps;
  headerExtra?: ReactNode;
  className?: string;
}

function ChannelRow({ channel }: { channel: SidebarChannelItem }) {
  const isText = channel.type === 'text';
  const voiceMembers = channel.voiceMembers ?? [];
  const hasActions = Boolean(channel.onEdit || channel.onDelete);

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          'group/row relative flex items-center rounded-lg w-full transition-colors duration-200',
          channel.active
            ? 'bg-surface-container-high text-on-surface'
            : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
        )}
      >
        <button
          type="button"
          onClick={channel.onClick}
          onContextMenu={(e) => {
            if (!channel.onContextMenu && !channel.onEdit) return;
            e.preventDefault();
            (channel.onContextMenu ?? channel.onEdit)?.();
          }}
          className={cn(
            'relative flex items-center gap-space-xs px-space-sm py-space-xs rounded-lg flex-1 min-w-0 text-left',
            channel.active && 'font-semibold',
          )}
        >
          {channel.active && (
            <div className="absolute -left-space-xs top-1.5 bottom-1.5 w-1 bg-primary-container rounded-r-full" />
          )}
          {isText ? (
            <span
              className={cn(
                'font-headline-md text-headline-md',
                channel.active ? 'text-primary-container' : 'text-outline',
              )}
            >
              #
            </span>
          ) : (
            <span className="material-symbols-outlined text-[18px] text-outline">volume_up</span>
          )}
          <span className="font-body-sm text-body-sm truncate flex-1">{channel.name}</span>
          {channel.badgeCount != null && channel.badgeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-tertiary text-on-tertiary font-label-sm text-label-sm leading-none font-bold">
              {channel.badgeCount}
            </span>
          )}
          {channel.unread && !channel.active && (
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-label="Okunmamış" />
          )}
          {!isText && voiceMembers.length > 0 && (
            <span className="font-label-sm text-label-sm text-primary font-bold">
              {voiceMembers.length}
            </span>
          )}
        </button>
        {hasActions && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover/row:flex items-center gap-0.5 bg-surface-container-high rounded-md px-0.5">
            {channel.onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  channel.onEdit?.();
                }}
                className="w-6 h-6 flex items-center justify-center rounded text-outline hover:text-on-surface"
                aria-label="Kanalı düzenle"
              >
                <span className="material-symbols-outlined text-[14px]">edit</span>
              </button>
            )}
            {channel.onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  channel.onDelete?.();
                }}
                className="w-6 h-6 flex items-center justify-center rounded text-outline hover:text-error"
                aria-label="Kanalı sil"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
              </button>
            )}
          </div>
        )}
      </div>

      {!isText && voiceMembers.length > 0 && (
        <ul className="ml-6 flex flex-col gap-0.5">
          {voiceMembers.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-space-xs px-space-sm py-0.5 text-on-surface-variant"
            >
              <Avatar
                displayName={m.displayName}
                imageUrl={m.avatarUrl}
                size="sm"
                statusRing={false}
              />
              <span
                className={cn(
                  'font-label-sm text-label-sm truncate flex-1',
                  m.speaking && 'text-primary-container font-semibold',
                )}
              >
                {m.displayName}
              </span>
              {m.muted && (
                <span className="material-symbols-outlined text-[14px] text-error">mic_off</span>
              )}
              {m.deafened && (
                <span className="relative inline-flex w-[14px] h-[14px] text-error" aria-hidden>
                  <span
                    className="material-symbols-outlined leading-none"
                    style={{ fontSize: 14 }}
                  >
                    headphones
                  </span>
                  <span className="absolute left-1/2 top-1/2 block w-[16px] h-[1.5px] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg] rounded-full bg-current" />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ChannelSidebar({
  serverName,
  serverBannerUrl,
  verified,
  onServerHeaderClick,
  categories,
  userPanel,
  headerExtra,
  className,
}: ChannelSidebarProps) {
  return (
    <aside
      className={cn(
        'w-60 bg-surface-container-low flex flex-col justify-between shadow-bar shrink-0 min-h-0',
        className,
      )}
    >
      <div className="flex flex-col flex-1 min-h-0">
        <button
          type="button"
          onClick={onServerHeaderClick}
          className={cn(
            'relative h-12 px-space-md flex items-center justify-between shadow-bar shrink-0 overflow-hidden transition-colors duration-200',
            serverBannerUrl
              ? 'hover:brightness-110'
              : 'bg-surface-container-low hover:bg-surface-container',
          )}
        >
          {serverBannerUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={serverBannerUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/45 to-black/70" />
            </>
          )}
          <div className="relative z-[1] flex items-center gap-space-xs min-w-0">
            <span
              className={cn(
                'font-headline-md text-headline-md truncate',
                serverBannerUrl ? 'text-white drop-shadow' : 'text-on-surface',
              )}
            >
              {serverName}
            </span>
            {verified && (
              <span
                className="material-symbols-outlined text-[16px] text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
                title="Doğrulanmış"
              >
                verified
              </span>
            )}
          </div>
          <span
            className={cn(
              'material-symbols-outlined text-[20px] relative z-[1]',
              serverBannerUrl ? 'text-white/90' : 'text-on-surface-variant',
            )}
          >
            expand_more
          </span>
        </button>
        {headerExtra}
        <div className="flex-1 overflow-y-auto px-space-sm py-space-md space-y-space-md">
          {categories.map((category) => (
            <div key={category.id}>
              <div className="px-space-sm mb-space-xs flex items-center justify-between text-on-surface-variant hover:text-on-surface group">
                <button
                  type="button"
                  onClick={category.onToggle}
                  className="flex items-center gap-space-xs flex-1 text-left"
                >
                  <span
                    className={cn(
                      'material-symbols-outlined text-[12px] transition-transform duration-200 group-hover:text-primary-container',
                      category.collapsed && '-rotate-90',
                    )}
                  >
                    expand_more
                  </span>
                  <span className="font-label-sm text-label-sm uppercase tracking-wider font-bold">
                    {category.label}
                  </span>
                </button>
                {category.onAddChannel && (
                  <button
                    type="button"
                    onClick={category.onAddChannel}
                    className="material-symbols-outlined text-[14px] cursor-pointer hover:text-primary-container transition-colors duration-200"
                    aria-label="Kanal ekle"
                  >
                    add
                  </button>
                )}
              </div>
              {!category.collapsed && (
                <div className="flex flex-col gap-space-xs">
                  {category.channels.map((ch) => (
                    <ChannelRow key={ch.id} channel={ch} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <UserPanel {...userPanel} />
    </aside>
  );
}
