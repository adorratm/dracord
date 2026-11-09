import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import type { DracordClient } from '@dracord/sdk';
import { SOUNDBOARD_LIMITS, type GuildSoundDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { Icon } from '../Icon';
import { uploadImageFromUri } from '../../lib/uploadMobile';

const MAX_SEC = Math.floor(SOUNDBOARD_LIMITS.maxDurationSec * 10) / 10 - 0.2;

/**
 * Sunucu soundboard yönetimi (mobil). Dosya seçici native modül gerektirdiği
 * (OTA ile gelmez) için ses mikrofondan kaydedilir — en fazla ~5 sn.
 * Ses kanalındayken kayıt kapalı (LiveKit ses oturumu ile çakışmasın).
 */
export function SoundsTab({
  client,
  guildId,
  canManage,
  inCall,
}: {
  client: DracordClient;
  guildId: string;
  canManage: boolean;
  inCall: boolean;
}) {
  const [sounds, setSounds] = useState<GuildSoundDto[]>([]);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<{ uri: string; dur: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const reload = () => void client.listGuildSounds(guildId).then(setSounds).catch(() => setSounds([]));
  useEffect(reload, [client, guildId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const preview = (uri: string) => {
    try {
      const p = createAudioPlayer({ uri });
      p.play();
      setTimeout(() => {
        try {
          p.release();
        } catch {
          /* ignore */
        }
      }, 6500);
    } catch {
      /* ignore */
    }
  };

  const stop = async () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    const dur = Math.min(MAX_SEC, (Date.now() - startedAt.current) / 1000);
    setRecording(false);
    try {
      await recorder.stop();
    } catch {
      /* ignore */
    }
    void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    if (recorder.uri && dur >= 0.3) setTake({ uri: recorder.uri, dur: Math.round(dur * 10) / 10 });
  };

  const start = async () => {
    if (inCall) {
      Alert.alert('Ses kaydı', 'Ses kanalındayken kayıt yapılamaz. Önce kanaldan çık.');
      return;
    }
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Mikrofon', 'Ses eklemek için mikrofon izni gerekli.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      setTake(null);
      recorder.record();
      startedAt.current = Date.now();
      setRecording(true);
      setElapsed(0);
      timer.current = setInterval(() => {
        const el = (Date.now() - startedAt.current) / 1000;
        setElapsed(el);
        if (el >= MAX_SEC) void stop();
      }, 100);
    } catch {
      void setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      Alert.alert('Ses kaydı', 'Kayıt başlatılamadı.');
    }
  };

  const save = async () => {
    if (!take) return;
    const n = name.trim().slice(0, SOUNDBOARD_LIMITS.nameMax);
    if (!n) {
      Alert.alert('Ses', 'Bir ad yaz.');
      return;
    }
    setBusy(true);
    try {
      const up = await uploadImageFromUri(client, take.uri, `ses-${Date.now()}.m4a`, 'audio/mp4', 'sounds');
      if ((up.size ?? 0) > SOUNDBOARD_LIMITS.maxBytes) throw new Error('Kayıt çok büyük (en fazla 512 KB)');
      await client.createGuildSound(guildId, {
        name: n,
        emoji: emoji.trim() || null,
        url: up.url,
        contentType: up.contentType,
        durationSec: take.dur,
      });
      setTake(null);
      setName('');
      setEmoji('');
      reload();
    } catch (e) {
      Alert.alert('Eklenemedi', e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  };

  const remove = (s: GuildSoundDto) =>
    Alert.alert('Sesi sil', `"${s.name}" silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => void client.deleteGuildSound(guildId, s.id).then(reload).catch(() => undefined),
      },
    ]);

  const full = sounds.length >= SOUNDBOARD_LIMITS.maxSoundsPerGuild;

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled">
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        {sounds.length}/{SOUNDBOARD_LIMITS.maxSoundsPerGuild} ses · ses kanalında ♪ ile çalınır
      </Text>
      {sounds.map((s) => (
        <View
          key={s.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.surfaceHigh }}
        >
          <Text style={{ fontSize: 18 }}>{s.emoji || '🔊'}</Text>
          <Text style={{ color: colors.text, flex: 1, fontWeight: '600' }} numberOfLines={1}>
            {s.name}
          </Text>
          <Pressable onPress={() => preview(s.url)} hitSlop={8} accessibilityLabel="Dinle">
            <Icon name="play_arrow" size={22} />
          </Pressable>
          {canManage ? (
            <Pressable onPress={() => remove(s)} hitSlop={8} accessibilityLabel="Sil">
              <Icon name="delete" size={20} color={colors.danger} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {sounds.length === 0 ? <Text style={{ color: colors.textMuted }}>Henüz ses yok.</Text> : null}

      {canManage && !full ? (
        <View style={{ marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.surfaceHigh, gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Yeni ses kaydet</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            En fazla {MAX_SEC} sn. Dosyadan eklemek için web veya masaüstünü kullan.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pressable
              onPress={() => void (recording ? stop() : start())}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: recording ? colors.danger : colors.surfaceHigh,
                opacity: inCall ? 0.5 : 1,
              }}
            >
              <Icon name={recording ? 'stop' : 'mic'} size={18} color={recording ? '#fff' : colors.text} />
              <Text style={{ color: recording ? '#fff' : colors.text, fontWeight: '700' }}>
                {recording ? `Durdur ${elapsed.toFixed(1)} sn` : take ? 'Yeniden kaydet' : 'Kaydet'}
              </Text>
            </Pressable>
            {take && !recording ? (
              <Pressable onPress={() => preview(take.uri)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="play_arrow" size={20} />
                <Text style={{ color: colors.text }}>{take.dur} sn</Text>
              </Pressable>
            ) : null}
          </View>
          {inCall ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>Ses kanalındayken kayıt kapalı.</Text> : null}
          {take ? (
            <>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={emoji}
                  onChangeText={(t) => setEmoji([...t].slice(-2).join(''))}
                  placeholder="🔊"
                  placeholderTextColor={colors.textMuted}
                  style={{ width: 52, textAlign: 'center', color: colors.text, backgroundColor: colors.surfaceHigh, borderRadius: 8, paddingVertical: 8 }}
                />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  maxLength={SOUNDBOARD_LIMITS.nameMax}
                  placeholder="Ses adı"
                  placeholderTextColor={colors.textMuted}
                  style={{ flex: 1, color: colors.text, backgroundColor: colors.surfaceHigh, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
                />
              </View>
              <Pressable
                disabled={busy}
                onPress={() => void save()}
                style={{ alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }}
              >
                <Text style={{ color: colors.primaryOn, fontWeight: '700' }}>{busy ? 'Yükleniyor…' : 'Ekle'}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
