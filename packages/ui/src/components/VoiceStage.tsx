'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';
import { VolumeSlider } from './VolumeSlider';

export interface VoiceParticipant {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  speaking?: boolean;
  muted?: boolean;
  /** Ekran paylaşımı açık */
  video?: boolean;
  /** Kamera (webcam) açık */
  camera?: boolean;
  isBot?: boolean;
}

export interface VoiceStageScreenShare {
  identity?: string;
  displayName: string;
  isLocal?: boolean;
  videoRef: (el: HTMLVideoElement | null) => void;
}

export interface VoiceStageScreenShareOption {
  identity: string;
  displayName: string;
  isLocal?: boolean;
}

export interface VoiceStageProps {
  channelName: string;
  participants: VoiceParticipant[];
  /** Yerel katılımcı id — ses kaydırıcısı gösterilmez */
  localParticipantId?: string | null;
  /** 0–100 kişi başı ses */
  participantVolumes?: Record<string, number>;
  onParticipantVolumeChange?: (participantId: string, volume: number) => void;
  onCameraVideoRef?: (participantId: string, el: HTMLVideoElement | null) => void;
  /** Ekran paylaşan katılımcıya tıklanınca o yayını odakla */
  onFocusScreenShare?: (identity: string) => void;
  rtcConnected?: boolean;
  muted?: boolean;
  deafened?: boolean;
  cameraEnabled?: boolean;
  screenSharing?: boolean;
  screenShare?: VoiceStageScreenShare | null;
  /** Odadaki tüm ekran paylaşımları (çoklu seçim) */
  screenShares?: VoiceStageScreenShareOption[];
  participantsDrawerOpen?: boolean;
  chatDrawerOpen?: boolean;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  onToggleCamera?: () => void;
  onToggleScreenShare?: () => void;
  onLeave?: () => void;
  onToggleParticipants?: () => void;
  onToggleChat?: () => void;
  stageOverlay?: ReactNode;
  chatPanel?: ReactNode;
  participantsPanel?: ReactNode;
  /** Desktop sohbet paneli genişliği (px) */
  chatPanelWidth?: number;
  onChatPanelWidthChange?: (width: number) => void;
  /** Desktop kullanıcı paneli genişliği (px) */
  participantsPanelWidth?: number;
  onParticipantsPanelWidthChange?: (width: number) => void;
  className?: string;
}

