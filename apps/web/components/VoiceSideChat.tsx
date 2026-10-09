'use client';

import type { ChannelSummary } from '@dracord/types';
import { ChatInput, MessageList, Modal } from '@dracord/ui';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useChatChannel } from '@/hooks/useChatChannel';
import { useUserPreferences } from '@/lib/user-preferences';
import { useImageModeration } from '@/lib/use-image-moderation';

export function VoiceSideChat({
  guildId,
  textChannels,
  channelId,
  onChannelIdChange,
  onClose,
  onOpenDm,
}: {
  guildId: string;
  textChannels: ChannelSummary[];
  channelId: string | null;
  onChannelIdChange: (id: string) => void;
  onClose: () => void;
  onOpenDm?: () => void;
}) {
  const { user, client } = useAuth();
  const { prefs } = useUserPreferences();
  const imageModeration = useImageModeration();
  const effectiveId = channelId ?? textChannels[0]?.id ?? undefined;
  const {
    messages,
    loading,
    loadingOlder,
    hasMore,
    pendingNewCount,
    setAtLiveEdge,
    loadOlder,
    jumpToPresent,
    sendMessage,
    sendWithAttachments,
    sendMedia,
    sendPoll,
    votePoll,
    error,
    typingUsers,
    notifyTyping,
  } = useChatChannel(effectiveId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState('Evet\nHayır');
  const [headingOpen, setHeadingOpen] = useState(false);
  const [headingText, setHeadingText] = useState('');
  const [busy, setBusy] = useState(false);
  const active = textChannels.find((c) => c.id === effectiveId);
  const titleLabel = active ? `#${active.name}` : effectiveId ? 'Direkt mesaj' : 'Kanal seç';

  useEffect(() => {
    if (!channelId && textChannels[0]) {
      onChannelIdChange(textChannels[0].id);
    }
  }, [channelId, textChannels, onChannelIdChange]);

  const mentionNames = useMemo(() => {
    if (!user) return [] as string[];
    return [user.username, user.displayName].filter(Boolean);
  }, [user]);
  const channelNames = useMemo(
    () => textChannels.map((c) => c.name),
    [textChannels],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-11 px-space-sm flex items-center gap-space-xs border-b border-surface-container-high shrink-0">
        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            className="w-full h-8 px-space-sm rounded-lg bg-surface-container-highest text-left font-body-sm text-on-surface truncate flex items-center gap-1"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
          >
            <span className="truncate">{titleLabel}</span>
            <span className="material-symbols-outlined text-[16px] text-outline ml-auto">
              expand_more
            </span>
          </button>
          {pickerOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-surface-container-highest bg-surface-container-low shadow-float max-h-48 overflow-y-auto">
              {textChannels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full h-9 px-space-sm text-left font-body-sm hover:bg-surface-container truncate"
                  onClick={() => {
                    onChannelIdChange(c.id);
                    setPickerOpen(false);
                  }}
                >
                  #{c.name}
                </button>
              ))}
              {onOpenDm && (
                <button
                  type="button"
                  className="w-full h-9 px-space-sm text-left font-body-sm hover:bg-surface-container border-t border-surface-container-high flex items-center gap-1"
                  onClick={() => {
                    setPickerOpen(false);
                    onOpenDm();
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                  DM aç…
                </button>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container"
          aria-label="Sohbeti kapat"
          onClick={onClose}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {error && (
        <p className="px-space-sm py-1 text-error font-label-sm shrink-0">{error}</p>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        {loading && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-outline font-body-sm">
            Yükleniyor…
          </div>
        ) : !effectiveId ? (
          <div className="flex-1 flex items-center justify-center text-outline font-body-sm px-space-md text-center">
            Metin kanalı yok. Üye listesinden DM açabilirsin.
          </div>
        ) : (
          <MessageList
            scrollKey={effectiveId}
            messages={messages}
            mentionNames={mentionNames}
            channelNames={channelNames}
            imageModeration={imageModeration}
            censorLinkPreviews={Boolean(user?.censorLinkPreviews)}
            hideEmbeds={!prefs.messaging.autoEmbed}
            messageGrouping={
              prefs.accessibility.messageGrouping &&
              prefs.appearance.messageDensity !== 'compact'
            }
            dense={prefs.appearance.messageDensity === 'compact'}
            hour24={prefs.language.hour24}
            locale={prefs.language.locale === 'en' ? 'en-US' : 'tr-TR'}
            hasMore={hasMore}
            loadingOlder={loadingOlder}
            onLoadOlder={() => void loadOlder()}
            pendingNewCount={pendingNewCount}
            onJumpToPresent={() => void jumpToPresent()}
            onLiveEdgeChange={setAtLiveEdge}
            messageActions={{
              currentUserId: user?.id,
              guildId,
              developerMode: prefs.developer.developerMode,
              onReact: (m, emoji) => {
                void client.toggleReaction(m.id, emoji).catch(() => undefined);
              },
              onVotePoll: (m, optionId) => void votePoll(m.id, optionId),
            }}
          />
        )}
      </div>

      {effectiveId && (
        <div className="relative shrink-0 z-[100] border-t border-surface-container-high">
          {typingUsers.length > 0 && (
            <p className="px-space-sm pt-1 font-label-sm text-outline truncate">
              {typingUsers.length === 1
                ? `${typingUsers[0]!.username} yazıyor…`
                : `${typingUsers.length} kişi yazıyor…`}
            </p>
          )}
          <ChatInput
            key={effectiveId}
            channelName={active?.name}
            onSend={(text) => void sendMessage(text)}
            onAttachFiles={(files) => void sendWithAttachments(files)}
            onSendMedia={(payload) => void sendMedia(payload)}
            onPollClick={() => setPollOpen(true)}
            onHeadingClick={() => {
              setHeadingText('');
              setHeadingOpen(true);
            }}
            onTyping={notifyTyping}
            spellCheck={prefs.messaging.spellcheck}
            uploadStickerFile={async (file) => {
              const uploaded = await client.uploadFile(file, 'stickers');
              return { url: uploaded.url, contentType: uploaded.contentType };
            }}
          />
        </div>
      )}

      <Modal
        open={pollOpen}
        title="Anket oluştur"
        onClose={() => setPollOpen(false)}
        footer={
          <button
            type="button"
            disabled={busy || !pollQuestion.trim()}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
            onClick={() => {
              const options = pollOptions
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);
              if (options.length < 2) return;
              setBusy(true);
              void sendPoll(pollQuestion.trim(), options)
                .then(() => {
                  setPollOpen(false);
                  setPollQuestion('');
                  setPollOptions('Evet\nHayır');
                })
                .finally(() => setBusy(false));
            }}
          >
            Gönder
          </button>
        }
      >
        <label className="flex flex-col gap-space-xs mb-space-md">
          <span className="font-label-sm text-on-surface-variant">Soru</span>
          <input
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
            className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
          />
        </label>
        <label className="flex flex-col gap-space-xs">
          <span className="font-label-sm text-on-surface-variant">
            Seçenekler (her satır bir seçenek)
          </span>
          <textarea
            value={pollOptions}
            onChange={(e) => setPollOptions(e.target.value)}
            rows={4}
            className="w-full rounded-lg bg-surface-container-highest px-space-sm py-space-sm outline-none"
          />
        </label>
      </Modal>

      <Modal
        open={headingOpen}
        title="Bölüm başlığı"
        onClose={() => setHeadingOpen(false)}
        footer={
          <button
            type="button"
            disabled={busy || !headingText.trim()}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
            onClick={() => {
              const text = headingText.trim();
              if (!text) return;
              setBusy(true);
              void sendMessage(text, undefined, { type: 'heading' })
                .then(() => {
                  setHeadingOpen(false);
                  setHeadingText('');
                })
                .finally(() => setBusy(false));
            }}
          >
            Gönder
          </button>
        }
      >
        <input
          value={headingText}
          onChange={(e) => setHeadingText(e.target.value)}
          placeholder="Başlık metni"
          className="w-full h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
        />
      </Modal>
    </div>
  );
}
