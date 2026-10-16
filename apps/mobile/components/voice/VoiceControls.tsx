import { Pressable, ScrollView } from 'react-native';
import { colors } from '@dracord/app-theme';
import { Icon } from '../Icon';
import { useVoiceSessionOptional } from './VoiceSession';

const BTN = 36;

/** Ortak minimal ses kontrolleri — alt şerit */
export function VoiceControls({
  compact = false,
  showLeave = true,
  onLeavePress,
  allowScreenShare = true,
}: {
  compact?: boolean;
  showLeave?: boolean;
  /** Varsayılan: voice.leave() — rota çıkışı için override */
  onLeavePress?: () => void | Promise<void>;
  /** GAME / WATCH_PARTY’de kapalı */
  allowScreenShare?: boolean;
}) {
  const voice = useVoiceSessionOptional();
  if (!voice?.voiceChannelId) return null;

  const disabled = voice.voiceOnOtherClient;
  const size = compact ? 32 : BTN;
  const iconSz = compact ? 18 : 20;
  const screenShareAllowed =
    allowScreenShare &&
    voice.voiceChannelType !== 'GAME' &&
    voice.voiceChannelType !== 'WATCH_PARTY';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 6 : 8,
        paddingHorizontal: 2,
      }}
    >
      <Ctrl
        size={size}
        iconSize={iconSz}
        icon={voice.muted ? 'mic_off' : 'mic'}
        danger={voice.muted}
        disabled={disabled}
        onPress={() => voice.setMuted(!voice.muted)}
        accessibilityLabel={voice.muted ? 'Mikrofon kapalı' : 'Mikrofon'}
      />
      <Ctrl
        size={size}
        iconSize={iconSz}
        icon={voice.deafened ? 'headset_off' : 'headphones'}
        danger={voice.deafened}
        disabled={disabled}
        onPress={() => voice.setDeafened(!voice.deafened)}
        accessibilityLabel={voice.deafened ? 'Sağır' : 'Kulaklık'}
      />
      <Ctrl
        size={size}
        iconSize={iconSz}
        icon={voice.camOn ? 'videocam' : 'videocam_off'}
        active={voice.camOn}
        disabled={disabled}
        onPress={() => void voice.toggleCamera()}
        accessibilityLabel={voice.camOn ? 'Kamera açık' : 'Kamera'}
      />
      {voice.camOn ? (
        <Ctrl
          size={size}
          iconSize={iconSz}
          icon="cameraswitch"
          disabled={disabled}
          onPress={() => void voice.flipCamera()}
          accessibilityLabel="Kamerayı döndür"
        />
      ) : null}
      {screenShareAllowed ? (
        <Ctrl
          size={size}
          iconSize={iconSz}
          icon={voice.screenSharing ? 'stop_screen_share' : 'present_to_all'}
          active={voice.screenSharing}
          disabled={disabled}
          onPress={() => void voice.toggleScreenShare()}
          accessibilityLabel={voice.screenSharing ? 'Paylaşımı durdur' : 'Ekran paylaş'}
        />
      ) : null}
      {voice.voiceOnOtherClient ? (
        <Ctrl
          size={size}
          iconSize={iconSz}
          icon="phone_forwarded"
          primary
          onPress={() => void voice.reclaim()}
          accessibilityLabel="Bu cihaza al"
        />
      ) : null}
      {showLeave ? (
        <Ctrl
          size={size}
          iconSize={iconSz}
          icon="call_end"
          danger
          onPress={() => void (onLeavePress ? onLeavePress() : voice.leave())}
          accessibilityLabel="Ayrıl"
        />
      ) : null}
    </ScrollView>
  );
}

function Ctrl({
  icon,
  onPress,
  danger,
  active,
  primary,
  disabled,
  accessibilityLabel,
  size,
  iconSize,
}: {
  icon: string;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
  primary?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  size: number;
  iconSize: number;
}) {
  let color: string = colors.textMuted;
  if (danger) color = '#fff';
  else if (primary || active) color = colors.primaryOn;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        opacity: disabled ? 0.4 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: danger
          ? colors.danger
          : primary || active
            ? colors.primary
            : colors.surfaceHigh,
      }}
    >
      <Icon name={icon} size={iconSize} color={color} />
    </Pressable>
  );
}
