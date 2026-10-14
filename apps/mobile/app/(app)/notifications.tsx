import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import type { NotificationDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';

export default function NotificationsScreen() {
  const { client } = useAuth();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = () =>
    client
      .listNotifications({ limit: 50 })
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Yüklenemedi'));

  useEffect(() => {
    void reload();
  }, [client]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Bildirimler',
          headerRight: () => (
            <Pressable
              onPress={() => void client.markAllNotificationsRead().then(() => reload())}
              style={{ paddingHorizontal: 12 }}
            >
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Tümü okundu</Text>
            </Pressable>
          ),
        }}
      />
      {error ? <Text style={{ color: colors.danger, padding: 16 }}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={
          !error ? <Text style={{ color: colors.textMuted, padding: 8 }}>Bildirim yok</Text> : null
        }
        renderItem={({ item: n }) => (
          <Pressable
            onPress={() => {
              if (!n.readAt) void client.markNotificationRead(n.id).then(() => reload());
            }}
            style={{
              padding: 12,
              marginBottom: 8,
              borderRadius: 10,
              backgroundColor: n.readAt ? colors.surface : colors.surfaceHigh,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>{n.title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>{n.body}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
              {new Date(n.createdAt).toLocaleString('tr-TR')} · {n.type}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
