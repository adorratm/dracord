'use client';

import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';

export interface VoiceParticipant {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  speaking?: boolean;
  muted?: boolean;
  video?: boolean;
}

export interface VoiceStageScreenShare {
  displayName: string;
  isLocal?: boolean;
  videoRef: (el: HTMLVideoElement | null) => void;
}

export interface VoiceStageProps {
  channelName: string;
  participants: VoiceParticipant[];
  rtcConnected?: boolean;
  muted?: boolean;
  deafened?: boolean;
  screenSharing?: boolean;
  screenShare?: VoiceStageScreenShare | null;
  participantsDrawerOpen?: boolean;
  chatDrawerOpen?: boolean;
  onToggleMute?: () => void;
  onToggleDeafen?: () => void;
  onToggleScreenShare?: () => void;
  onLeave?: () => void;
  onToggleParticipants?: () => void;
  onToggleChat?: () => void;
  stageOverlay?: ReactNode;
  chatPanel?: ReactNode;
  participantsPanel?: ReactNode;
  className?: string;
}

export function VoiceStage({
  channelName,
  participants,
  rtcConnected = true,
  muted,
  deafened,
  screenSharing,
  screenShare,
  participantsDrawerOpen,
  chatDrawerOpen,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onLeave,
  onToggleParticipants,
  onToggleChat,
  stageOverlay,
  chatPanel,
  participantsPanel,
  className,
}: VoiceStageProps) {
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
            onClick={onToggleParticipants}
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200',
              participantsDrawerOpen
                ? 'bg-surface-container-high text-on-surface'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
            )}
            aria-label="Katılımcılar"
          >
            <span className="material-symbols-outlined text-[20px]">group</span>
          </button>
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
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0 relative p-space-md gap-space-md">
          {screenShare ? (
            <div className="flex-1 min-h-0 rounded-xl bg-black/80 border border-surface-container-high overflow-hidden relative flex items-center justify-center">
              <video
                ref={screenShare.videoRef}
                className="max-w-full max-h-full w-full h-full object-contain bg-black"
                playsInline
                autoPlay
                muted={screenShare.isLocal}
              />
              <div className="absolute left-space-sm bottom-space-sm px-space-sm py-1 rounded-lg bg-black/60 text-white font-label-sm">
                {screenShare.displayName}
                {screenShare.isLocal ? ' (sen)' : ''}
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              'grid gap-space-md content-start overflow-y-auto',
              screenShare
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 shrink-0 max-h-36'
                : 'flex-1 grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
            )}
          >
            {participants.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'rounded-xl bg-surface-container-low flex flex-col items-center justify-center gap-space-sm p-space-md relative transition-shadow duration-200',
                  screenShare ? 'aspect-auto py-space-sm' : 'aspect-video',
                  p.speaking && 'ring-2 ring-primary-container',
                )}
              >
                <Avatar displayName={p.displayName} imageUrl={p.avatarUrl} size="lg" statusRing={false} />
                <span className="font-body-sm text-body-sm text-on-surface truncate max-w-full">
                  {p.displayName}
                </span>
                <div className="absolute bottom-space-sm right-space-sm flex gap-1">
                  {p.muted && (
                    <span className="material-symbols-outlined text-[16px] text-error bg-surface-container-high rounded-full p-0.5">
                      mic_off
                    </span>
                  )}
                  {p.video && (
                    <span className="material-symbols-outlined text-[16px] text-primary-container">
                      present_to_all
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {stageOverlay}
        </div>

        {participantsDrawerOpen && participantsPanel && (
          <aside className="w-72 border-l border-surface-container-high bg-surface-container-low shrink-0 overflow-y-auto">
            {participantsPanel}
          </aside>
        )}
        {chatDrawerOpen && chatPanel && (
          <aside className="w-80 border-l border-surface-container-high bg-surface-container shrink-0 flex flex-col min-h-0">
            {chatPanel}
          </aside>
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
