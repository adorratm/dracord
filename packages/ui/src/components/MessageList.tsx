'use client';

import type { MessageDto } from '@dracord/types';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';
import { MessageAttachmentView } from './MessageAttachmentView';

export interface MessageItemProps {
  message: MessageDto;
  compact?: boolean;
  showAvatar?: boolean;
  mentionNames?: string[];
  className?: string;
}

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

function renderMessageContent(content: string, mentionNames: string[]): ReactNode {
  if (isStickerOnly(content)) {
    return (
      <span className="text-5xl leading-none select-none" role="img" aria-label="sticker">
        {stickerGlyph(content)}
      </span>
    );
  }

  if (mentionNames.length === 0) {
    return content;
  }

  const pattern = new RegExp(
    `(@(?:${mentionNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`,
    'gi',
  );
  const parts = content.split(pattern);

  return parts.map((part, i) => {
    const isMention = mentionNames.some((n) => part.toLowerCase() === `@${n.toLowerCase()}`);
    if (isMention) {
      return (
        <span
          key={i}
          className="text-primary-container bg-primary-container/15 hover:bg-primary-container/25 rounded px-0.5 cursor-pointer transition-colors"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

export function MessageItem({
  message,
  compact = false,
  showAvatar = true,
  mentionNames = [],
  className,
}: MessageItemProps) {
  const author = message.author;
  const sticker = isStickerOnly(message.content);
  const hidePlainContent =
    sticker ||
    (message.attachments?.length === 1 &&
      !message.content.trim()) ||
    (message.attachments?.length === 1 &&
      message.attachments[0] &&
      message.content.trim() === message.attachments[0].filename);

  return (
    <article
      className={cn(
        'group flex gap-space-md px-space-md py-space-xs hover:bg-surface-container-low/60 transition-colors',
        compact && 'py-0.5',
        className,
      )}
    >
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
            {renderMessageContent(message.content, mentionNames)}
          </p>
        )}
        {sticker && hidePlainContent && (
          <div className="mt-1">{renderMessageContent(message.content, mentionNames)}</div>
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
      </div>
    </article>
  );
}

export interface MessageListProps {
  messages: MessageDto[];
  mentionNames?: string[];
  emptyState?: ReactNode;
  className?: string;
}

export function MessageList({ messages, mentionNames, emptyState, className }: MessageListProps) {
  if (messages.length === 0 && emptyState) {
    return (
      <div className={cn('flex-1 flex items-center justify-center text-outline', className)}>
        {emptyState}
      </div>
    );
  }

  return (
    <div
      className={cn('flex-1 overflow-y-auto min-h-0 py-space-md', className)}
      role="log"
      aria-live="polite"
    >
      {messages.map((message, index) => {
        const prev = messages[index - 1];
        const compact =
          !!prev &&
          prev.author.id === message.author.id &&
          new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;

        return (
          <MessageItem
            key={message.id}
            message={message}
            compact={compact}
            showAvatar={!compact}
            mentionNames={mentionNames}
          />
        );
      })}
    </div>
  );
}
