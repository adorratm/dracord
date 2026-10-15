import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@dracord/app-theme';
import { useVoiceSessionOptional } from './VoiceSession';
import { VoiceControls } from './VoiceControls';
import { Icon } from '../Icon';

/** Tüm sayfalarda altta kalan kompakt ses şeridi */
export function VoiceConnectionBar() {
  const voice = useVoiceSessionOptional();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (!voice?.voiceChannelId || !voice.voiceGuildId) return null;

  const onVoiceRoute =
    pathname?.includes(`/voice/${voice.voiceGuildId}/${voice.voiceChannelId}`) ?? false;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.surfaceHigh,
        backgroundColor: '#151722',
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
        gap: 8,
      }}
    >
      <Pressable
        onPress={() => {
          if (!onVoiceRoute) {
            router.push(`/(app)/voice/${voice.voiceGuildId}/${voice.voiceChannelId}`);
          }
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <Icon
          name={voice.connected ? 'volume_up' : 'sync'}
          size={18}
          color={voice.voiceOnOtherClient ? colors.danger : colors.success}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: voice.voiceOnOtherClient ? colors.danger : colors.success,
              fontWeight: '700',
              fontSize: 11,
            }}
            numberOfLines={1}
          >
            {voice.voiceOnOtherClient
              ? 'Ses başka cihazda'
              : voice.connected
                ? 'Ses bağlantısı'
                : voice.status || 'Bağlanıyor…'}
          </Text>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
            {voice.voiceChannelName ?? 'Ses kanalı'}
          </Text>
        </View>
        {!onVoiceRoute ? (
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Dön</Text>
        ) : null}
      </Pressable>

      <View style={{ alignItems: 'center', width: '100%' }}>
        <VoiceControls compact />
      </View>
    </View>
  );
}
