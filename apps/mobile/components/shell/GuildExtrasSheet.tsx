import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import type { GuildEventDto, GuildSummary } from '@dracord/types';
import { guildBoostLevel } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';

/** Sunucu etkinlikleri + boost — web sidebar menü parity */
export function GuildExtrasSheet({
  open,
  onClose,
  guildId,
  guild,
  initialTab = 'events',
  onGuildUpdated,
}: {
  open: boolean;
  onClose: () => void;
  guildId: string | null;
  guild: GuildSummary | null;
  initialTab?: 'events' | 'boost';
  onGuildUpdated?: (g: GuildSummary) => void;
}) {
  const { client } = useAuth();
  const [tab, setTab] = useState<'events' | 'boost'>(initialTab);
  const [events, setEvents] = useState<GuildEventDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !guildId) return;
    setTab(initialTab);
    setError(null);
    void client
      .listGuildEvents(guildId)
      .then(setEvents)
      .catch((e) => setError(e instanceof Error ? e.message : 'Yüklenemedi'));
  }, [open, guildId, client, initialTab]);

  const boostCount = guild?.boostCount ?? 0;
  const boostLevel = guild?.boostLevel ?? guildBoostLevel(boostCount);

  const doBoost = () => {
    if (!guildId) return;
    setBusy(true);
    void client
      .boostGuild(guildId)
      .then((g) => {
        onGuildUpdated?.(g);
        Alert.alert('Takviye', 'Sunucu takviye edildi.');
      })
      .catch((e) => Alert.alert('Hata', e instanceof Error ? e.message : 'Takviye başarısız'))
      .finally(() => setBusy(false));
  };

  const doUnboost = () => {
    if (!guildId) return;
    setBusy(true);
    void client
      .unboostGuild(guildId)
      .then((g) => {
        onGuildUpdated?.(g);
        Alert.alert('Takviye', 'Takviye kaldırıldı.');
      })
      .catch((e) => Alert.alert('Hata', e instanceof Error ? e.message : 'Kaldırılamadı'))
      .finally(() => setBusy(false));
  };

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
            maxHeight: '80%',
            paddingBottom: 20,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              padding: 12,
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.surfaceHigh,
            }}
          >
            <Chip label="Etkinlikler" active={tab === 'events'} onPress={() => setTab('events')} />
            <Chip label="Takviye" active={tab === 'boost'} onPress={() => setTab('boost')} />
            <Pressable onPress={onClose} style={{ marginLeft: 'auto', padding: 8 }}>
              <Text style={{ color: colors.textMuted }}>Kapat</Text>
            </Pressable>
          </View>

          {tab === 'events' ? (
            <FlatList
              data={events}
              keyExtractor={(e) => e.id}
              contentContainerStyle={{ padding: 12 }}
              ListEmptyComponent={
                <Text style={{ color: colors.textMuted, padding: 8 }}>
                  {error ?? 'Planlanmış etkinlik yok'}
                </Text>
              }
              renderItem={({ item: ev }) => (
                <View
                  style={{
                    padding: 12,
                    marginBottom: 8,
                    borderRadius: 10,
                    backgroundColor: colors.surfaceHigh,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '800' }}>{ev.title}</Text>
                  {ev.description ? (
                    <Text style={{ color: colors.textMuted, marginTop: 4 }} numberOfLines={3}>
                      {ev.description}
                    </Text>
                  ) : null}
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
                    {new Date(ev.startsAt).toLocaleString('tr-TR')}
                    {ev.location ? ` · ${ev.location}` : ''}
                    {` · ${ev.status}`}
                  </Text>
                </View>
              )}
            />
          ) : (
            <View style={{ padding: 16, gap: 12 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
                Sunucu takviyesi
              </Text>
              <Text style={{ color: colors.textMuted }}>
                Seviye {boostLevel} · {boostCount} takviye
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                Eşikler: 2 / 7 / 14 takviye. Nitro takviyesi hesabından düşülür.
              </Text>
              <Pressable
                disabled={busy}
                onPress={doBoost}
                style={{
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <Text style={{ color: colors.primaryOn, fontWeight: '700' }}>Takviye et</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={doUnboost}
                style={{
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: colors.surfaceHigh,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>Takviyeyi kaldır</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.surfaceHigh,
      }}
    >
      <Text style={{ color: active ? colors.primaryOn : colors.text, fontWeight: '700', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}
