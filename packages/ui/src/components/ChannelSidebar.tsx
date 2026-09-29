'use client';

import type { PresenceStatus } from '@dracord/types';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  isBot?: boolean;
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
  locked?: boolean;
  badgeCount?: number;
  memberCount?: string;
  voiceMembers?: SidebarVoiceMember[];
  onClick?: () => void;
  onContextMenu?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export interface UserPanelAudioDevice {
  deviceId: string;
  label: string;
}

export interface UserPanelProps {
  displayName: string;
  /** @username satırı */
  username?: string | null;
  avatarUrl?: string | null;
  status?: PresenceStatus;
  customStatus?: string | null;
  muted?: boolean;
  deafened?: boolean;
  noiseCancellation?: boolean;
  noiseNote?: string | null;
  voiceConnected?: boolean;
  voiceChannelName?: string | null;
  /** WebRTC ping (RTT), ms */
  voiceLatencyMs?: number | null;
  /** 0–2 */
  micVolume?: number;
  /** 0–2 */
  outputVolume?: number;
  inputDeviceId?: string;
  outputDeviceId?: string;
  inputDevices?: UserPanelAudioDevice[];
  outputDevices?: UserPanelAudioDevice[];
  onProfileClick?: () => void;
  onStatusChange?: (status: PresenceStatus, customStatus?: string | null) => void;
  onMicClick?: () => void;
  onHeadphonesClick?: () => void;
  onNoiseClick?: () => void;
  onSettingsClick?: () => void;
  onVoiceSettingsClick?: () => void;
  onMicVolumeChange?: (volume: number) => void;
  onOutputVolumeChange?: (volume: number) => void;
  onInputDeviceChange?: (deviceId: string) => void;
  onOutputDeviceChange?: (deviceId: string) => void;
  onVoiceReturnClick?: () => void;
  onVoiceDisconnectClick?: () => void;
  /** Menü açılınca aygıt listesini yenilemek için */
  onAudioMenuOpen?: () => void;
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

const MENU_PANEL =
  'rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float p-2 z-[200]';

function useAboveAnchor(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  width: number,
  align: 'left' | 'right' = 'right',
) {
  const [style, setStyle] = useState<CSSProperties>({
    position: 'fixed',
    width,
    visibility: 'hidden',
  });

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 8;
      const left =
        align === 'right'
          ? Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))
          : Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setStyle({
        position: 'fixed',
        width,
        left,
        bottom: Math.max(8, window.innerHeight - r.top + gap),
        visibility: 'visible',
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef, width, align]);

  return style;
}

