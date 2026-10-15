import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { MusicQueueState } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { useVoiceSessionOptional } from './VoiceSession';
import { Icon } from '../Icon';

export function MusicPlayerBar() {
  const { client } = useAuth();
  const voice = useVoiceSessionOptional();
  const [state, setState] = useState<MusicQueueState | null>(null);
  const [busy, setBusy] = useState(false);

  const guildId = voice?.voiceGuildId;
  const voiceChannelId = voice?.voiceChannelId;

  const refresh = useCallback(async () => {
    if (!guildId || !voiceChannelId || !voice?.connected) {
      setState(null);
      return;
    }
    try {
      const res = await client.getMusicState(guildId, voiceChannelId);
      if ('empty' in res && res.empty) {
        setState(null);
        return;
      }
      setState(res as MusicQueueState);
    } catch {
      setState(null);
    }
  }, [client, guildId, voiceChannelId, voice?.connected]);

  useEffect(() => {
    if (!guildId || !voiceChannelId || !voice?.connected) {
      setState(null);
      return;
    }
    void refresh();
    const id = setInterval(() => void refresh(), 2500);
    return () => clearInterval(id);
  }, [guildId, voiceChannelId, voice?.connected, refresh]);

  const control = async (action: 'pause' | 'resume' | 'skip' | 'stop') => {
    if (!guildId || !voiceChannelId) return;
    setBusy(true);
    try {
      const res = await client.controlMusic({
        guildId,
        voiceChannelId,
        textChannelId: state?.textChannelId,
        action,
      });
      if (res.state) setState(res.state);
      else if (action === 'stop') setState(null);
      else void refresh();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  if (!state?.nowPlaying) return null;

  const track = state.nowPlaying;
  const thumb = resolveMediaUrl(track.thumbnailUrl);

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.surfaceHigh,
        backgroundColor: colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.surfaceHigh }}
          />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              backgroundColor: colors.surfaceHigh,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="music_note" size={22} color={colors.primary} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700' }}>MÜZİK</Text>
          <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
            {track.requestedByName}
            {state.queue.length ? ` · +${state.queue.length} sırada` : ''}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        <Ctrl
          icon={state.paused ? 'play_arrow' : 'pause'}
          disabled={busy}
          onPress={() => void control(state.paused ? 'resume' : 'pause')}
          accessibilityLabel={state.paused ? 'Oynat' : 'Duraklat'}
        />
        <Ctrl
          icon="skip_next"
          disabled={busy}
          onPress={() => void control('skip')}
          accessibilityLabel="Atla"
        />
        <Ctrl
          icon="replay"
          disabled={busy}
          onPress={() => {
            if (!track.url || !state.textChannelId) return;
            void client
              .sendMessage(state.textChannelId, `/oynat ${track.url}`)
              .catch(() => undefined);
          }}
          accessibilityLabel="Tekrar oynat"
        />
        <Ctrl
          icon="stop"
          disabled={busy}
          danger
          onPress={() => void control('stop')}
          accessibilityLabel="Durdur"
        />
      </View>
    </View>
  );
}

function Ctrl({
  icon,
  onPress,
  disabled,
  danger,
  accessibilityLabel,
}: {
  icon: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={{
        width: 48,
        height: 36,
        borderRadius: 8,
        opacity: disabled ? 0.45 : 1,
        backgroundColor: danger ? colors.danger : colors.surfaceHigh,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={20} color={danger ? '#fff' : colors.text} />
    </Pressable>
  );
}
