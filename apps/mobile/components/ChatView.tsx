import { useEffect, useRef, useState } from 'react';
import {
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ChannelSummary, MessageAttachment, MessageDto } from '@dracord/types';
import { SocketEvents } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';
import { uploadImageFromUri } from '../lib/uploadMobile';
import { inputStyle, primaryBtn, primaryBtnText } from '../lib/ui';

const QUICK_EMOJI = ['👍', '❤️', '😂', '🔥', '😮', '😢'];

export function ChatView({ channel }: { channel: ChannelSummary }) {
  const { client, user } = useAuth();
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
  const [editing, setEditing] = useState<MessageDto | null>(null);
  const [pins, setPins] = useState<MessageDto[]>([]);
  const [showPins, setShowPins] = useState(false);
  const [threadRoot, setThreadRoot] = useState<MessageDto | null>(null);
  const [threadMsgs, setThreadMsgs] = useState<MessageDto[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState('Evet\nHayır');
  const listRef = useRef<FlatList<MessageDto>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    client.joinChannel(channel.id);
    void client.getMessages(channel.id).then((page) => {
      setMessages([...(page.items ?? [])].reverse());
    });
    void client.listPinnedMessages(channel.id).then(setPins).catch(() => setPins([]));
    const sock = client.connectSocket();
    const onMsg = (msg: MessageDto) => {
      if (msg.channelId !== channel.id) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
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
      if (payload.user?.id === user?.id) return;
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
  }, [client, channel.id, user?.id]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

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
      if (threadRoot) {
        const page = await client.getMessageThread(threadRoot.id);
        setThreadMsgs([...(page.items ?? [])].reverse());
      }
    } finally {
      setBusy(false);
    }
  };

  const openThread = (m: MessageDto) => {
    setThreadRoot(m);
    void client.getMessageThread(m.id).then((page) => {
      setThreadMsgs([...(page.items ?? [])].reverse());
    });
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Galeri erişimi olmadan görsel yüklenemez.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setBusy(true);
    try {
      const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
      const att = await uploadImageFromUri(
        client,
        asset.uri,
        name,
        asset.mimeType ?? 'image/jpeg',
      );
      await send(text.trim() || att.filename, [att]);
      setText('');
    } catch (e) {
      Alert.alert('Yükleme', e instanceof Error ? e.message : 'Görsel yüklenemedi');
    } finally {
      setBusy(false);
    }
  };

  const renderMessage = ({ item: m, index }: { item: MessageDto; index: number }) => {
    const prev = messages[index - 1];
    const day = new Date(m.createdAt).toLocaleDateString('tr-TR');
    const showDay =
      !prev || new Date(prev.createdAt).toLocaleDateString('tr-TR') !== day;
    return (
      <View>
        {showDay ? (
          <Text
            style={{
              textAlign: 'center',
              color: colors.textMuted,
              fontSize: 12,
              marginVertical: 12,
            }}
          >
            {day}
          </Text>
        ) : null}
        <MessageRow
          m={m}
          mine={m.author?.id === user?.id}
          onReply={() => setReplyTo(m)}
          onEdit={() => {
            setEditing(m);
            setText(m.content);
          }}
          onDelete={() => {
            Alert.alert('Mesaj', 'Mesaj silinsin mi?', [
              { text: 'İptal', style: 'cancel' },
              { text: 'Sil', style: 'destructive', onPress: () => void client.deleteMessage(m.id) },
            ]);
          }}
          onPin={() => {
            void (m.pinnedAt ? client.unpinMessage(m.id) : client.pinMessage(m.id)).then(() =>
              client.listPinnedMessages(channel.id).then(setPins),
            );
          }}
          onReact={(emoji) => void client.toggleReaction(m.id, emoji)}
          onThread={() => openThread(m)}
          onVote={(optId) => void client.votePoll(m.id, optId)}
        />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
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
        <Text style={{ flex: 1, color: colors.text, fontWeight: '700' }}>#{channel.name}</Text>
        <Pressable
          onPress={() => {
            setShowPins((v) => !v);
            void client.listPinnedMessages(channel.id).then(setPins);
          }}
          style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surfaceHigh, borderRadius: 8 }}
        >
          <Text style={{ color: colors.text, fontWeight: '600' }}>📌 {pins.length}</Text>
        </Pressable>
      </View>

      {showPins ? (
        <ScrollView style={{ maxHeight: 120, borderBottomWidth: 1, borderBottomColor: colors.surfaceHigh, padding: 8 }}>
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
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={renderMessage}
      />

      {typingUsers.length > 0 ? (
        <Text style={{ paddingHorizontal: 16, paddingBottom: 4, fontSize: 12, color: colors.textMuted }}>
          {typingUsers.join(', ')} yazıyor…
        </Text>
      ) : null}

      {(replyTo || editing) && (
        <View
          style={{
            padding: 10,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.surfaceHigh,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
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
          >
            <Text style={{ color: colors.textMuted }}>✕</Text>
          </Pressable>
        </View>
      )}

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
            style={{ ...inputStyle, height: 72, paddingVertical: 8, marginBottom: 8, textAlignVertical: 'top' }}
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

      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          padding: 12,
          borderTopWidth: 1,
          borderTopColor: colors.surfaceHigh,
          alignItems: 'center',
        }}
      >
        <Pressable onPress={() => void pickImage()} style={iconBtn}>
          <Text>📎</Text>
        </Pressable>
        <Pressable onPress={() => setPollOpen((v) => !v)} style={iconBtn}>
          <Text>📊</Text>
        </Pressable>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            client.startTyping(channel.id);
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => undefined, 2000);
          }}
          placeholder={`#${channel.name} kanalına mesaj`}
          placeholderTextColor={colors.textMuted}
          style={{ ...inputStyle, flex: 1 }}
        />
        <Pressable
          disabled={busy || !text.trim()}
          onPress={() => {
            const content = text.trim();
            if (!content) return;
            void send(content);
          }}
          style={{ ...primaryBtn, opacity: busy || !text.trim() ? 0.5 : 1 }}
        >
          <Text style={primaryBtnText}>{editing ? 'Kaydet' : 'Gönder'}</Text>
        </Pressable>
      </View>

      <Modal visible={!!threadRoot} animationType="slide" onRequestClose={() => setThreadRoot(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
            <Pressable onPress={() => { setThreadRoot(null); setThreadMsgs([]); }}>
              <Text style={{ color: colors.textMuted }}>Kapat</Text>
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1, padding: 12 }}>
            {threadRoot ? <MessageRow m={threadRoot} mine={threadRoot.author?.id === user?.id} compact /> : null}
            {threadMsgs.map((m) => (
              <MessageRow key={m.id} m={m} mine={m.author?.id === user?.id} compact />
            ))}
          </ScrollView>
          <Text style={{ padding: 12, fontSize: 12, color: colors.textMuted }}>
            Ana kutuya yazıp gönder — thread’e eklenir.
          </Text>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const iconBtn = {
  height: 44,
  paddingHorizontal: 10,
  borderRadius: 10,
  backgroundColor: colors.surfaceHigh,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
};

