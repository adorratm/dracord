import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import type { DracordClient } from '@dracord/sdk';
import {
  VOICE_MESSAGE_MAX_SEC,
  VOICE_WAVEFORM_POINTS,
  type MessageAttachment,
} from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { Icon } from './Icon';
import { uploadImageFromUri } from '../lib/uploadMobile';

const fmt = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function downsample(samples: number[], n = VOICE_WAVEFORM_POINTS): number[] {
  if (!samples.length) return new Array(n).fill(0);
  const out: number[] = [];
  const step = samples.length / n;
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * step);
    const b = Math.max(a + 1, Math.floor((i + 1) * step));
    let peak = 0;
    for (let j = a; j < b && j < samples.length; j++) peak = Math.max(peak, samples[j]!);
    out.push(peak);
  }
  const max = Math.max(1, ...out);
  return out.map((v) => Math.round((v / max) * 255));
}

/** dB (−160…0) → 0…1 */
const dbToAmp = (db?: number) => (typeof db === 'number' ? Math.max(0, Math.min(1, (db + 60) / 60)) : 0);

/**
 * Mobil sesli mesaj kaydı. Ses kanalındayken kapalı
 * (LiveKit ses oturumu ile çakışmasın).
 */
export function VoiceRecorderBar({
  client,
  channelId,
  replyToId,
  disabledReason,
  onSent,
  onRecordingChange,
}: {
  client: DracordClient;
  channelId: string;
  replyToId?: string;
  /** Örn. sesli sohbetteyken */
  disabledReason?: string | null;
  onSent?: () => void;
  onRecordingChange?: (recording: boolean) => void;
}) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const samples = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => () => stopTimer(), []);
  useEffect(() => onRecordingChange?.(recording), [recording]); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreMode = () => {
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
  };

  const start = async () => {
    if (disabledReason) {
      Alert.alert('Sesli mesaj', disabledReason);
      return;
    }
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Mikrofon', 'Sesli mesaj için mikrofon izni gerekli.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      samples.current = [];
      recorder.record();
      startedAt.current = Date.now();
      setRecording(true);
      timer.current = setInterval(() => {
        const st = recorder.getStatus();
        const amp = dbToAmp(st.metering);
        samples.current.push(Math.round(amp * 128));
        setLevel(amp);
        const el = (Date.now() - startedAt.current) / 1000;
        setElapsed(el);
        if (el >= VOICE_MESSAGE_MAX_SEC) void finish(true);
      }, 100);
    } catch {
      restoreMode();
      Alert.alert('Sesli mesaj', 'Kayıt başlatılamadı.');
    }
  };

  const finish = async (send: boolean) => {
    stopTimer();
    const durationSec = Math.min(VOICE_MESSAGE_MAX_SEC, (Date.now() - startedAt.current) / 1000);
    setRecording(false);
    setElapsed(0);
    setLevel(0);
    try {
      await recorder.stop();
    } catch {
      /* ignore */
    }
    restoreMode();
    const uri = recorder.uri;
    if (!send || !uri || durationSec < 0.7) return;
    setBusy(true);
    try {
      const att = await uploadImageFromUri(client, uri, `sesli-mesaj-${Date.now()}.m4a`, 'audio/mp4');
      const voiceAtt: MessageAttachment = {
        ...att,
        voice: true,
        durationSec: Math.round(durationSec * 10) / 10,
        waveform: downsample(samples.current),
      };
      await client.sendMessage(channelId, '', [voiceAtt], undefined, { replyToId });
      onSent?.();
    } catch (e) {
      Alert.alert('Sesli mesaj', e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setBusy(false);
    }
  };

  if (!recording) {
    return (
      <Pressable
        onPress={() => void start()}
        disabled={busy}
        hitSlop={6}
        accessibilityLabel="Sesli mesaj kaydet"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceHigh,
          opacity: busy ? 0.5 : disabledReason ? 0.6 : 1,
        }}
      >
        <Icon name={busy ? 'hourglass_top' : 'mic'} size={22} color={colors.text} />
      </Pressable>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.surfaceHigh,
        borderRadius: 22,
        paddingHorizontal: 8,
        minHeight: 44,
      }}
      accessibilityLiveRegion="polite"
    >
      <Pressable onPress={() => void finish(false)} hitSlop={8} accessibilityLabel="Kaydı iptal et">
        <Icon name="delete" size={22} color={colors.textMuted} />
      </Pressable>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger }} />
      <Text style={{ color: colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{fmt(elapsed)}</Text>
      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, level * 100)}%`, height: '100%', backgroundColor: colors.primary }} />
      </View>
      <Pressable
        onPress={() => void finish(true)}
        accessibilityLabel="Sesli mesajı gönder"
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="send" size={20} color={colors.primaryOn} />
      </Pressable>
    </View>
  );
}

/** Sesli mesaj oynatıcı */
export function VoiceMessageBubble({ attachment }: { attachment: MessageAttachment }) {
  const player = useAudioPlayer(attachment.url);
  const status = useAudioPlayerStatus(player);
  const dur = status.duration > 0 ? status.duration : attachment.durationSec ?? 0;
  const pos = status.currentTime ?? 0;
  const progress = dur > 0 ? pos / dur : 0;
  const bars = attachment.waveform?.length ? attachment.waveform : new Array(32).fill(60);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    if (status.didJustFinish) {
      void player.seekTo(0).catch(() => undefined);
      player.pause();
    }
  }, [status.didJustFinish, player]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
        padding: 6,
        borderRadius: 18,
        backgroundColor: colors.surfaceHigh,
        maxWidth: 300,
      }}
    >
      <Pressable
        onPress={() => (status.playing ? player.pause() : player.play())}
        accessibilityLabel={status.playing ? 'Duraklat' : 'Oynat'}
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={status.playing ? 'pause' : 'play_arrow'} size={22} color={colors.primaryOn} />
      </Pressable>
      <View style={{ flex: 1, height: 28, flexDirection: 'row', alignItems: 'center', gap: 1.5 }}>
        {bars.map((v, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${Math.max(12, (v / 255) * 100)}%`,
              borderRadius: 2,
              backgroundColor: i / bars.length < progress ? colors.primary : colors.textMuted,
              opacity: i / bars.length < progress ? 1 : 0.45,
            }}
          />
        ))}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12, width: 36, textAlign: 'right' }}>
        {fmt(status.playing || pos > 0 ? pos : dur)}
      </Text>
      <Pressable
        onPress={() => {
          const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
          setRate(next);
          player.setPlaybackRate(next);
        }}
        hitSlop={6}
        accessibilityLabel="Oynatma hızı"
      >
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>{rate}×</Text>
      </Pressable>
    </View>
  );
}
