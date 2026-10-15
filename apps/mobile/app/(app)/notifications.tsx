import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import type { ClientSettings, MessageBookmarkDto, NotificationDto } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { navigateFromNotification } from '../../lib/navigateNotification';
import { ShellHeader } from '../../components/shell/AppShell';
import { Icon } from '../../components/Icon';

type InboxTab = 'unreads' | 'mentions' | 'bookmarks' | 'reminders';

const TABS: { id: InboxTab; label: string }[] = [
  { id: 'unreads', label: 'Okunmamışlar' },
  { id: 'mentions', label: 'Bahsedilmeler' },
  { id: 'bookmarks', label: 'İşaretler' },
  { id: 'reminders', label: 'Hatırlatmalar' },
];

function typeIcon(type: NotificationDto['type']): string {
  switch (type) {
    case 'MENTION':
      return 'alternate_email';
    case 'ANNOUNCEMENT':
      return 'campaign';
    case 'FRIEND':
      return 'person_add';
    case 'DM':
      return 'mail';
    default:
      return 'notifications';
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function NotificationsScreen() {
  const { client, user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<InboxTab>('unreads');
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [bookmarks, setBookmarks] = useState<MessageBookmarkDto[]>([]);
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [list, marks, prefs] = await Promise.all([
        client.listNotifications({ limit: 50 }),
        client.listBookmarks(40).catch(() => [] as MessageBookmarkDto[]),
        client.getClientSettings().catch(() => null),
      ]);
      setItems(list);
      setBookmarks(marks);
      if (prefs) setSettings(prefs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const onNotif = (n: NotificationDto) => {
      setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 50));
    };
    sock.on(SocketEvents.NOTIFICATION_CREATE, onNotif);
    return () => {
      sock.off(SocketEvents.NOTIFICATION_CREATE, onNotif);
    };
  }, [user, client]);

  const visible = useMemo(() => {
    const mutedUsers = new Set(settings?.notifications.mutedUserIds ?? []);
    const mutedChannels = new Set(settings?.notifications.mutedChannelIds ?? []);
    const mutedGuilds = new Set(settings?.notifications.mutedGuildIds ?? []);
    return items.filter((n) => {
      if (n.actorId && mutedUsers.has(n.actorId)) return false;
      if (n.channelId && mutedChannels.has(n.channelId)) return false;
      if (n.guildId && mutedGuilds.has(n.guildId)) return false;
      if (tab === 'unreads') return !n.readAt;
      if (tab === 'mentions') return n.type === 'MENTION';
      return false;
    });
  }, [items, settings, tab]);

  const openItem = async (n: NotificationDto) => {
    if (!n.readAt) {
      try {
        await client.markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
        );
      } catch {
        /* ignore */
      }
    }
    navigateFromNotification(router, n);
  };

  const markAll = async () => {
    try {
      await client.markAllNotificationsRead();
      setItems((prev) =>
        prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })),
      );
    } catch {
      /* ignore */
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ShellHeader title="Gelen Kutusu" />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceHigh,
        }}
      >
        <Pressable onPress={() => void markAll()} hitSlop={8} accessibilityLabel="Tümü okundu">
          <Icon name="done_all" size={22} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/(app)/settings')}
          hitSlop={8}
          accessibilityLabel="Bildirim ayarları"
        >
          <Icon name="tune" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{
          flexGrow: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceHigh,
        }}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderBottomWidth: 2,
                borderBottomColor: active ? colors.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  color: active ? colors.text : colors.textMuted,
                  fontWeight: active ? '800' : '600',
                  fontSize: 13,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? <Text style={{ color: colors.danger, padding: 16 }}>{error}</Text> : null}

      {tab === 'reminders' ? (
        <EmptyState
          icon="schedule"
          title="Hatırlatmalar yakında"
          body="Mesaj hatırlatmaları henüz kullanıma açılmadı."
        />
      ) : tab === 'bookmarks' ? (
        <FlatList
          data={bookmarks}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 12, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              icon="bookmark"
              title="İşaret yok"
              body="Mesajları yer imine eklediğinde burada görünür."
            />
          }
          renderItem={({ item: b }) => (
            <Pressable
              onPress={() => {
                if (b.guildId) {
                  router.push(`/(app)/channels/${b.guildId}/${b.channelId}`);
                } else {
                  router.push('/(app)/dms');
                }
              }}
              style={{
                flexDirection: 'row',
                gap: 10,
                padding: 12,
                marginBottom: 8,
                borderRadius: 10,
                backgroundColor: colors.surface,
              }}
            >
              <Icon name="bookmark" size={22} color={colors.primary} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                  {b.channelName ? `#${b.channelName}` : 'Kanal'}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                  {b.message.content?.trim() || '(ekli içerik)'}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                  {formatTime(b.createdAt)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: 12, flexGrow: 1 }}
          ListEmptyComponent={
            !error ? (
              <EmptyState
                icon="inbox"
                title="Güncele yetiştin!"
                body="Okunmamış bildirim yok. Üstteki çift onay ile tümünü okundu yapabilirsin."
              />
            ) : null
          }
          renderItem={({ item: n }) => (
            <Pressable
              onPress={() => void openItem(n)}
              style={{
                flexDirection: 'row',
                gap: 10,
                padding: 12,
                marginBottom: 8,
                borderRadius: 10,
                backgroundColor: n.readAt ? colors.surface : colors.surfaceHigh,
              }}
            >
              <Icon name={typeIcon(n.type)} size={22} color={colors.primary} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                  {n.title}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                  {n.body}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                  {formatTime(n.createdAt)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.surfaceHigh,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Icon name={icon} size={32} color={colors.textMuted} />
      </View>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17, textAlign: 'center' }}>
        {title}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18, textAlign: 'center' }}>
        {body}
      </Text>
    </View>
  );
}
