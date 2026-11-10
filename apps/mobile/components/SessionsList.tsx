import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { DracordClient } from '@dracord/sdk';
import { describeUserAgent, type SessionDeviceDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';

/** E2 — mobil: açık oturumlar / cihazlar */
export function SessionsList({ client }: { client: DracordClient }) {
  const [rows, setRows] = useState<SessionDeviceDto[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => void client.listSessions().then(setRows).catch(() => setRows([])), [client]);
  useEffect(load, [load]);
  if (!rows) return <Text style={{ color: colors.textMuted }}>Yükleniyor…</Text>;
  const others = rows.filter((r) => !r.current);
  return (
    <View style={{ gap: 8, marginBottom: 12 }}>
      {rows.map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.surfaceHigh }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {describeUserAgent(r.userAgent, r.platform)}
              {r.current ? '  · bu cihaz' : ''}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              Son: {new Date(r.lastUsedAt).toLocaleString('tr-TR')}
              {r.ip ? ` · ${r.ip}` : ''}
            </Text>
          </View>
          {!r.current ? (
            <Pressable disabled={busy} onPress={() => void client.revokeSession(r.id).then(load)} hitSlop={6}>
              <Text style={{ color: colors.danger, fontWeight: '700' }}>Çıkış</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {others.length ? (
        <Pressable
          disabled={busy}
          onPress={() =>
            Alert.alert('Diğer cihazlar', 'Bu cihaz dışındaki tüm oturumlar kapatılsın mı?', [
              { text: 'Vazgeç', style: 'cancel' },
              {
                text: 'Çıkış yap',
                style: 'destructive',
                onPress: () => {
                  setBusy(true);
                  void client
                    .revokeOtherSessions()
                    .then(load)
                    .finally(() => setBusy(false));
                },
              },
            ])
          }
          style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.danger }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Diğer tüm cihazlardan çıkış</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