function PortalMenu({
  open,
  anchorRef,
  onClose,
  width,
  align = 'right',
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  width: number;
  align?: 'left' | 'right';
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const style = useAboveAnchor(open, anchorRef, width, align);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;
  return createPortal(
    <div ref={menuRef} style={style} className={MENU_PANEL} role="menu">
      {children}
    </div>,
    document.body,
  );
}

export function UserPanel({
  displayName,
  username,
  avatarUrl,
  status = 'ONLINE',
  customStatus = null,
  muted,
  deafened,
  noiseCancellation,
  noiseNote,
  voiceConnected,
  voiceChannelName,
  voiceLatencyMs = null,
  micVolume = 1,
  outputVolume = 1,
  inputDeviceId = '',
  outputDeviceId = '',
  inputDevices = [],
  outputDevices = [],
  onProfileClick,
  onStatusChange,
  onMicClick,
  onHeadphonesClick,
  onNoiseClick,
  onSettingsClick,
  onVoiceSettingsClick,
  onMicVolumeChange,
  onOutputVolumeChange,
  onInputDeviceChange,
  onOutputDeviceChange,
  onVoiceReturnClick,
  onVoiceDisconnectClick,
  onAudioMenuOpen,
}: UserPanelProps) {
  const [noiseOpen, setNoiseOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [micMenuOpen, setMicMenuOpen] = useState(false);
  const [phonesMenuOpen, setPhonesMenuOpen] = useState(false);
  const [draftCustom, setDraftCustom] = useState(customStatus ?? '');
  const statusRef = useRef<HTMLDivElement>(null);
  const micMenuRef = useRef<HTMLDivElement>(null);
  const phonesMenuRef = useRef<HTMLDivElement>(null);
  const noiseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftCustom(customStatus ?? '');
  }, [customStatus]);

  const openMicMenu = () => {
    setPhonesMenuOpen(false);
    setNoiseOpen(false);
    setStatusOpen(false);
    setMicMenuOpen((v) => {
      const next = !v;
      if (next) onAudioMenuOpen?.();
      return next;
    });
  };

  const openPhonesMenu = () => {
    setMicMenuOpen(false);
    setNoiseOpen(false);
    setStatusOpen(false);
    setPhonesMenuOpen((v) => {
      const next = !v;
      if (next) onAudioMenuOpen?.();
      return next;
    });
  };

  const statusOptions: PresenceStatus[] = ['ONLINE', 'IDLE', 'DND', 'OFFLINE'];
  const handleLine =
    customStatus?.trim() ||
    (username ? `@${username.replace(/^@/, '')}` : presenceLabelTr(status));
  const inputLabel =
    inputDevices.find((d) => d.deviceId === inputDeviceId)?.label || 'Sistem varsayılanı';
  const outputLabel =
    outputDevices.find((d) => d.deviceId === outputDeviceId)?.label || 'Sistem varsayılanı';

  return (
    <div className="bg-surface-container-lowest border-t border-surface-container-high shadow-[0_-4px_16px_rgba(0,0,0,0.2)]">
      {voiceConnected && voiceChannelName && (
        <div className="px-2 pt-2">
          <div
            className={cn(
              'rounded-lg border px-2.5 py-1.5 flex items-center gap-1.5',
              voiceLatencyMs != null && voiceLatencyMs >= 150
                ? 'bg-error/15 border-error/35'
                : voiceLatencyMs != null && voiceLatencyMs >= 80
                  ? 'bg-dracula-orange/15 border-dracula-orange/35'
                  : 'bg-dracula-green/15 border-dracula-green/30',
            )}
          >
            <span
              className={cn(
                'material-symbols-outlined text-[16px] leading-none',
                voiceLatencyMs != null && voiceLatencyMs >= 150
                  ? 'text-error'
                  : voiceLatencyMs != null && voiceLatencyMs >= 80
                    ? 'text-dracula-orange'
                    : 'text-dracula-green',
              )}
            >
              {voiceLatencyMs != null && voiceLatencyMs >= 150
                ? 'signal_cellular_alt_1_bar'
                : voiceLatencyMs != null && voiceLatencyMs >= 80
                  ? 'signal_cellular_alt_2_bar'
                  : 'signal_cellular_alt'}
            </span>
            <button
              type="button"
              onClick={onVoiceReturnClick}
              className="min-w-0 flex-1 text-left"
            >
              <p
                className={cn(
                  'font-label-sm leading-tight',
                  voiceLatencyMs != null && voiceLatencyMs >= 150
                    ? 'text-error'
                    : voiceLatencyMs != null && voiceLatencyMs >= 80
                      ? 'text-dracula-orange'
                      : 'text-dracula-green',
                )}
              >
                Ses bağlı
                {voiceLatencyMs != null && (
                  <span className="tabular-nums">
                    {' '}
                    · {voiceLatencyMs} ms ping
                  </span>
                )}
              </p>
              <p className="font-label-sm text-on-surface truncate leading-tight">
                {voiceChannelName}
                {voiceLatencyMs != null && (
                  <span className="text-on-surface-variant tabular-nums">
                    {' '}
                    · ~{Math.max(1, Math.round(voiceLatencyMs / 2))} ms gecikme
                  </span>
                )}
              </p>
            </button>
            <button
              type="button"
              onClick={onVoiceDisconnectClick}
              className="w-8 h-8 rounded-md flex items-center justify-center text-error hover:bg-error/15"
              aria-label="Sesten ayrıl"
              title="Sesten ayrıl"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">call_end</span>
            </button>
          </div>
        </div>
      )}

      <div className="p-2 flex items-center gap-1">
        <div className="relative flex-1 min-w-0" ref={statusRef}>
          <button
            type="button"
            onClick={() => {
              if (onStatusChange) {
                setMicMenuOpen(false);
                setPhonesMenuOpen(false);
                setNoiseOpen(false);
                setStatusOpen((v) => !v);
              } else onProfileClick?.();
            }}
            className="flex items-center gap-2.5 min-w-0 px-1.5 py-1.5 rounded-lg hover:bg-surface-container transition-colors duration-200 w-full text-left"
          >
            <Avatar displayName={displayName} imageUrl={avatarUrl} size="md" status={status} />
            <div className="flex flex-col min-w-0 leading-tight gap-0.5">
              <span className="font-label-md text-on-surface truncate font-semibold">
                {displayName}
              </span>
              <span className="font-label-sm text-on-surface-variant truncate text-[11px]">
                {handleLine}
              </span>
            </div>
          </button>
          <PortalMenu
            open={!!(statusOpen && onStatusChange)}
            anchorRef={statusRef}
            onClose={() => setStatusOpen(false)}
            width={288}
            align="left"
          >
            <p className="font-label-md text-on-surface mb-space-xs px-1">Durum</p>
            <div className="space-y-0.5 mb-space-sm">
              {statusOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onStatusChange?.(s, customStatus);
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
            <label className="block space-y-1 px-1">
              <span className="font-label-sm text-on-surface-variant">Özel durum</span>
              <input
                className="w-full h-9 rounded-lg bg-surface-container-lowest px-2 text-on-surface font-body-sm outline-none"
                value={draftCustom}
                maxLength={128}
                placeholder="Ne yapıyorsun?"
                onChange={(e) => setDraftCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onStatusChange?.(status, draftCustom.trim() || null);
                    setStatusOpen(false);
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="mt-2 w-full h-8 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
              onClick={() => {
                onStatusChange?.(status, draftCustom.trim() || null);
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
          </PortalMenu>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 text-on-surface-variant">
          <div className="relative flex items-stretch rounded-md" ref={micMenuRef}>
            <button
              type="button"
              onClick={onMicClick}
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded-l-md hover:bg-surface-container transition-colors duration-200',
                muted ? 'text-error' : 'hover:text-on-surface',
                !voiceConnected && 'opacity-50',
              )}
              aria-label={muted ? 'Mikrofonu aç' : 'Mikrofonu kapat'}
              disabled={!onMicClick}
              title={muted ? 'Mikrofon kapalı' : 'Mikrofon'}
            >
              <span className="material-symbols-outlined text-[20px] leading-none">
                {muted ? 'mic_off' : 'mic'}
              </span>
            </button>
            <button
              type="button"
              onClick={openMicMenu}
              className={cn(
                'w-4 h-8 flex items-center justify-center rounded-r-md hover:bg-surface-container transition-colors',
                muted ? 'text-error/80' : 'hover:text-on-surface',
                micMenuOpen && 'bg-surface-container text-on-surface',
              )}
              aria-label="Mikrofon ayarları"
              title="Mikrofon ayarları"
              aria-expanded={micMenuOpen}
            >
              <span className="material-symbols-outlined text-[14px] leading-none">
                {micMenuOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            <PortalMenu
              open={micMenuOpen}
              anchorRef={micMenuRef}
              onClose={() => setMicMenuOpen(false)}
              width={288}
            >
              <div className="px-2 py-2">
                <p className="font-label-sm text-on-surface">Giriş aygıtı</p>
                <p className="font-label-sm text-outline truncate text-[11px] mb-1">{inputLabel}</p>
                <select
                  value={inputDeviceId}
                  onChange={(e) => onInputDeviceChange?.(e.target.value)}
                  className="w-full h-9 rounded-lg bg-surface-container-lowest px-2 text-on-surface font-body-sm outline-none"
                >
                  <option value="">Sistem varsayılanı</option>
                  {inputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || d.deviceId.slice(0, 12)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="px-2 py-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-label-sm text-on-surface">Giriş sesi</p>
                  <span className="font-label-sm text-outline tabular-nums">
                    {Math.round(micVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  step={1}
                  value={Math.round(micVolume * 100)}
                  onChange={(e) => onMicVolumeChange?.(Number(e.target.value) / 100)}
                  className="w-full accent-primary-container"
                />
              </div>
              {onNoiseClick && (
                <button
                  type="button"
                  onClick={() => onNoiseClick()}
                  className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-surface-container text-left"
                >
                  <span className="font-label-sm text-on-surface">Gürültü engelleme</span>
                  <span className="font-label-sm text-outline">
                    {noiseCancellation ? 'Açık' : 'Kapalı'}
                  </span>
                </button>
              )}
              {(onVoiceSettingsClick || onSettingsClick) && (
                <>
                  <div className="h-px bg-surface-container-highest my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setMicMenuOpen(false);
                      (onVoiceSettingsClick ?? onSettingsClick)?.();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-container text-left font-label-sm text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px]">settings</span>
                    Ses ayarları
                  </button>
                </>
              )}
            </PortalMenu>
          </div>

          <div className="relative flex items-stretch rounded-md" ref={phonesMenuRef}>
            <button
              type="button"
              onClick={onHeadphonesClick}
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded-l-md hover:bg-surface-container transition-colors duration-200',
                deafened ? 'text-error' : 'hover:text-on-surface',
                !voiceConnected && 'opacity-50',
              )}
              aria-label={deafened ? 'Sesi aç' : 'Kulaklığı sustur'}
              disabled={!onHeadphonesClick}
              title={deafened ? 'Sağır' : 'Kulaklık'}
            >
              <HeadphonesIcon deafened={deafened} size={20} />
            </button>
            <button
              type="button"
              onClick={openPhonesMenu}
              className={cn(
                'w-4 h-8 flex items-center justify-center rounded-r-md hover:bg-surface-container transition-colors',
                deafened ? 'text-error/80' : 'hover:text-on-surface',
                phonesMenuOpen && 'bg-surface-container text-on-surface',
              )}
              aria-label="Çıkış ayarları"
              title="Çıkış ayarları"
              aria-expanded={phonesMenuOpen}
            >
              <span className="material-symbols-outlined text-[14px] leading-none">
                {phonesMenuOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            <PortalMenu
              open={phonesMenuOpen}
              anchorRef={phonesMenuRef}
              onClose={() => setPhonesMenuOpen(false)}
              width={288}
            >
              <div className="px-2 py-2">
                <p className="font-label-sm text-on-surface">Çıkış aygıtı</p>
                <p className="font-label-sm text-outline truncate text-[11px] mb-1">{outputLabel}</p>
                <select
                  value={outputDeviceId}
                  onChange={(e) => onOutputDeviceChange?.(e.target.value)}
                  className="w-full h-9 rounded-lg bg-surface-container-lowest px-2 text-on-surface font-body-sm outline-none"
                >
                  <option value="">Sistem varsayılanı</option>
                  {outputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || d.deviceId.slice(0, 12)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="px-2 py-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-label-sm text-on-surface">Çıkış sesi</p>
                  <span className="font-label-sm text-outline tabular-nums">
                    {Math.round(outputVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  step={1}
                  value={Math.round(outputVolume * 100)}
                  onChange={(e) => onOutputVolumeChange?.(Number(e.target.value) / 100)}
                  className="w-full accent-primary-container"
                />
              </div>
              {(onVoiceSettingsClick || onSettingsClick) && (
                <>
                  <div className="h-px bg-surface-container-highest my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhonesMenuOpen(false);
                      (onVoiceSettingsClick ?? onSettingsClick)?.();
                    }}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-container text-left font-label-sm text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px]">settings</span>
                    Ses ayarları
                  </button>
                </>
              )}
            </PortalMenu>
          </div>

          {voiceConnected && onNoiseClick && (
            <div className="relative" ref={noiseRef}>
              <button
                type="button"
                onClick={() => {
                  setMicMenuOpen(false);
                  setPhonesMenuOpen(false);
                  setStatusOpen(false);
                  setNoiseOpen((v) => !v);
                }}
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-md hover:bg-surface-container transition-colors duration-200',
                  noiseCancellation ? 'text-primary-container' : 'hover:text-on-surface',
                )}
                aria-label="Gürültü engelleme"
                title="Gürültü engelleme"
              >
                <span className="material-symbols-outlined text-[18px] leading-none">
                  graphic_eq
                </span>
              </button>
              <PortalMenu
                open={noiseOpen}
                anchorRef={noiseRef}
                onClose={() => setNoiseOpen(false)}
                width={224}
              >
                <p className="font-label-md text-on-surface mb-1 px-1">Gürültü engelleme</p>
                <p className="font-label-sm text-on-surface-variant mb-space-sm px-1">
                  {noiseNote ||
                    (noiseCancellation
                      ? 'Açık — arka plan gürültüsü azaltılıyor.'
                      : 'Kapalı — DeepFilterNet ile arka plan gürültüsünü azalt.')}
                </p>
                <button
                  type="button"
                  onClick={() => onNoiseClick()}
                  className={cn(
                    'w-full h-8 rounded-lg font-label-sm transition-colors',
                    noiseCancellation
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container-highest text-on-surface hover:bg-surface-bright',
                  )}
                >
                  {noiseCancellation ? 'Kapat' : 'Aç'}
                </button>
              </PortalMenu>
            </div>
          )}

          <button
            type="button"
            onClick={onSettingsClick}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-surface-container hover:text-on-surface transition-colors duration-200"
            aria-label="Ayarlar"
            title="Kullanıcı ayarları"
          >
            <span className="material-symbols-outlined text-[20px] leading-none">settings</span>
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
            <span className="material-symbols-outlined text-[18px] text-outline">
              {channel.locked ? 'lock' : 'volume_up'}
            </span>
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
              {m.isBot && (
                <span className="shrink-0 px-1 py-px rounded text-[8px] font-bold uppercase tracking-wide bg-primary-container text-on-primary-container leading-none">
                  BOT
                </span>
              )}
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
        'w-72 bg-surface-container-low flex flex-col justify-between shadow-bar shrink-0 min-h-0 overflow-visible',
        className,
      )}
    >
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
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
      {/* Discord gibi: panel sunucu çubuğunun altına taşar (72px) */}
      <div className="relative z-30 shrink-0 md:-ml-[72px] md:w-[calc(100%+72px)]">
        <UserPanel {...userPanel} />
      </div>
    </aside>
  );
}
