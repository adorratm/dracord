import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import type {
  ChannelSummary,
  GifDto,
  MessageAttachment,
  MessageDto,
  MessageEmbed,
  MessageEmbedAction,
} from '@dracord/types';
import { SocketEvents } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';
import {
  addCustomSticker,
  getLocalStickers,
  loadStickersFromDisk,
  removeCustomSticker,
  syncStickersWithCloud,
  touchRecentSticker,
  type MobileSticker,
} from '../lib/sticker-sync';
import { resolveMediaUrl } from '../lib/mediaUrl';
import { uploadImageFromUri } from '../lib/uploadMobile';
import { inputStyle, primaryBtn, primaryBtnText } from '../lib/ui';
import { Icon } from './Icon';
import { UserAvatar } from './UserAvatar';
import {
  ForwardPickerSheet,
  MessageActionsSheet,
  type MessageActionId,
} from './MessageActionsSheet';

const QUICK_EMOJI = ['👍', '❤️', '😂', '🔥', '😮', '😢', '🎉', '👀'];

type ChatRow = { m: MessageDto; showDay: boolean; day: string };

function isStickerOnly(content: string): boolean {
  const t = content.trim();
  return /^sticker:\S+$/u.test(t) || /^\p{Extended_Pictographic}$/u.test(t);
}

function stickerGlyph(content: string): string {
  const t = content.trim();
  if (t.startsWith('sticker:')) return t.slice('sticker:'.length);
  return t;
}

function isMediaUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith('data:image') || value.startsWith('/');
}