function MessageRow({
  m,
  mine,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onThread,
  onVote,
  compact,
}: {
  m: MessageDto;
  mine: boolean;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onReact?: (emoji: string) => void;
  onThread?: () => void;
  onVote?: (optionId: string) => void;
  compact?: boolean;
}) {
  return (
    <View style={{ marginBottom: compact ? 8 : 14 }}>
      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
        {m.author?.displayName ?? 'üye'}
        {mine ? ' (sen)' : ''}{' '}
        <Text style={{ color: colors.textMuted, fontWeight: '400', fontSize: 11 }}>
          {new Date(m.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          {m.pinnedAt ? ' · 📌' : ''}
        </Text>
      </Text>
      {m.replyTo ? (
        <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
          ↳ {m.replyTo.authorName}: {m.replyTo.contentPreview}
        </Text>
      ) : null}
      <Text style={{ color: colors.text }}>{m.content}</Text>
      {m.attachments?.map((a) =>
        a.contentType?.startsWith('image/') ? (
          <Image
            key={a.id}
            source={{ uri: a.url }}
            style={{ maxWidth: 280, height: 180, borderRadius: 8, marginTop: 6 }}
            resizeMode="cover"
          />
        ) : (
          <Text key={a.id} style={{ color: colors.primary, marginTop: 4 }}>
            {a.filename}
          </Text>
        ),
      )}
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
          <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 6 }}>{m.poll.question}</Text>
          {m.poll.options.map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => onVote?.(opt.id)}
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
              onPress={() => onReact?.(r.emoji)}
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {QUICK_EMOJI.map((e) => (
            <Mini key={e} onPress={() => onReact?.(e)}>
              {e}
            </Mini>
          ))}
          <Mini onPress={onReply}>Yanıt</Mini>
          <Mini onPress={onThread}>Thread</Mini>
          <Mini onPress={onPin}>Pin</Mini>
          {mine ? <Mini onPress={onEdit}>Düzenle</Mini> : null}
          {mine ? <Mini onPress={onDelete}>Sil</Mini> : null}
        </View>
      ) : null}
    </View>
  );
}

function Mini({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Text style={{ color: colors.textMuted, fontSize: 11, paddingHorizontal: 4 }}>{children}</Text>
    </Pressable>
  );
}
