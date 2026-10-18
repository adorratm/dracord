import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { MessageDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { Icon } from './Icon';

const MENU_QUICK = ['👍', '❤️', '😂', '🔥', '😮', '😢'];
const REACT_MORE = [
  '👍',
  '👎',
  '❤️',
  '😂',
  '😮',
  '😢',
  '😡',
  '🔥',
  '🎉',
  '👀',
  '💯',
  '✅',
  '❌',
  '⭐',
  '🙏',
  '💀',
];

export type MessageActionId =
  | 'react'
  | 'reply'
  | 'quote-reply'
  | 'forward'
  | 'heading'
  | 'thread'
  | 'pin'
  | 'bookmark'
  | 'remind-1h'
  | 'remind-1d'
  | 'remind-3d'
  | 'remind-1w'
  | 'copy-content'
  | 'copy-attach'
  | 'copy-poll'
  | 'mark-unread'
  | 'copy-link'
  | 'interactions'
  | 'edit'
  | 'delete'
  | 'hide'
  | 'report'
  | 'block'
  | 'copy-id'
  | 'copy-user-id';

export function MessageActionsSheet({
  message,
  mine,
  onClose,
  onAction,
  onReact,
}: {
  message: MessageDto | null;
  mine: boolean;
  onClose: () => void;
  onAction: (id: MessageActionId, message: MessageDto) => void;
  onReact: (message: MessageDto, emoji: string) => void;
}) {
  const [reactOpen, setReactOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const open = Boolean(message);

  const isHeading = message?.type === 'heading';

  const rows = useMemo(() => {
    if (!message) return [];
    const list: Array<{
      id: string;
      icon: string;
      label: string;
      danger?: boolean;
      chevron?: boolean;
      onPress: () => void;
      skip?: boolean;
    }> = [];

    if (!isHeading) {
      list.push({
        id: 'react-add',
        icon: 'sentiment_satisfied',
        label: 'Tepki ekle',
        chevron: true,
        onPress: () => setReactOpen((v) => !v),
      });
      list.push({
        id: 'reply',
        icon: 'reply',
        label: 'Yanıtla',
        onPress: () => {
          onAction('reply', message);
          onClose();
        },
      });
      list.push({
        id: 'forward',
        icon: 'forward',
        label: 'İlet',
        onPress: () => {
          onAction('forward', message);
          onClose();
        },
      });
      list.push({
        id: 'heading',
        icon: 'title',
        label: 'Alt başlık oluştur',
        onPress: () => {
          onAction('heading', message);
          onClose();
        },
      });
      list.push({
        id: 'thread',
        icon: 'forum',
        label: 'Thread’de yanıtla',
        onPress: () => {
          onAction('thread', message);
          onClose();
        },
      });
    }

    list.push({
      id: 'pin',
      icon: 'push_pin',
      label: message.pinnedAt ? 'Sabitlemeyi kaldır' : 'Mesajı sabitle',
      onPress: () => {
        onAction('pin', message);
        onClose();
      },
    });
    list.push({
      id: 'bookmark',
      icon: 'bookmark',
      label: message.bookmarked ? 'Yer imini kaldır' : 'Yer imine ekle',
      onPress: () => {
        onAction('bookmark', message);
        onClose();
      },
    });
    if (!isHeading) {
      list.push({
        id: 'remind-1h',
        icon: 'schedule',
        label: 'Hatırlat · 1 saat',
        onPress: () => {
          onAction('remind-1h', message);
          onClose();
        },
      });
      list.push({
        id: 'remind-1d',
        icon: 'alarm',
        label: 'Hatırlat · yarın',
        onPress: () => {
          onAction('remind-1d', message);
          onClose();
        },
      });
      list.push({
        id: 'remind-1w',
        icon: 'event',
        label: 'Hatırlat · 1 hafta',
        onPress: () => {
          onAction('remind-1w', message);
          onClose();
        },
      });
    }
    if (!isHeading) {
      list.push({
        id: 'apps',
        icon: 'apps',
        label: 'Uygulamalar',
        chevron: true,
        onPress: () => setAppsOpen((v) => !v),
      });
    }
    list.push({
      id: 'unread',
      icon: 'mark_chat_unread',
      label: 'Okunmadı olarak işaretle',
      onPress: () => {
        onAction('mark-unread', message);
        onClose();
      },
    });
    list.push({
      id: 'link',
      icon: 'link',
      label: 'Mesaj bağlantısını kopyala',
      onPress: () => {
        onAction('copy-link', message);
        onClose();
      },
    });
    if (!isHeading) {
      list.push({
        id: 'interactions',
        icon: 'info',
        label: 'Etkileşim bilgileri',
        onPress: () => {
          onAction('interactions', message);
          onClose();
        },
      });
    }
    if (mine) {
      list.push({
        id: 'edit',
        icon: 'edit',
        label: 'Düzenle',
        onPress: () => {
          onAction('edit', message);
          onClose();
        },
      });
      list.push({
        id: 'delete',
        icon: 'delete',
        label: 'Mesajı sil',
        danger: true,
        onPress: () => {
          onAction('delete', message);
          onClose();
        },
      });
    }
    if (!isHeading && !mine) {
      list.push({
        id: 'report',
        icon: 'flag',
        label: 'Mesaj bildir',
        danger: true,
        onPress: () => {
          onAction('report', message);
          onClose();
        },
      });
    }
    if (!isHeading) {
      list.push({
        id: 'hide',
        icon: 'visibility_off',
        label: 'Gizle',
        onPress: () => {
          onAction('hide', message);
          onClose();
        },
      });
    }
    if (!isHeading && !mine && message.author?.id) {
      list.push({
        id: 'block',
        icon: 'block',
        label: 'Kullanıcıyı engelle',
        danger: true,
        onPress: () => {
          onAction('block', message);
          onClose();
        },
      });
    }
    list.push({
      id: 'copy-id',
      icon: 'tag',
      label: 'Mesaj ID’sini kopyala',
      onPress: () => {
        onAction('copy-id', message);
        onClose();
      },
    });
    list.push({
      id: 'copy-user',
      icon: 'person',
      label: 'Kullanıcı ID’sini kopyala',
      onPress: () => {
        onAction('copy-user-id', message);
        onClose();
      },
    });
    return list;
  }, [message, mine, isHeading, onAction, onClose]);

  if (!message) return null;

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '88%',
            paddingBottom: 16,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.surfaceHigh,
              marginTop: 10,
              marginBottom: 8,
            }}
          />
          <Text
            style={{
              color: colors.text,
              fontWeight: '800',
              fontSize: 16,
              paddingHorizontal: 16,
              marginBottom: 8,
            }}
          >
            Mesaj
          </Text>

          {!isHeading ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                paddingHorizontal: 12,
                paddingBottom: 10,
              }}
            >
              {MENU_QUICK.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => {
                    onReact(message, e);
                    onClose();
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: colors.surfaceHigh,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <ScrollView
            style={{ maxHeight: 480 }}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 4, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {reactOpen && !isHeading ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceHigh,
                  marginBottom: 4,
                }}
              >
                {REACT_MORE.map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => {
                      onReact(message, e);
                      onClose();
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {rows.map((row) => (
              <View key={row.id}>
                <SheetRow
                  icon={row.icon}
                  label={row.label}
                  danger={row.danger}
                  chevron={row.chevron}
                  onPress={row.onPress}
                />
                {row.id === 'apps' && appsOpen ? (
                  <View
                    style={{
                      marginLeft: 8,
                      marginBottom: 4,
                      padding: 6,
                      borderRadius: 10,
                      backgroundColor: colors.surfaceHigh,
                      gap: 2,
                    }}
                  >
                    <SheetRow
                      icon="content_copy"
                      label="İçeriği kopyala"
                      compact
                      onPress={() => {
                        onAction('copy-content', message);
                        onClose();
                      }}
                    />
                    <SheetRow
                      icon="format_quote"
                      label="Alıntılayarak yanıtla"
                      compact
                      onPress={() => {
                        onAction('quote-reply', message);
                        onClose();
                      }}
                    />
                    {message.attachments?.[0]?.url ? (
                      <SheetRow
                        icon="attach_file"
                        label="Ek bağlantısını kopyala"
                        compact
                        onPress={() => {
                          onAction('copy-attach', message);
                          onClose();
                        }}
                      />
                    ) : null}
                    {message.poll ? (
                      <SheetRow
                        icon="poll"
                        label="Anket özetini kopyala"
                        compact
                        onPress={() => {
                          onAction('copy-poll', message);
                          onClose();
                        }}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))}

            <SheetRow icon="close" label="Kapat" muted onPress={onClose} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetRow({
  icon,
  label,
  onPress,
  danger,
  muted,
  chevron,
  compact,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  muted?: boolean;
  chevron?: boolean;
  compact?: boolean;
}) {
  const color = danger ? colors.danger : muted ? colors.textMuted : colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: compact ? 10 : 13,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: compact ? 'transparent' : colors.surfaceHigh,
        marginBottom: compact ? 0 : 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Icon name={icon} size={compact ? 18 : 20} color={color} />
      <Text style={{ color, fontWeight: '700', flex: 1, fontSize: compact ? 13 : 14 }}>
        {label}
      </Text>
      {chevron ? <Icon name="chevron_right" size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

/** İlet — hedef kanal seçimi */
export function ForwardPickerSheet({
  open,
  channels,
  onClose,
  onPick,
}: {
  open: boolean;
  channels: Array<{ id: string; name: string }>;
  onClose: () => void;
  onPick: (channelId: string, note?: string) => void;
}) {
  const [note, setNote] = useState('');
  if (!open) return null;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '70%',
            padding: 16,
            gap: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>İlet</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="İsteğe bağlı not"
            placeholderTextColor={colors.textMuted}
            style={{
              height: 44,
              borderRadius: 10,
              paddingHorizontal: 12,
              backgroundColor: colors.surfaceHigh,
              color: colors.text,
            }}
          />
          <ScrollView style={{ maxHeight: 320 }}>
            {channels.length === 0 ? (
              <Text style={{ color: colors.textMuted, padding: 8 }}>
                İletilecek kanal bulunamadı
              </Text>
            ) : (
              channels.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    onPick(c.id, note.trim() || undefined);
                    onClose();
                    setNote('');
                  }}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: colors.surfaceHigh,
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>#{c.name}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
          <Pressable onPress={onClose} style={{ padding: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, fontWeight: '700' }}>İptal</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
