'use client';

import type { MessageAttachment } from '@dracord/types';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '../lib/cn';

function isImage(type: string, filename: string) {
  return type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(filename);
}
function isVideo(type: string, filename: string) {
  return type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(filename);
}
function isAudio(type: string, filename: string) {
  return type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(filename);
}
function isPdf(type: string, filename: string) {
  return type === 'application/pdf' || /\.pdf$/i.test(filename);
}

export interface MediaLightboxProps {
  attachment: MessageAttachment | null;
  onClose: () => void;
}

export function MediaLightbox({ attachment, onClose }: MediaLightboxProps) {
  useEffect(() => {
    if (!attachment) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attachment, onClose]);

  if (!attachment) return null;

  const { url, filename, contentType } = attachment;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black/90">
      <header className="h-12 px-space-md flex items-center justify-between shrink-0">
        <span className="font-body-sm text-white/80 truncate">{filename}</span>
        <div className="flex items-center gap-space-sm">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-space-sm rounded-lg text-white/80 hover:bg-white/10 flex items-center gap-1 font-label-sm"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            Aç
          </a>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg text-white/80 hover:bg-white/10 flex items-center justify-center"
            aria-label="Kapat"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </header>
      <div className="flex-1 min-h-0 flex items-center justify-center p-space-md">
        {isImage(contentType, filename) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={filename}
            className="w-full h-full max-w-[100vw] max-h-[calc(100dvh-3rem)] object-contain"
          />
        )}
        {isVideo(contentType, filename) && (
          <video
            src={url}
            controls
            autoPlay
            className="w-full h-full max-w-[100vw] max-h-[calc(100dvh-3rem)] object-contain rounded-lg"
          />
        )}
        {isAudio(contentType, filename) && (
          <audio src={url} controls autoPlay className="w-full max-w-lg" />
        )}
        {isPdf(contentType, filename) && (
          <iframe title={filename} src={url} className="w-full h-full rounded-lg bg-white" />
        )}
        {!isImage(contentType, filename) &&
          !isVideo(contentType, filename) &&
          !isAudio(contentType, filename) &&
          !isPdf(contentType, filename) && (
            <a href={url} className="text-primary-container underline font-body-md" target="_blank" rel="noreferrer">
              {filename} dosyasını indir
            </a>
          )}
      </div>
    </div>
  );
}

export interface MessageAttachmentViewProps {
  attachment: MessageAttachment;
  className?: string;
}

export function MessageAttachmentView({ attachment, className }: MessageAttachmentViewProps) {
  const [lightbox, setLightbox] = useState(false);
  const open = useCallback(() => setLightbox(true), []);
  const { url, filename, contentType, size } = attachment;
  const sizeLabel =
    size > 0
      ? size > 1024 * 1024
        ? `${(size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(size / 1024))} KB`
      : null;

  return (
    <>
      <div className={cn('mt-space-xs max-w-md', className)}>
        {isImage(contentType, filename) && (
          <button type="button" onClick={open} className="block text-left group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={filename}
              loading="lazy"
              className="max-w-full max-h-72 rounded-lg border border-surface-container-high object-contain bg-surface-container-low"
            />
            <span className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded bg-black/60 text-white text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">fullscreen</span>
              Tam ekran
            </span>
          </button>
        )}

        {isVideo(contentType, filename) && (
          <div className="rounded-lg overflow-hidden border border-surface-container-high bg-black">
            <video src={url} controls preload="metadata" className="w-full max-h-80" />
            <div className="flex items-center justify-between px-space-sm py-1 bg-surface-container-low">
              <span className="font-label-sm text-outline truncate">{filename}</span>
              <button
                type="button"
                onClick={open}
                className="text-primary-container font-label-sm hover:underline shrink-0"
              >
                Tam ekran
              </button>
            </div>
          </div>
        )}

        {isAudio(contentType, filename) && (
          <div className="rounded-lg border border-surface-container-high bg-surface-container-low px-space-sm py-space-sm">
            <div className="flex items-center gap-space-sm mb-space-xs">
              <span className="material-symbols-outlined text-primary-container">audio_file</span>
              <span className="font-body-sm text-on-surface truncate flex-1">{filename}</span>
              {sizeLabel && <span className="font-label-sm text-outline">{sizeLabel}</span>}
            </div>
            <audio src={url} controls preload="metadata" className="w-full" />
          </div>
        )}

        {(isPdf(contentType, filename) ||
          (!isImage(contentType, filename) &&
            !isVideo(contentType, filename) &&
            !isAudio(contentType, filename))) && (
          <div className="rounded-lg border border-surface-container-high bg-surface-container-low overflow-hidden">
            {isPdf(contentType, filename) && (
              <button type="button" onClick={open} className="block w-full bg-surface-container-highest">
                <iframe
                  title={filename}
                  src={`${url}#toolbar=0&navpanes=0`}
                  className="w-full h-48 pointer-events-none"
                />
              </button>
            )}
            <div className="flex items-center gap-space-sm px-space-sm py-space-sm">
              <span className="material-symbols-outlined text-outline">
                {isPdf(contentType, filename) ? 'picture_as_pdf' : 'description'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-body-sm text-on-surface truncate">{filename}</p>
                {sizeLabel && <p className="font-label-sm text-outline">{sizeLabel}</p>}
              </div>
              <button
                type="button"
                onClick={open}
                className="h-8 px-space-sm rounded-lg bg-surface-container-high text-on-surface font-label-sm hover:bg-surface-bright"
              >
                Önizle
              </button>
              <a
                href={url}
                download={filename}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container-high"
                aria-label="İndir"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
              </a>
            </div>
          </div>
        )}
      </div>
      <MediaLightbox attachment={lightbox ? attachment : null} onClose={() => setLightbox(false)} />
    </>
  );
}