export function ChatView({
  channel,
  hideChannelChrome,
  aroundMessageId,
  guildId,
}: {
  channel: ChannelSummary;
  /** ShellHeader zaten kanal adını gösteriyorsa üst çubuğu gizle */
  hideChannelChrome?: boolean;
  /** Arama sonucu: bu mesaj civarını yükle */
  aroundMessageId?: string | null;
  guildId?: string | null;
}) {
  const { client, user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
  const [editing, setEditing] = useState<MessageDto | null>(null);
  const [pins, setPins] = useState<MessageDto[]>([]);
  const [showPins, setShowPins] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(aroundMessageId ?? null);
  const [threadRoot, setThreadRoot] = useState<MessageDto | null>(null);
  const [threadMsgs, setThreadMsgs] = useState<MessageDto[]>([]);
  const [threadDraft, setThreadDraft] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState('Evet\nHayır');
  const [panel, setPanel] = useState<'none' | 'stickers' | 'gifs' | 'emoji'>('none');
  const [stickers, setStickers] = useState<MobileSticker[]>([]);
  const [gifs, setGifs] = useState<GifDto[]>([]);
  const [gifQuery, setGifQuery] = useState('');
  const [gifBusy, setGifBusy] = useState(false);
  const [pendingAtt, setPendingAtt] = useState<MessageAttachment | null>(null);
  const [emojiDraft, setEmojiDraft] = useState('');
  const [emojiModal, setEmojiModal] = useState(false);
  const [menuMessage, setMenuMessage] = useState<MessageDto | null>(null);
  const [forwardMessage, setForwardMessage] = useState<MessageDto | null>(null);
  const [forwardChannels, setForwardChannels] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const listRef = useRef<FlatList<ChatRow>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = user?.id;

  const refreshStickers = useCallback(() => {
    void loadStickersFromDisk().then((s) => setStickers(s.custom));
    void syncStickersWithCloud(client).then(setStickers);
  }, [client]);

  useEffect(() => {
    refreshStickers();
  }, [refreshStickers]);

  useEffect(() => {
    if (!highlightId || messages.length === 0) return;
    const idx = messages.findIndex((m) => m.id === highlightId);
    if (idx < 0) return;
    const t = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.4 });
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [highlightId, messages]);

  useEffect(() => {
    setMessages([]);
    setReplyTo(null);
    setEditing(null);
    setText('');
    setShowPins(false);
    setHighlightId(aroundMessageId ?? null);
    client.joinChannel(channel.id);
    const around = aroundMessageId || undefined;
    void client
      .getMessages(channel.id, around ? { limit: 50, around } : 50)
      .then((page) => {
        // API ASC (eski→yeni); inverted list için yeni→eski saklarız
        const items = page.items ?? [];
        setMessages([...items].filter((m) => !m.viewerHide).reverse());
        if (around) setHighlightId(around);
      });
    void client.listPinnedMessages(channel.id).then(setPins).catch(() => setPins([]));
    const sock = client.connectSocket();
    const onMsg = (msg: MessageDto) => {
      if (msg.channelId !== channel.id) return;
      if (msg.viewerHide) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev]));
    };
    const onUpdate = (msg: MessageDto) => {
      if (msg.channelId !== channel.id) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    };
    const onDelete = (payload: { id: string; channelId: string }) => {
      if (payload.channelId !== channel.id) return;
      setMessages((prev) => prev.filter((m) => m.id !== payload.id));
    };
    const onTyping = (payload: {
      channelId: string;
      user?: { displayName?: string; id?: string };
    }) => {
      if (payload.channelId !== channel.id) return;
      if (payload.user?.id === userId) return;
      const name = payload.user?.displayName ?? 'Biri';
      setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
      setTimeout(() => setTypingUsers((prev) => prev.filter((n) => n !== name)), 3000);
    };
    sock.on(SocketEvents.MESSAGE_CREATE, onMsg);
    sock.on(SocketEvents.MESSAGE_UPDATE, onUpdate);
    sock.on(SocketEvents.MESSAGE_DELETE, onDelete);
    sock.on(SocketEvents.TYPING_START, onTyping);
    return () => {
      sock.off(SocketEvents.MESSAGE_CREATE, onMsg);
      sock.off(SocketEvents.MESSAGE_UPDATE, onUpdate);
      sock.off(SocketEvents.MESSAGE_DELETE, onDelete);
      sock.off(SocketEvents.TYPING_START, onTyping);
      client.leaveChannel(channel.id);
    };
  }, [client, channel.id, userId, aroundMessageId]);

  /** inverted: index 0 = en yeni (görsel alt); index+1 = daha eski */
  const chatRows = useMemo<ChatRow[]>(() => {
    return messages.map((m, index) => {
      const day = new Date(m.createdAt).toLocaleDateString('tr-TR');
      const older = messages[index + 1];
      const showDay =
        !older || new Date(older.createdAt).toLocaleDateString('tr-TR') !== day;
      return { m, showDay, day };
    });
  }, [messages]);

  const onReplyMsg = useCallback((m: MessageDto) => setReplyTo(m), []);
  const onEditMsg = useCallback((m: MessageDto) => {
    setEditing(m);
    setText(m.content);
  }, []);
  const onDeleteMsg = useCallback(
    (m: MessageDto) => {
      Alert.alert('Mesaj', 'Mesaj silinsin mi?', [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => void client.deleteMessage(m.id),
        },
      ]);
    },
    [client],
  );
  const onPinMsg = useCallback(
    (m: MessageDto) => {
      void (m.pinnedAt ? client.unpinMessage(m.id) : client.pinMessage(m.id)).then(() =>
        client.listPinnedMessages(channel.id).then(setPins),
      );
    },
    [client, channel.id],
  );
  const onReactMsg = useCallback(
    (m: MessageDto, emoji: string) => {
      void client.toggleReaction(m.id, emoji);
    },
    [client],
  );
  const onThreadMsg = useCallback(
    (m: MessageDto) => {
      setThreadRoot(m);
      void client.getMessageThread(m.id).then((page) => setThreadMsgs(page.items ?? []));
    },
    [client],
  );
  const onVoteMsg = useCallback(
    (m: MessageDto, optId: string) => {
      void client.votePoll(m.id, optId);
    },
    [client],
  );

  const onEmbedAction = useCallback(
    (m: MessageDto, action: MessageEmbedAction, embed: MessageEmbed) => {
      if (action.action === 'replay' && (embed.url || action.url)) {
        const url = action.url || embed.url;
        void client
          .sendMessage(channel.id, `/oynat ${url}`)
          .then(() => Alert.alert('Müzik', 'Tekrar kuyruğa eklendi'))
          .catch((e) => Alert.alert('Müzik', e instanceof Error ? e.message : 'Başarısız'));
        return;
      }
      if (action.action === 'lyrics') {
        Alert.alert('Şarkı sözleri', 'Şarkı sözleri yakında.');
        return;
      }
      const openUrl = action.url || embed.url;
      if (openUrl) void Linking.openURL(openUrl);
    },
    [client, channel.id],
  );

  const openMessageMenu = useCallback((m: MessageDto) => {
    setMenuMessage(m);
  }, []);

  const handleMessageAction = useCallback(
    (id: MessageActionId, m: MessageDto) => {
      switch (id) {
        case 'reply':
          onReplyMsg(m);
          break;
        case 'quote-reply':
          setReplyTo(m);
          setText((prev) => {
            const quote = `> ${ (m.content || '').split('\n').join('\n> ') }\n\n`;
            return prev ? `${quote}${prev}` : quote;
          });
          break;
        case 'forward': {
          const gid = channel.guildId;
          if (!gid) {
            Alert.alert('İlet', 'Şu an yalnızca sunucu kanallarına iletim destekleniyor.');
            break;
          }
          void client
            .getGuildChannels(gid)
            .then((chs) => {
              setForwardChannels(
                chs
                  .filter((c) => (c.type === 'TEXT' || c.type === 'FORUM') && c.id !== channel.id)
                  .map((c) => ({ id: c.id, name: c.name })),
              );
              setForwardMessage(m);
            })
            .catch((e) =>
              Alert.alert('İlet', e instanceof Error ? e.message : 'Kanallar yüklenemedi'),
            );
          break;
        }
        case 'heading':
          void client
            .sendMessage(channel.id, (m.content || 'Başlık').slice(0, 120), undefined, undefined, {
              type: 'heading',
            })
            .catch((e) =>
              Alert.alert('Alt başlık', e instanceof Error ? e.message : 'Oluşturulamadı'),
            );
          break;
        case 'thread':
          onThreadMsg(m);
          break;
        case 'pin':
          onPinMsg(m);
          break;
        case 'bookmark':
          void (m.bookmarked
            ? client.unbookmarkMessage(m.id)
            : client.bookmarkMessage(m.id)
          ).catch((e) => Alert.alert('Yer imi', e instanceof Error ? e.message : 'Hata'));
          break;
        case 'copy-content':
          void Clipboard.setStringAsync(m.content || '').then(() =>
            Alert.alert('Kopyalandı', 'Mesaj içeriği panoya alındı'),
          );
          break;
        case 'copy-attach':
          if (m.attachments?.[0]?.url) {
            void Clipboard.setStringAsync(m.attachments[0].url).then(() =>
              Alert.alert('Kopyalandı', 'Ek bağlantısı panoya alındı'),
            );
          }
          break;
        case 'copy-poll':
          if (m.poll) {
            const text = [
              m.poll.question,
              ...m.poll.options.map((o) => `• ${o.text}: ${o.voteCount}`),
            ].join('\n');
            void Clipboard.setStringAsync(text);
          }
          break;
        case 'mark-unread':
          void client
            .markChannelRead(channel.id, { messageId: m.id, unreadFrom: true })
            .then(() => Alert.alert('Okunmadı', 'Kanal okunmadı olarak işaretlendi'))
            .catch(() => undefined);
          break;
        case 'copy-link': {
          const link = m.channelId
            ? `https://dracord.com.tr/channels/${channel.guildId ?? '@me'}/${m.channelId}?around=${m.id}`
            : m.id;
          void Clipboard.setStringAsync(link).then(() =>
            Alert.alert('Kopyalandı', 'Bağlantı panoya alındı'),
          );
          break;
        }
        case 'interactions': {
          const reactions =
            (m.reactions ?? []).map((r) => `${r.emoji} ${r.count}`).join(', ') || 'yok';
          Alert.alert(
            'Etkileşim bilgileri',
            `Yazar: ${m.author?.displayName ?? '?'}\nID: ${m.id}\nTepki: ${reactions}\nZaman: ${new Date(m.createdAt).toLocaleString('tr-TR')}`,
            [
              {
                text: 'Bilgiyi kopyala',
                onPress: () => {
                  void Clipboard.setStringAsync(
                    [
                      `Mesaj: ${m.id}`,
                      `Yazar: ${m.author?.displayName ?? '?'} (${m.author?.id ?? ''})`,
                      `Tepki: ${reactions}`,
                      `Zaman: ${m.createdAt}`,
                    ].join('\n'),
                  );
                },
              },
              { text: 'Tamam' },
            ],
          );
          break;
        }
        case 'edit':
          onEditMsg(m);
          break;
        case 'delete':
          onDeleteMsg(m);
          break;
        case 'hide':
          void client.hideMessage(m.id).then(() => {
            setMessages((prev) => prev.filter((x) => x.id !== m.id));
          });
          break;
        case 'report':
          void client.hideMessage(m.id, true).then(() => {
            setMessages((prev) => prev.filter((x) => x.id !== m.id));
            Alert.alert('Bildirildi', 'Mesaj bildirildi ve gizlendi.');
          });
          break;
        case 'block':
          if (!m.author?.id) break;
          Alert.alert('Engelle', `${m.author.displayName} engellensin mi?`, [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Engelle',
              style: 'destructive',
              onPress: () => {
                void client.blockUser(m.author.id).then(() =>
                  client.hideMessage(m.id, true).then(() => {
                    setMessages((prev) => prev.filter((x) => x.id !== m.id));
                  }),
                );
              },
            },
          ]);
          break;
        case 'copy-id':
          void Clipboard.setStringAsync(m.id).then(() =>
            Alert.alert('Kopyalandı', 'Mesaj ID panoya alındı'),
          );
          break;
        case 'copy-user-id':
          if (m.author?.id) {
            void Clipboard.setStringAsync(m.author.id).then(() =>
              Alert.alert('Kopyalandı', 'Kullanıcı ID panoya alındı'),
            );
          }
          break;
        default:
          break;
      }
    },
    [
      client,
      channel.id,
      channel.guildId,
      onReplyMsg,
      onThreadMsg,
      onPinMsg,
      onEditMsg,
      onDeleteMsg,
    ],
  );

  const renderMessage = useCallback(
    ({ item }: ListRenderItemInfo<ChatRow>) => (
      <View style={{ paddingHorizontal: 12 }}>
        <MessageRow
          m={item.m}
          mine={item.m.author?.id === userId}
          avatarFallback={
            channel.peerUserId && item.m.author?.id === channel.peerUserId
              ? channel.peerAvatarUrl
              : null
          }
          onReply={onReplyMsg}
          onEdit={onEditMsg}
          onDelete={onDeleteMsg}
          onPin={onPinMsg}
          onReact={onReactMsg}
          onThread={onThreadMsg}
          onVote={onVoteMsg}
          onEmbedAction={onEmbedAction}
          onLongPress={openMessageMenu}
        />
        {item.showDay ? (
          <Text
            style={{
              textAlign: 'center',
              color: colors.textMuted,
              fontSize: 12,
              marginVertical: 12,
            }}
          >
            {item.day}
          </Text>
        ) : null}
      </View>
    ),
    [
      userId,
      channel.peerUserId,
      channel.peerAvatarUrl,
      onReplyMsg,
      onEditMsg,
      onDeleteMsg,
      onPinMsg,
      onReactMsg,
      onThreadMsg,
      onVoteMsg,
      onEmbedAction,
      openMessageMenu,
    ],
  );

  const send = async (content: string, attachments?: MessageAttachment[]) => {
    setBusy(true);
    try {
      if (editing) {
        await client.updateMessage(editing.id, content);
        setEditing(null);
        setText('');
        return;
      }
      await client.sendMessage(channel.id, content, attachments, undefined, {
        replyToId: replyTo?.id,
        threadRootId: threadRoot?.id,
      });
      setText('');
      setReplyTo(null);
      setPendingAtt(null);
      if (threadRoot) {
        const page = await client.getMessageThread(threadRoot.id);
        setThreadMsgs(page.items ?? []);
      }
    } finally {
      setBusy(false);
    }
  };

  const sendComposer = async () => {
    const content = text.trim();
    if (pendingAtt) {
      await send(content || pendingAtt.filename, [pendingAtt]);
      return;
    }
    if (!content) return;
    await send(content);
  };

  const sendSticker = async (s: MobileSticker) => {
    setPanel('none');
    void touchRecentSticker(client, s.id);
    await send(`sticker:${s.value}`);
  };

  const sendGif = async (gif: GifDto) => {
    setPanel('none');
    const att: MessageAttachment = {
      id: gif.id,
      url: gif.url,
      filename: `${gif.label || 'gif'}.gif`,
      contentType: 'image/gif',
      size: 0,
    };
    await send(gif.label || 'GIF', [att]);
  };

  const openGifs = async () => {
    setPanel((p) => (p === 'gifs' ? 'none' : 'gifs'));
    setGifBusy(true);
    try {
      const list = await client.featuredGifs();
      setGifs(list);
    } catch {
      setGifs([]);
      Alert.alert('GIF', 'GIF listesi yüklenemedi.');
    } finally {
      setGifBusy(false);
    }
  };

  const searchGifs = async () => {
    if (!gifQuery.trim()) {
      void openGifs();
      return;
    }
    setGifBusy(true);
    try {
      setGifs(await client.searchGifs(gifQuery.trim()));
    } catch {
      Alert.alert('GIF', 'Arama başarısız.');
    } finally {
      setGifBusy(false);
    }
  };

  const pickImage = async (asSticker = false) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Galeri erişimi olmadan görsel yüklenemez.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: asSticker ? 0.9 : 0.85,
      allowsEditing: asSticker,
      aspect: asSticker ? [1, 1] : undefined,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setBusy(true);
    try {
      const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
      const mime = asset.mimeType ?? 'image/jpeg';
      if (asSticker) {
        const att = await uploadImageFromUri(client, asset.uri, name, mime, 'stickers');
        const next = await addCustomSticker(client, {
          kind: 'image',
          value: att.url,
          label: name,
          contentType: mime,
        });
        setStickers(next);
        Alert.alert('Sticker', 'Sticker eklendi.');
      } else {
        const att = await uploadImageFromUri(client, asset.uri, name, mime, 'attachments');
        setPendingAtt(att);
      }
    } catch (e) {
      Alert.alert('Yükleme', e instanceof Error ? e.message : 'Görsel yüklenemedi');
    } finally {
      setBusy(false);
    }
  };

  const addEmojiSticker = () => {
    setEmojiDraft('');
    setEmojiModal(true);
  };

  const canSend = Boolean(text.trim() || pendingAtt) && !busy;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {!hideChannelChrome ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.surfaceHigh,
          }}
        >
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="tag" size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '700' }}>{channel.name}</Text>
          </View>
          <Pressable
            onPress={() => {
              router.push({
                pathname: '/(app)/search',
                params: {
                  scope: 'messages',
                  channelId: channel.id,
                  guildId: guildId ?? '',
                },
              });
            }}
            style={{ ...chipBtn, marginRight: 6 }}
            accessibilityLabel="Mesajlarda ara"
          >
            <Icon name="search" size={16} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => {
              setShowPins((v) => !v);
              void client.listPinnedMessages(channel.id).then(setPins);
            }}
            style={{ ...chipBtn, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Icon name="push_pin" size={16} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '600' }}>{pins.length}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 6, gap: 6 }}>
          <Pressable
            onPress={() => {
              router.push({
                pathname: '/(app)/search',
                params: {
                  scope: 'messages',
                  channelId: channel.id,
                  guildId: guildId ?? '',
                },
              });
            }}
            style={chipBtn}
            accessibilityLabel="Mesajlarda ara"
          >
            <Icon name="search" size={14} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => {
              setShowPins((v) => !v);
              void client.listPinnedMessages(channel.id).then(setPins);
            }}
            style={{ ...chipBtn, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Icon name="push_pin" size={14} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 12 }}>{pins.length}</Text>
          </Pressable>
        </View>
      )}

      {showPins ? (
        <ScrollView
          style={{
            maxHeight: 120,
            borderBottomWidth: 1,
            borderBottomColor: colors.surfaceHigh,
            padding: 8,
          }}
        >
          {pins.map((p) => (
            <Text key={p.id} style={{ color: colors.text, fontSize: 13, marginBottom: 4 }}>
              <Text style={{ fontWeight: '700' }}>{p.author?.displayName}</Text>: {p.content}
            </Text>
          ))}
          {pins.length === 0 ? <Text style={{ color: colors.textMuted }}>Pin yok</Text> : null}
        </ScrollView>
      ) : null}

      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={chatRows}
        keyExtractor={(row) => row.m.id}
        inverted
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: 8,
          paddingBottom: 4,
        }}
        renderItem={renderMessage}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={16}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={9}
        maintainVisibleContentPosition={
          Platform.OS === 'ios'
            ? { minIndexForVisible: 0, autoscrollToTopThreshold: 40 }
            : undefined
        }
      />

      {typingUsers.length > 0 ? (
        <Text style={{ paddingHorizontal: 16, paddingBottom: 4, fontSize: 12, color: colors.textMuted }}>
          {typingUsers.join(', ')} yazıyor…
        </Text>
      ) : null}

      {(replyTo || editing) && (
        <View style={composerBanner}>
          <Text style={{ color: colors.text, fontSize: 13, flex: 1 }} numberOfLines={2}>
            {editing ? 'Düzenleniyor' : `Yanıt: ${replyTo?.author?.displayName}`} —{' '}
            {(editing ?? replyTo)?.content.slice(0, 60)}
          </Text>
          <Pressable
            onPress={() => {
              setReplyTo(null);
              setEditing(null);
              setText('');
            }}
            hitSlop={8}
            accessibilityLabel="İptal"
          >
            <Icon name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {pendingAtt ? (
        <View style={composerBanner}>
          <Image
            source={{ uri: pendingAtt.url }}
            style={{ width: 48, height: 48, borderRadius: 8 }}
            resizeMode="cover"
          />
          <Text style={{ color: colors.text, flex: 1, marginLeft: 8 }} numberOfLines={1}>
            {pendingAtt.filename}
          </Text>
          <Pressable onPress={() => setPendingAtt(null)}>
            <Text style={{ color: colors.danger }}>Kaldır</Text>
          </Pressable>
        </View>
      ) : null}

      {pollOpen ? (
        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.surfaceHigh, backgroundColor: colors.surface }}>
          <TextInput
            value={pollQ}
            onChangeText={setPollQ}
            placeholder="Anket sorusu"
            placeholderTextColor={colors.textMuted}
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <TextInput
            value={pollOpts}
            onChangeText={setPollOpts}
            placeholder="Seçenekler (satır satır)"
            placeholderTextColor={colors.textMuted}
            multiline
            style={{
              ...inputStyle,
              height: 72,
              paddingVertical: 8,
              marginBottom: 8,
              textAlignVertical: 'top',
            }}
          />
          <Pressable
            style={primaryBtn}
            onPress={() => {
              const options = pollOpts
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);
              if (!pollQ.trim() || options.length < 2) return;
              setBusy(true);
              void client
                .sendMessage(channel.id, pollQ.trim(), undefined, {
                  question: pollQ.trim(),
                  options,
                })
                .then(() => {
                  setPollOpen(false);
                  setPollQ('');
                  setPollOpts('Evet\nHayır');
                })
                .finally(() => setBusy(false));
            }}
          >
            <Text style={primaryBtnText}>Anket gönder</Text>
          </Pressable>
        </View>
      ) : null}

      {panel === 'stickers' ? (
        <View style={mediaPanel}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Pressable style={chipBtn} onPress={() => void pickImage(true)}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>+ Görsel</Text>
            </Pressable>
            <Pressable style={chipBtn} onPress={addEmojiSticker}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>+ Emoji</Text>
            </Pressable>
            <Pressable
              style={chipBtn}
              onPress={() => {
                setStickers(getLocalStickers());
                void syncStickersWithCloud(client).then(setStickers);
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>Yenile</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {stickers.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Sticker yok — + ile ekle</Text>
            ) : (
              stickers.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => void sendSticker(s)}
                  onLongPress={() => {
                    Alert.alert('Sticker', s.label, [
                      { text: 'İptal', style: 'cancel' },
                      {
                        text: 'Sil',
                        style: 'destructive',
                        onPress: () => void removeCustomSticker(client, s.id).then(setStickers),
                      },
                    ]);
                  }}
                  style={stickerCell}
                >
                  {s.kind === 'image' ? (
                    <RemoteImage uri={s.value} style={{ width: 56, height: 56 }} />
                  ) : (
                    <Text style={{ fontSize: 28 }}>{s.value}</Text>
                  )}
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}

      {panel === 'gifs' ? (
        <View style={[mediaPanel, { maxHeight: 220 }]}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <TextInput
              value={gifQuery}
              onChangeText={setGifQuery}
              placeholder="GIF ara…"
              placeholderTextColor={colors.textMuted}
              style={{ ...inputStyle, flex: 1, height: 40 }}
              onSubmitEditing={() => void searchGifs()}
              returnKeyType="search"
            />
            <Pressable style={chipBtn} onPress={() => void searchGifs()}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Ara</Text>
            </Pressable>
          </View>
          {gifBusy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {gifs.length === 0 ? (
                <Text style={{ color: colors.textMuted }}>GIF bulunamadı</Text>
              ) : (
                gifs.map((g) => (
                  <Pressable key={g.id} onPress={() => void sendGif(g)} style={stickerCell}>
                    <RemoteImage uri={g.previewUrl || g.url} style={{ width: 96, height: 72 }} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          )}
        </View>
      ) : null}

      {panel === 'emoji' ? (
        <View style={mediaPanel}>
          <ScrollView horizontal contentContainerStyle={{ gap: 6 }}>
            {QUICK_EMOJI.map((e) => (
              <Pressable
                key={e}
                onPress={() => setText((t) => t + e)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: colors.surfaceHigh,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Web ChatInput benzeri alt araç çubuğu */}
      <View style={composerBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
          <ToolBtn icon="add_circle" onPress={() => void pickImage(false)} accessibilityLabel="Dosya ekle" />
          <ToolBtn
            icon="gif_box"
            active={panel === 'gifs'}
            onPress={() => void openGifs()}
            accessibilityLabel="GIF"
          />
          <ToolBtn
            icon="sticky_note_2"
            active={panel === 'stickers'}
            onPress={() => {
              setPanel((p) => (p === 'stickers' ? 'none' : 'stickers'));
              refreshStickers();
            }}
            accessibilityLabel="Sticker"
          />
          <ToolBtn
            icon="sentiment_satisfied"
            active={panel === 'emoji'}
            onPress={() => setPanel((p) => (p === 'emoji' ? 'none' : 'emoji'))}
            accessibilityLabel="Emoji"
          />
          <ToolBtn
            icon="ballot"
            active={pollOpen}
            onPress={() => setPollOpen((v) => !v)}
            accessibilityLabel="Anket"
          />
        </ScrollView>
      </View>

      <View style={composerInputRow}>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            client.startTyping(channel.id);
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => {
              /* typing TTL sunucuda */
            }, 2500);
          }}
          placeholder={`#${channel.name} kanalına mesaj`}
          placeholderTextColor={colors.textMuted}
          style={{ ...inputStyle, flex: 1, minHeight: 44, maxHeight: 120, paddingVertical: 10 }}
          multiline
        />
        <Pressable
          disabled={!canSend}
          onPress={() => void sendComposer()}
          style={{
            ...primaryBtn,
            width: 52,
            paddingHorizontal: 0,
            opacity: canSend ? 1 : 0.45,
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryOn} />
          ) : (
            <Icon name={editing ? 'check' : 'send'} size={22} color={colors.primaryOn} />
          )}
        </Pressable>
      </View>

      <Modal visible={emojiModal} animationType="fade" transparent onRequestClose={() => setEmojiModal(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}
          onPress={() => setEmojiModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, gap: 10 }}
          >
            <Text style={{ color: colors.text, fontWeight: '800' }}>Emoji sticker</Text>
            <TextInput
              value={emojiDraft}
              onChangeText={setEmojiDraft}
              placeholder="örn. 🔥"
              placeholderTextColor={colors.textMuted}
              style={inputStyle}
              autoFocus
            />
            <Pressable
              style={primaryBtn}
              onPress={() => {
                const v = emojiDraft.trim();
                if (!v) return;
                void addCustomSticker(client, { kind: 'emoji', value: v, label: v }).then((list) => {
                  setStickers(list);
                  setEmojiModal(false);
                });
              }}
            >
              <Text style={primaryBtnText}>Ekle</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!threadRoot} animationType="slide" onRequestClose={() => setThreadRoot(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'ios' ? 48 : 16 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.surfaceHigh,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>Thread</Text>
            <Pressable
              onPress={() => {
                setThreadRoot(null);
                setThreadMsgs([]);
                setThreadDraft('');
              }}
            >
              <Text style={{ color: colors.textMuted }}>Kapat</Text>
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1, padding: 12 }}>
            {threadRoot ? (
              <MessageRow
                m={threadRoot}
                mine={threadRoot.author?.id === user?.id}
                avatarFallback={
                  channel.peerUserId && threadRoot.author?.id === channel.peerUserId
                    ? channel.peerAvatarUrl
                    : null
                }
                compact
                onReply={onReplyMsg}
                onReact={onReactMsg}
                onEmbedAction={onEmbedAction}
                onLongPress={openMessageMenu}
              />
            ) : null}
            {threadMsgs.map((m) => (
              <MessageRow
                key={m.id}
                m={m}
                mine={m.author?.id === user?.id}
                avatarFallback={
                  channel.peerUserId && m.author?.id === channel.peerUserId
                    ? channel.peerAvatarUrl
                    : null
                }
                compact
                onReply={onReplyMsg}
                onReact={onReactMsg}
                onEmbedAction={onEmbedAction}
                onLongPress={openMessageMenu}
              />
            ))}
          </ScrollView>
          <View style={composerInputRow}>
            <TextInput
              value={threadDraft}
              onChangeText={setThreadDraft}
              placeholder="Thread’e yanıt…"
              placeholderTextColor={colors.textMuted}
              style={{ ...inputStyle, flex: 1 }}
            />
            <Pressable
              style={primaryBtn}
              onPress={() => {
                const c = threadDraft.trim();
                if (!c || !threadRoot) return;
                void client
                  .sendMessage(channel.id, c, undefined, undefined, {
                    threadRootId: threadRoot.id,
                  })
                  .then(() => {
                    setThreadDraft('');
                    return client.getMessageThread(threadRoot.id);
                  })
                  .then((page) => setThreadMsgs(page.items ?? []));
              }}
            >
              <Text style={primaryBtnText}>Gönder</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <MessageActionsSheet
        message={menuMessage}
        mine={menuMessage?.author?.id === userId}
        onClose={() => setMenuMessage(null)}
        onAction={handleMessageAction}
        onReact={onReactMsg}
      />
      <ForwardPickerSheet
        open={Boolean(forwardMessage)}
        channels={forwardChannels}
        onClose={() => {
          setForwardMessage(null);
          setForwardChannels([]);
        }}
        onPick={(targetChannelId, note) => {
          if (!forwardMessage) return;
          void client
            .forwardMessage(forwardMessage.id, targetChannelId, note)
            .then(() => Alert.alert('İletildi', 'Mesaj seçilen kanala iletildi'))
            .catch((e) => Alert.alert('İlet', e instanceof Error ? e.message : 'İletilemedi'));
        }}
      />
    </KeyboardAvoidingView>
  );
}

function RemoteImage({
  uri,
  style,
}: {
  uri: string;
  style: { width: number; height: number; borderRadius?: number };
}) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveMediaUrl(uri);
  if (!resolved || failed) {
    return (
      <View
        style={{
          ...style,
          backgroundColor: colors.surfaceHigh,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>görsel</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: resolved }}
      style={{ ...style, borderRadius: style.borderRadius ?? 8, backgroundColor: colors.surfaceHigh }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

const MessageRow = memo(function MessageRow({
  m,
  mine,
  avatarFallback,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onThread,
  onVote,
  onEmbedAction,
  onLongPress,
  compact,
}: {
  m: MessageDto;
  mine: boolean;
  /** DM peer avatar — author.avatarUrl boşsa */
  avatarFallback?: string | null;
  onReply?: (m: MessageDto) => void;
  onEdit?: (m: MessageDto) => void;
  onDelete?: (m: MessageDto) => void;
  onPin?: (m: MessageDto) => void;
  onReact?: (m: MessageDto, emoji: string) => void;
  onThread?: (m: MessageDto) => void;
  onVote?: (m: MessageDto, optionId: string) => void;
  onEmbedAction?: (m: MessageDto, action: MessageEmbedAction, embed: MessageEmbed) => void;
  onLongPress?: (m: MessageDto) => void;
  compact?: boolean;
}) {
  const sticker = isStickerOnly(m.content);
  const glyph = sticker ? stickerGlyph(m.content) : '';
  const stickerMedia = sticker && isMediaUrl(glyph);
  const gap = compact ? 8 : 12;

  return (
    <Pressable
      onLongPress={() => onLongPress?.(m)}
      delayLongPress={280}
      style={{ marginTop: gap, flexDirection: 'row', gap: 10, opacity: m.viewerHide ? 0.45 : 1 }}
    >
      <UserAvatar
        displayName={m.author?.displayName ?? '?'}
        imageUrl={m.author?.avatarUrl || avatarFallback}
        size={compact ? 28 : 36}
        statusRing={false}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
            {m.author?.displayName ?? 'üye'}
            {mine ? ' (sen)' : ''}
          </Text>
          <Text style={{ color: colors.textMuted, fontWeight: '400', fontSize: 11 }}>
            {new Date(m.createdAt).toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {m.pinnedAt ? <Icon name="push_pin" size={12} color={colors.textMuted} /> : null}
          {m.bookmarked ? <Icon name="bookmark" size={12} color={colors.primary} /> : null}
        </View>
        {m.replyTo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <Icon name="reply" size={14} color={colors.textMuted} />
            <Text style={{ fontSize: 12, color: colors.textMuted, flex: 1 }} numberOfLines={1}>
              {m.replyTo.authorName}: {m.replyTo.contentPreview}
            </Text>
          </View>
        ) : null}
        {m.forwardedFrom ? (
          <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
            İletildi · {m.forwardedFrom.authorName}
          </Text>
        ) : null}

        {sticker ? (
          stickerMedia ? (
            <RemoteImage uri={glyph} style={{ width: 160, height: 160, borderRadius: 12 }} />
          ) : (
            <Text style={{ fontSize: 48, marginTop: 4 }}>{glyph}</Text>
          )
        ) : m.content ? (
          <Text style={{ color: colors.text, lineHeight: 20 }}>{m.content}</Text>
        ) : null}

        {m.attachments?.map((a) =>
          a.contentType?.startsWith('image/') || /\.(gif|png|jpe?g|webp)(\?|$)/i.test(a.url) ? (
            <RemoteImage
              key={a.id}
              uri={a.url}
              style={{
                width: a.contentType === 'image/gif' ? 240 : 280,
                height: a.contentType === 'image/gif' ? 160 : 180,
                borderRadius: 8,
              }}
            />
          ) : (
            <Text key={a.id} style={{ color: colors.primary, marginTop: 4 }}>
              {a.filename}
            </Text>
          ),
        )}

        {m.embeds?.map((embed, idx) => (
          <EmbedCard
            key={`${embed.url}-${idx}`}
            embed={embed}
            onAction={(action) => onEmbedAction?.(m, action, embed)}
          />
        ))}

        {m.poll ? (
          <View
            style={{
              marginTop: 8,
              padding: 10,
              backgroundColor: colors.surfaceHigh,
              borderRadius: 10,
              maxWidth: 320,
            }}
          >
            <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 6 }}>
              {m.poll.question}
            </Text>
            {m.poll.options.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => onVote?.(m, opt.id)}
                style={{
                  marginBottom: 4,
                  borderRadius: 6,
                  padding: 8,
                  backgroundColor: colors.surface,
                }}
              >
                <Text style={{ color: colors.text }}>
                  {opt.text} · {opt.voteCount}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {m.reactions && m.reactions.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {m.reactions.map((r) => (
              <Pressable
                key={r.emoji}
                onPress={() => onReact?.(m, r.emoji)}
                style={{
                  borderRadius: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  backgroundColor: colors.surfaceHigh,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 12 }}>
                  {r.emoji} {r.count}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!compact ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 2,
              marginTop: 4,
              alignItems: 'center',
            }}
          >
            {QUICK_EMOJI.slice(0, 3).map((e) => (
              <Mini key={e} onPress={() => onReact?.(m, e)}>
                {e}
              </Mini>
            ))}
            <MiniIcon name="reply" onPress={() => onReply?.(m)} accessibilityLabel="Yanıt" />
            <MiniIcon name="forum" onPress={() => onThread?.(m)} accessibilityLabel="Thread" />
            <MiniIcon name="push_pin" onPress={() => onPin?.(m)} accessibilityLabel="Pin" />
            <MiniIcon
              name="more_horiz"
              onPress={() => onLongPress?.(m)}
              accessibilityLabel="Daha fazla"
            />
            {mine ? (
              <MiniIcon name="edit" onPress={() => onEdit?.(m)} accessibilityLabel="Düzenle" />
            ) : null}
            {mine ? (
              <MiniIcon name="delete" onPress={() => onDelete?.(m)} accessibilityLabel="Sil" danger />
            ) : null}
          </View>
        ) : (
          <Pressable onPress={() => onLongPress?.(m)} hitSlop={8} style={{ marginTop: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>Basılı tut · menü</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});

function EmbedCard({
  embed,
  onAction,
}: {
  embed: MessageEmbed;
  onAction?: (action: MessageEmbedAction) => void;
}) {
  const img = resolveMediaUrl(embed.imageUrl);
  return (
    <View
      style={{
        marginTop: 8,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: colors.surfaceHigh,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        maxWidth: 340,
      }}
    >
      <Pressable
        onPress={() => {
          if (embed.url) void Linking.openURL(embed.url);
        }}
        style={{ flexDirection: 'row', gap: 10, padding: 10 }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          {embed.siteName ? (
            <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>
              {embed.siteName}
            </Text>
          ) : null}
          <Text style={{ color: colors.primary, fontWeight: '700' }} numberOfLines={2}>
            {embed.title || embed.siteName || 'Bağlantı'}
          </Text>
          {embed.description ? (
            <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={3}>
              {embed.description}
            </Text>
          ) : null}
        </View>
        {img ? (
          <Image
            source={{ uri: img }}
            style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: colors.surface }}
          />
        ) : null}
      </Pressable>
      {(embed.actions?.length ?? 0) > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10, paddingBottom: 10 }}>
          {embed.actions!.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                if (a.url && (a.action === 'open' || !a.action)) {
                  void Linking.openURL(a.url);
                }
                onAction?.(a);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: colors.surface,
              }}
            >
              <Icon
                name={
                  a.action === 'replay'
                    ? 'replay'
                    : a.action === 'lyrics'
                      ? 'lyrics'
                      : 'open_in_new'
                }
                size={16}
                color={colors.text}
              />
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 12 }}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ToolBtn({
  icon,
  onPress,
  active,
  accessibilityLabel,
}: {
  icon: string;
  onPress: () => void;
  active?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={{
        height: 34,
        minWidth: 40,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: active ? colors.primary : colors.surfaceHigh,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={20} color={active ? colors.primaryOn : colors.text} />
    </Pressable>
  );
}

function Mini({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Text style={{ color: colors.textMuted, fontSize: 11, paddingHorizontal: 4 }}>{children}</Text>
    </Pressable>
  );
}

function MiniIcon({
  name,
  onPress,
  accessibilityLabel,
  danger,
}: {
  name: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel} hitSlop={4} style={{ paddingHorizontal: 4 }}>
      <Icon name={name} size={16} color={danger ? colors.danger : colors.textMuted} />
    </Pressable>
  );
}

const chipBtn = {
  paddingHorizontal: 10,
  paddingVertical: 6,
  backgroundColor: colors.surfaceHigh,
  borderRadius: 8,
};

const stickerCell = {
  width: 72,
  height: 72,
  borderRadius: 12,
  backgroundColor: colors.surfaceHigh,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  overflow: 'hidden' as const,
};

const mediaPanel = {
  borderTopWidth: 1,
  borderTopColor: colors.surfaceHigh,
  backgroundColor: colors.surface,
  padding: 10,
  maxHeight: 140,
};

const composerBanner = {
  padding: 10,
  backgroundColor: colors.surface,
  borderTopWidth: 1,
  borderTopColor: colors.surfaceHigh,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 8,
};

const composerBar = {
  borderTopWidth: 1,
  borderTopColor: colors.surfaceHigh,
  backgroundColor: colors.surface,
  paddingHorizontal: 10,
  paddingTop: 8,
  paddingBottom: 4,
};

const composerInputRow = {
  flexDirection: 'row' as const,
  gap: 8,
  paddingHorizontal: 10,
  paddingBottom: 10,
  paddingTop: 4,
  backgroundColor: colors.surface,
  alignItems: 'flex-end' as const,
};
