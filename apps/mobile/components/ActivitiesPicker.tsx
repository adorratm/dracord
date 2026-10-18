import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { ChannelSummary } from '@dracord/types';
import { DISCOVER_CURATED_APPS } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { Icon } from './Icon';

const KIND_ICON: Record<string, string> = {
  billiards: 'sports_bar',
  okey: 'grid_view',
  bowling: 'sports_martial_arts',
  tavla: 'casino',
  blackjack: 'style',
  trivia: 'quiz',
  words: 'spellcheck',
  WATCH_PARTY: 'live_tv',
  GAME: 'sports_esports',
};

type Tab = 'server' | 'games' | 'social' | 'watch';

export function ActivitiesPicker({
  open,
  onClose,
  channels,
  onSelectChannel,
  onOpenDiscover,
}: {
  open: boolean;
  onClose: () => void;
  channels: ChannelSummary[];
  onSelectChannel: (c: ChannelSummary) => void;
  onOpenDiscover?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('server');

  const activityChannels = channels
    .filter((c) => c.type === 'GAME' || c.type === 'WATCH_PARTY')
    .slice()
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'tr'));

  const curatedGames = DISCOVER_CURATED_APPS.filter(
    (a) => a.kind === 'game' && a.gameChannelHint !== 'trivia' && a.gameChannelHint !== 'words',
  );
  const curatedSocial = DISCOVER_CURATED_APPS.filter(
    (a) => a.gameChannelHint === 'trivia' || a.gameChannelHint === 'words',
  );
  const curatedWatch = DISCOVER_CURATED_APPS.filter((a) => a.kind === 'utility');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'server', label: 'Sunucu' },
    { id: 'games', label: 'Oyunlar' },
    { id: 'social', label: 'Sosyal' },
    { id: 'watch', label: 'İzle' },
  ];

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            maxHeight: '80%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: 24,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, flex: 1 }}>
              Aktiviteler
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 13,
              paddingHorizontal: 16,
              marginBottom: 10,
            }}
          >
            Trivia, kelime, masa oyunları ve Watch Party — otomatik bilardo yok.
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }}>
            <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 12 }}>
              {tabs.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setTab(t.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: tab === t.id ? colors.primary : colors.surfaceHigh,
                  }}
                >
                  <Text
                    style={{
                      color: tab === t.id ? colors.primaryOn : colors.textMuted,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <ScrollView style={{ paddingHorizontal: 8, marginTop: 8 }}>
            {tab === 'server' &&
              (activityChannels.length === 0 ? (
                <Text style={{ color: colors.textMuted, paddingHorizontal: 8, marginBottom: 12 }}>
                  Bu sunucuda oyun / Watch Party kanalı yok.
                </Text>
              ) : (
                activityChannels.map((c) => {
                  const hint =
                    c.type === 'WATCH_PARTY' ? 'WATCH_PARTY' : (c.gameKind ?? 'GAME');
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => {
                        onClose();
                        onSelectChannel(c);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        borderRadius: 12,
                      }}
                    >
                      <Icon
                        name={KIND_ICON[hint] ?? KIND_ICON.GAME}
                        size={22}
                        color={colors.primary}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                          {c.type === 'WATCH_PARTY' ? 'Watch Party' : c.gameKind ?? 'Oyun'}
                        </Text>
                      </View>
                      <Icon name="chevron_right" size={18} color={colors.textMuted} />
                    </Pressable>
                  );
                })
              ))}

            {tab === 'games' &&
              curatedGames.map((app) => (
                <CuratedRow key={app.id} name={app.name} tagline={app.tagline} icon={app.icon} onPress={() => {
                  onClose();
                  onOpenDiscover?.();
                }} />
              ))}
            {tab === 'social' &&
              curatedSocial.map((app) => (
                <CuratedRow key={app.id} name={app.name} tagline={app.tagline} icon={app.icon} onPress={() => {
                  onClose();
                  onOpenDiscover?.();
                }} />
              ))}
            {tab === 'watch' &&
              curatedWatch.map((app) => (
                <CuratedRow key={app.id} name={app.name} tagline={app.tagline} icon={app.icon} onPress={() => {
                  onClose();
                  onOpenDiscover?.();
                }} />
              ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CuratedRow({
  name,
  tagline,
  icon,
  onPress,
}: {
  name: string;
  tagline: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 12,
      }}
    >
      <Icon name={icon} size={22} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{name}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
          {tagline}
        </Text>
      </View>
    </Pressable>
  );
}
