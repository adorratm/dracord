import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { DracordClient } from '@dracord/sdk';
import type { E2eeDeviceDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { mobileE2eeManager } from '../lib/e2ee';
import { confirmDialog } from './ConfirmModal';

/** E3 — mobil: şifreli DM anahtarı kayıtlı cihazlar */
export function E2eeDevicesList({ client, userId }: { client: DracordClient; userId: string | null }) {
  const [rows, setRows] = useState<E2eeDeviceDto[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const load = useCallback(() => void client.listE2eeDevices().then(setRows).catch(() => setRows([])), [client]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!userId) return;
    void mobileE2eeManager(client, userId)
      ?.identity()
      .then((i) => setCurrent(i?.deviceId ?? null))
      .catch(() => undefined);
  }, [client, userId]);
  if (!rows) return <Text style={{ color: colors.textMuted }}>Yükleniyor…</Text>;
  if (!rows.length)
    return (
      <Text style={{ color: colors.textMuted, marginBottom: 12 }}>
        Henüz şifreleme anahtarı kayıtlı cihaz yok. Bir DM açtığında bu cihaz otomatik eklenir.
      </Text>
    );
  return (
    <View style={{ gap: 8, marginBottom: 12 }}>
      {rows.map((d) => (
        <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.surfaceHigh }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {d.name || 'Cihaz'}
              {d.id === current ? '  · bu cihaz' : ''}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Eklendi: {new Date(d.createdAt).toLocaleDateString('tr-TR')}</Text>
          </View>
          {d.id !== current ? (
            <Pressable
              hitSlop={6}
              onPress={() =>
                void confirmDialog({
                  title: 'Cihazı kaldır',
                  message: 'Bu cihaz yeni şifreli mesajları okuyamayacak.',
                  confirmLabel: 'Kaldır',
                  destructive: true,
                }).then((ok) => {
                  if (ok) void client.deleteE2eeDevice(d.id).then(setRows).catch(load);
                })
              }
            >
              <Text style={{ color: colors.danger, fontWeight: '700' }}>Kaldır</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}
