import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { DracordClient } from '@dracord/sdk';
import type { CatchupDto, CatchupMessageRef } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { Icon } from './Icon';

/** Mobil "Ne kaçırdım?" — kural tabanlı özet (cihaz üstü AI mobilde yok) */
export function CatchupSheet({
  visible,
  onClose,
  client,
  channelId,
  unreadAtOpen,
  openedAt,
  onJump,
}: {
  visible: boolean;
  onClose: () => void;
  client: DracordClient;
  channelId: string;
  unreadAtOpen: number;
  openedAt: string;
  onJump?: (messageId: string) => void;
}) {
  const [data, setData] = useState<CatchupDto | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setErr(null);
    void client
      .getChannelCatchup(channelId, { lastN: unreadAtOpen > 0 ? unreadAtOpen : undefined, until: openedAt })
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Özet alınamadı'));
  }, [visible, client, channelId, unreadAtOpen, openedAt]);

  const section = (title: string, icon: string, items: CatchupMessageRef[]) =>
    items.length ? (
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={icon} size={16} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: '700' }}>{title}</Text>
        </View>
        {items.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => {
              onJump?.(m.id);
              onClose();
            }}
            style={{ padding: 8, borderRadius: 8, backgroundColor: colors.surfaceHigh }}
          >
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>
              {m.authorName}
              {m.reactionCount ? ` · ${m.reactionCount} tepki` : ''}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={2}>
              {m.contentPreview || '—'}
            </Text>
          </Pressable>
        ))}
      </View>
    ) : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '85%' }}
        >
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>Ne kaçırdım?</Text>
            {err ? <Text style={{ color: colors.danger }}>{err}</Text> : null}
            {!data && !err ? <Text style={{ color: colors.textMuted }}>Özet hazırlanıyor…</Text> : null}
            {data ? (
              <>
                <Text style={{ color: colors.textMuted }}>
                  {data.totalNew === 0 ? 'Kaçırdığın bir şey yok 🎉' : `${data.totalNew} yeni mesaj`}
                  {data.participants.length
                    ? ` · en aktif: ${data.participants
                        .slice(0, 3)
                        .map((p) => p.name)
                        .join(', ')}`
                    : ''}
                </Text>
                {section('Senden bahsedenler', 'alternate_email', data.mentions)}
                {section('Öne çıkanlar', 'local_fire_department', data.topReacted)}
                {section('Sabitlenenler', 'push_pin', data.pinned)}
                {section('Anketler', 'ballot', data.polls)}
                {data.links.length ? (
                  <View style={{ gap: 4 }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>Paylaşılan bağlantılar</Text>
                    {data.links.map((l) => (
                      <Pressable key={l.url} onPress={() => void Linking.openURL(l.url).catch(() => undefined)}>
                        <Text style={{ color: colors.primary }} numberOfLines={1}>
                          {l.url}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
