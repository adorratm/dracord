import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { GAME_KIND_LABEL } from '@dracord/game-core';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { leaveActivityFully } from '../../lib/leaveActivityFully';
import { useActivitySessionOptional } from './ActivitySession';
import { useVoiceSessionOptional } from '../voice/VoiceSession';
import { Icon } from '../Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Oyun / Watch Party aktifken alt şerit — menüde gezerken oturumu koru */
export function ActivityConnectionBar() {
  const activity = useActivitySessionOptional();
  const voice = useVoiceSessionOptional();
  const { client } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (!activity?.activityChannelId || !activity.activityGuildId) return null;

  const onActivityRoute =
    pathname?.includes(
      `/activity/${activity.activityGuildId}/${activity.activityChannelId}`,
    ) ?? false;

  if (onActivityRoute) return null;

  const kindLabel = activity.activityKind
    ? GAME_KIND_LABEL[activity.activityKind]
    : 'Aktivite';

  // Altında ses şeridi varsa safe-area’yı ses alır
  const padBottom = voice?.voiceChannelId ? 8 : Math.max(insets.bottom, 8);

  const leave = () => {
    const chId = activity.activityChannelId;
    void (async () => {
      // Watch party: alt ses şeridi kalmasın
      if (voice && chId && voice.voiceChannelId === chId) {
        await Promise.resolve(voice.leave()).catch(() => undefined);
      } else if (voice?.voiceChannelId && activity.activityKind === 'watch_party') {
        await Promise.resolve(voice.leave()).catch(() => undefined);
      }
      await leaveActivityFully({
        client,
        sessionId: activity.activitySessionId,
        channelId: chId,
        clearActiveActivity: activity.clearActiveActivity,
        voice,
      });
    })();
  };

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.surfaceHigh,
        backgroundColor: '#151722',
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 8,
        paddingBottom: padBottom,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Pressable
        onPress={() => {
          router.push(
            `/(app)/activity/${activity.activityGuildId}/${activity.activityChannelId}`,
          );
        }}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}
      >
        <Icon
          name={activity.activityKind === 'watch_party' ? 'movie' : 'sports_esports'}
          size={18}
          color={colors.primary}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }} numberOfLines={1}>
            {kindLabel} · devam ediyor
          </Text>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
            {activity.activityChannelName ?? 'Aktivite'}
          </Text>
        </View>
        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Dön</Text>
      </Pressable>
      <Pressable
        hitSlop={8}
        onPress={leave}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.danger,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityLabel="Aktiviteden ayrıl"
      >
        <Icon name="close" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}
