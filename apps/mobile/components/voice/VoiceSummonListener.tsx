import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useVoiceSessionOptional } from './VoiceSession';

/** Bir yönetici seni ses kanalına çağırdı → onay sor, Katıl derse gir */
export function VoiceSummonListener() {
  const { client, user } = useAuth();
  const voice = useVoiceSessionOptional();
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const hasVoice = Boolean(voice);
  useEffect(() => {
    if (!user || !hasVoice) return;
    client.connectSocket();
    return client.onVoiceSummon((p) => {
      Alert.alert(
        'Ses kanalına çağrı',
        `${p.from.displayName} seni 🔊 ${p.channelName} (${p.guildName}) kanalına çağırıyor.`,
        [
          { text: 'Şimdi değil', style: 'cancel' },
          {
            text: 'Katıl',
            onPress: () => {
              void voiceRef.current
                ?.join(p.guildId, { id: p.channelId, name: p.channelName, type: 'VOICE' })
                .then(() => router.push(`/channels/${p.guildId}/${p.channelId}`))
                .catch(() => undefined);
            },
          },
        ],
      );
    });
  }, [client, user, hasVoice]);
  return null;
}