function usePanelResize(
  width: number,
  onChange: ((w: number) => void) | undefined,
  min: number,
  max: number,
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
      const next = Math.min(max, Math.max(min, startRef.current.w + dx));
      onChange(next);
    },
    [onChange, min, max],
  );

  const onPointerUp = useCallback(() => {
    startRef.current = null;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}

export function VoiceStage({
  channelName,
  participants,
  localParticipantId,
  participantVolumes,
  onParticipantVolumeChange,
  onCameraVideoRef,
  onFocusScreenShare,
  rtcConnected = true,
  muted,
  deafened,
  cameraEnabled,
  screenSharing,
  screenShare,
  screenShares = [],
  participantsDrawerOpen,
  chatDrawerOpen,
  onToggleMute,
  onToggleDeafen,
  onToggleCamera,
  onToggleScreenShare,
  onLeave,
  onToggleParticipants,
  onToggleChat,
  stageOverlay,
  chatPanel,
  participantsPanel,
  chatPanelWidth = 340,
  onChatPanelWidthChange,
  participantsPanelWidth = 288,
  onParticipantsPanelWidthChange,
  className,
}: VoiceStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoCbRef = useRef(screenShare?.videoRef);
  screenVideoCbRef.current = screenShare?.videoRef;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pinnedCameraId, setPinnedCameraId] = useState<string | null>(null);
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

  const chatResize = usePanelResize(localChatW, setChatW, 240, 560);

  useEffect(() => {
    const onFs = () => {
      const node = stageRef.current;
      setIsFullscreen(Boolean(node && document.fullscreenElement === node));
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    screenVideoCbRef.current?.(el);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const box = stageRef.current;
    if (!box) return;
    try {
      if (document.fullscreenElement === box) {
        await document.exitFullscreen();
        return;
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      await box.requestFullscreen();
    } catch {
      const v = videoElRef.current as HTMLVideoElement & {
        webkitEnterFullscreen?: () => void;
      };
      try {
        v?.webkitEnterFullscreen?.();
      } catch {
        // ignore
      }
    }
  }, []);

  const focusedId = screenShare?.identity;
  const shareOptions = screenShares.length > 0 ? screenShares : screenShare
    ? [
        {
          identity: screenShare.identity ?? 'active',
          displayName: screenShare.displayName,
          isLocal: screenShare.isLocal,
        },
      ]
    : [];

  const showChat = Boolean(chatDrawerOpen && chatPanel);
  const showParts = Boolean(participantsDrawerOpen && participantsPanel);

  return (
    <div className={cn('flex flex-col flex-1 min-h-0 bg-surface relative', className)}>
      <div className="h-12 px-space-md flex items-center justify-between border-b border-surface-container-high shrink-0">
        <div className="flex items-center gap-space-sm min-w-0">
          <span className="material-symbols-outlined text-primary-container">volume_up</span>
          <span className="font-headline-md text-headline-md text-on-surface truncate">{channelName}</span>
          {screenShare && (
            <span className="hidden sm:inline font-label-sm text-label-sm text-primary-container truncate">
              · {screenShare.displayName} ekran paylaşıyor
            </span>
          )}
        </div>
        <div className="flex items-center gap-space-sm">
          {rtcConnected && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dracula-green/20 text-dracula-green font-label-sm text-label-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-dracula-green" />
              Bağlı
            </span>
          )}
          <button
            type="button"
            onClick={onToggleChat}
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200',
              chatDrawerOpen
                ? 'bg-surface-container-high text-on-surface'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
            )}
            aria-label="Sohbet"
            aria-pressed={chatDrawerOpen}
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
          </button>
          <button
            type="button"
            onClick={onToggleParticipants}
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200',
              participantsDrawerOpen
                ? 'bg-surface-container-high text-on-surface'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
            )}
            aria-label="Katılımcılar"
            aria-pressed={participantsDrawerOpen}
          >
            <span className="material-symbols-outlined text-[20px]">group</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {/* Metin — masaüstü yan panel */}
        {showChat && (
          <aside
            className="relative border-r border-surface-container-high bg-surface-container shrink-0 flex-col min-h-0 hidden md:flex"
            style={{ width: localChatW }}
          >
            {chatPanel}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Sohbet genişliği"
              className="absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary-container/40 z-10"
              onPointerDown={chatResize.onPointerDown}
              onPointerMove={chatResize.onPointerMove}
              onPointerUp={chatResize.onPointerUp}
            />
          </aside>
        )}

        <div className="flex-1 flex flex-col min-w-0 relative p-space-sm sm:p-space-md gap-space-sm sm:gap-space-md">
          {(() => {
            const cameraParticipants = participants.filter((p) => p.camera);
            const autoSpeaker =
              !screenShare && cameraParticipants.length > 0
                ? cameraParticipants.find((p) => p.speaking) ??
                  cameraParticipants[0]
                : null;
            const featuredCameraId = screenShare
              ? null
              : pinnedCameraId && cameraParticipants.some((p) => p.id === pinnedCameraId)
                ? pinnedCameraId
                : autoSpeaker?.id ?? null;
            const featuredCamera = featuredCameraId
              ? participants.find((p) => p.id === featuredCameraId)
              : null;
            const showMainStage = Boolean(screenShare || featuredCamera);
            const stripMode = showMainStage;

            return (
              <>
                {screenShare ? (
                  <div
                    ref={stageRef}
                    className={cn(
                      'flex-1 min-h-0 rounded-xl bg-black border border-surface-container-high overflow-hidden relative flex flex-col',
                      isFullscreen && 'rounded-none border-0',
                    )}
                  >
                    {shareOptions.length > 1 && (
                      <div className="absolute top-space-sm left-space-sm right-space-sm z-[2] flex flex-wrap gap-1.5 pointer-events-auto">
                        {shareOptions.map((s) => {
                          const active = s.identity === focusedId;
                          return (
                            <button
                              key={s.identity}
                              type="button"
                              onClick={() => onFocusScreenShare?.(s.identity)}
                              className={cn(
                                'px-space-sm py-1 rounded-lg font-label-sm truncate max-w-[10rem] transition-colors',
                                active
                                  ? 'bg-primary-container text-on-primary-container'
                                  : 'bg-black/65 text-white hover:bg-black/80',
                              )}
                            >
                              {s.displayName}
                              {s.isLocal ? ' (sen)' : ''}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <video
                      ref={setVideoRef}
                      className="flex-1 min-h-0 w-full h-full object-contain bg-black"
                      playsInline
                      autoPlay
                      muted={screenShare.isLocal}
                    />
                    <div className="absolute left-space-sm bottom-space-sm px-space-sm py-1 rounded-lg bg-black/60 text-white font-label-sm z-[1]">
                      {screenShare.displayName}
                      {screenShare.isLocal ? ' (sen)' : ''}
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleFullscreen()}
                      className="absolute right-space-sm bottom-space-sm z-[1] w-9 h-9 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                      aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                      </span>
                    </button>
                  </div>
                ) : featuredCamera ? (
                  <div
                    ref={stageRef}
                    className={cn(
                      'flex-1 min-h-0 rounded-xl bg-black border border-surface-container-high overflow-hidden relative flex flex-col',
                      isFullscreen && 'rounded-none border-0',
                    )}
                  >
                    <video
                      ref={(el) => onCameraVideoRef?.(featuredCamera.id, el)}
                      className="flex-1 min-h-0 w-full h-full object-contain bg-black"
                      playsInline
                      autoPlay
                      muted
                    />
                    <div className="absolute left-space-sm bottom-space-sm px-space-sm py-1 rounded-lg bg-black/60 text-white font-label-sm z-[1]">
                      {featuredCamera.displayName}
                      {featuredCamera.id === localParticipantId ? ' (sen)' : ''}
                      {pinnedCameraId === featuredCamera.id ? ' · sabit' : ''}
                    </div>
                    <div className="absolute right-space-sm bottom-space-sm z-[1] flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setPinnedCameraId((cur) =>
                            cur === featuredCamera.id ? null : featuredCamera.id,
                          )
                        }
                        className="w-9 h-9 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
                        aria-label="Kamerayı sabitle"
                        title="Sabitle / serbest"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {pinnedCameraId === featuredCamera.id ? 'keep' : 'keep_off'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleFullscreen()}
                        className="w-9 h-9 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
                        aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : null}

                <div
                  className={cn(
                    'grid gap-space-sm sm:gap-space-md content-start overflow-y-auto p-0.5 min-w-0',
                    stripMode
                      ? 'grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 shrink-0 max-h-52'
                      : 'flex-1 grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
                  )}
                >
                  {participants.map((p) => {
                    const isLocal = Boolean(localParticipantId && p.id === localParticipantId);
                    const vol = participantVolumes?.[p.id] ?? 100;
                    const showVolume = !isLocal && Boolean(onParticipantVolumeChange);
                    const isFocusedShare = Boolean(p.video && focusedId === p.id);
                    const canFocusShare = Boolean(p.video && onFocusScreenShare);
                    const isFeaturedCam = Boolean(featuredCameraId && p.id === featuredCameraId);
                    const canFocusCam = Boolean(p.camera && !screenShare);

                    return (
                      <div
                        key={p.id}
                        role={canFocusShare || canFocusCam ? 'button' : undefined}
                        tabIndex={canFocusShare || canFocusCam ? 0 : undefined}
                        onClick={() => {
                          if (canFocusShare) onFocusScreenShare?.(p.id);
                          else if (canFocusCam) setPinnedCameraId(p.id);
                        }}
                        onKeyDown={
                          canFocusShare || canFocusCam
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  if (canFocusShare) onFocusScreenShare?.(p.id);
                                  else if (canFocusCam) setPinnedCameraId(p.id);
                                }
                              }
                            : undefined
                        }
                        className={cn(
                          'rounded-xl bg-surface-container-low flex flex-col items-center justify-center gap-space-sm p-space-sm relative overflow-hidden transition-shadow duration-200 box-border w-full min-w-0',
                          stripMode
                            ? 'aspect-video min-h-[6.5rem] sm:min-h-[8.5rem]'
                            : 'aspect-video min-h-[8rem] sm:min-h-0',
                          p.speaking && 'ring-2 ring-inset ring-primary-container',
                          (isFocusedShare || isFeaturedCam) && 'ring-2 ring-inset ring-primary',
                          p.isBot && 'ring-1 ring-inset ring-secondary-container/60',
                          (canFocusShare || canFocusCam) && 'cursor-pointer hover:bg-surface-container',
                        )}
                        title={
                          canFocusShare
                            ? 'Ekran paylaşımını göster'
                            : canFocusCam
                              ? 'Kamerayı büyük göster'
                              : undefined
                        }
                      >
                        {p.camera && !isFeaturedCam ? (
                          <video
                            ref={(el) => onCameraVideoRef?.(p.id, el)}
                            className="absolute inset-0 w-full h-full object-cover bg-black pointer-events-none"
                            playsInline
                            autoPlay
                            muted
                          />
                        ) : p.camera && isFeaturedCam ? (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Avatar displayName={p.displayName} imageUrl={p.avatarUrl} size="lg" statusRing={false} />
                          </div>
                        ) : (
                          <Avatar displayName={p.displayName} imageUrl={p.avatarUrl} size="lg" statusRing={false} />
                        )}
                        <div
                          className={cn(
                            'absolute left-space-sm bottom-space-sm right-space-sm flex flex-col gap-1 min-w-0 z-[1]',
                            p.camera && 'rounded-lg bg-black/55 px-space-sm py-1',
                          )}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              className={cn(
                                'font-body-sm text-body-sm truncate flex-1',
                                p.camera ? 'text-white' : 'text-on-surface',
                              )}
                            >
                              {p.displayName}
                              {isLocal ? ' (sen)' : ''}
                            </span>
                            {p.isBot && (
                              <span className="h-4 px-1 rounded bg-primary text-on-primary text-[9px] font-bold uppercase shrink-0">
                                Bot
                              </span>
                            )}
                            {p.muted && (
                              <span className="material-symbols-outlined text-[16px] text-error shrink-0">
                                mic_off
                              </span>
                            )}
                            {p.video && (
                              <span className="material-symbols-outlined text-[16px] text-primary-container shrink-0">
                                present_to_all
                              </span>
                            )}
                            {p.camera && (
                              <span className="material-symbols-outlined text-[16px] text-white/80 shrink-0">
                                videocam
                              </span>
                            )}
                          </div>
                          {showVolume && (
                            <label
                              className="flex items-center gap-1.5 min-w-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span
                                className={cn(
                                  'material-symbols-outlined text-[14px] shrink-0',
                                  p.camera ? 'text-white/70' : 'text-outline',
                                )}
                                title={p.isBot ? 'Bot yerel sesi (senin)' : 'Kullanıcı sesi'}
                              >
                                {vol === 0 ? 'volume_off' : p.isBot ? 'smart_toy' : 'volume_up'}
                              </span>
                              <VolumeSlider
                                size="sm"
                                value={vol}
                                aria-label={
                                  p.isBot
                                    ? `${p.displayName} yerel ses (senin)`
                                    : `${p.displayName} ses seviyesi`
                                }
                                onChange={(v) => onParticipantVolumeChange?.(p.id, v)}
                              />
                              <span
                                className={cn(
                                  'font-label-sm tabular-nums w-7 text-right shrink-0',
                                  p.camera ? 'text-white/70' : 'text-outline',
                                )}
                              >
                                {vol}
                              </span>
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
          {stageOverlay}
        </div>

        {/* Kullanıcılar — masaüstü yan panel */}
        {showParts && (
          <aside
            className="relative border-l border-surface-container-high bg-surface-container-low shrink-0 overflow-hidden flex-col min-h-0 hidden md:flex"
            style={{ width: localPartW }}
          >
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Üye paneli genişliği"
              className="absolute top-0 left-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary-container/40 z-10"
              onPointerDown={(e) => {
                const startX = e.clientX;
                const startW = localPartW;
                const target = e.target as HTMLElement;
                target.setPointerCapture?.(e.pointerId);
                const move = (ev: PointerEvent) => {
                  const dx = startX - ev.clientX;
                  setPartW(Math.min(420, Math.max(200, startW + dx)));
                };
                const up = () => {
                  window.removeEventListener('pointermove', move);
                  window.removeEventListener('pointerup', up);
                };
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', up);
              }}
            />
            {participantsPanel}
          </aside>
        )}

        {/* Mobil: sohbet / üyeler üstten overlay */}
        {showChat && (
          <div className="md:hidden absolute inset-0 z-50 flex flex-col pointer-events-none">
            <button
              type="button"
              className="absolute inset-0 bg-black/55 pointer-events-auto"
              aria-label="Sohbeti kapat"
              onClick={onToggleChat}
            />
            <div className="relative z-10 pointer-events-auto flex flex-col h-[min(88dvh,42rem)] w-full rounded-b-2xl overflow-hidden border-b border-surface-container-highest bg-surface-container shadow-float dracord-slide-up">
              {chatPanel}
            </div>
          </div>
        )}
        {showParts && (
          <div className="md:hidden absolute inset-0 z-[51] flex flex-col pointer-events-none">
            <button
              type="button"
              className="absolute inset-0 bg-black/55 pointer-events-auto"
              aria-label="Üyeleri kapat"
              onClick={onToggleParticipants}
            />
            <div className="relative z-10 pointer-events-auto flex flex-col h-[min(88dvh,42rem)] w-full rounded-b-2xl overflow-hidden border-b border-surface-container-highest bg-surface-container-low shadow-float dracord-slide-up">
              {participantsPanel}
            </div>
          </div>
        )}
      </div>

      <div className="h-16 px-space-lg flex items-center justify-center gap-space-md bg-surface-container-lowest border-t border-surface-container-high shrink-0">
        <button
          type="button"
          onClick={onToggleMute}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200',
            muted
              ? 'bg-error-container text-on-error-container'
              : 'bg-surface-container-highest text-on-surface hover:bg-surface-bright',
          )}
          aria-label={muted ? 'Susturmayı kaldır' : 'Sustur'}
        >
          <span className="material-symbols-outlined text-[24px] leading-none">
            {muted ? 'mic_off' : 'mic'}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleDeafen}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200',
            deafened
              ? 'bg-error-container text-on-error-container'
              : 'bg-surface-container-highest text-on-surface hover:bg-surface-bright',
          )}
          aria-label={deafened ? 'Sağırlaştırmayı kaldır' : 'Sağırlaştır'}
        >
          <span
            className="relative inline-flex items-center justify-center"
            style={{ width: 24, height: 24 }}
            aria-hidden
          >
            <span
              className="material-symbols-outlined leading-none"
              style={{ fontSize: 24, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
            >
              headphones
            </span>
            {deafened && (
              <span className="absolute left-1/2 top-1/2 block w-[28px] h-[2.5px] -translate-x-1/2 -translate-y-1/2 rotate-[-45deg] rounded-full bg-current" />
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleCamera}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200',
            cameraEnabled
              ? 'bg-primary-container text-on-primary-container'
              : 'bg-surface-container-highest text-on-surface hover:bg-surface-bright',
          )}
          aria-label={cameraEnabled ? 'Kamerayı kapat' : 'Kamerayı aç'}
        >
          <span className="material-symbols-outlined text-[24px]">
            {cameraEnabled ? 'videocam' : 'videocam_off'}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleScreenShare}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200',
            screenSharing
              ? 'bg-primary-container text-on-primary-container'
              : 'bg-surface-container-highest text-on-surface hover:bg-surface-bright',
          )}
          aria-label={screenSharing ? 'Paylaşımı durdur' : 'Ekran paylaş'}
        >
          <span className="material-symbols-outlined text-[24px]">
            {screenSharing ? 'stop_screen_share' : 'present_to_all'}
          </span>
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="w-12 h-12 rounded-full bg-error hover:bg-error-container text-on-error flex items-center justify-center transition-colors duration-200"
          aria-label="Kanaldan ayrıl"
        >
          <span className="material-symbols-outlined text-[24px]">call_end</span>
        </button>
      </div>
    </div>
  );
}
