import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { DracordClient } from '@dracord/sdk';
import { CAPTION_LIMITS, sanitizeCaption, type VoiceCaptionPayload } from '@dracord/types';
import { colors } from '@dracord/app-theme';

type Line = { key: string; name: string; text: string; at: number };

/** A7 — mobil: kanaldaki altyazıları göster (kendi konuşmanı altyazılamak web/masaüstünde) */
export function CaptionsStrip({ client, guildId, channelId }: { client: DracordClient; guildId: string; channelId: string }) {
  const [on, setOn] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    setLines([]);
    if (!on) return;
    const off = client.onVoiceCaption((raw) => {
      const p = sanitizeCaption(raw);
      if (!p || p.guildId !== guildId || p.channelId !== channelId) return;
      const uid = String((raw as VoiceCaptionPayload).userId ?? '');
      const key = `${uid}:${p.id}`;
      const t = Date.now();
      setLines((prev) =>
        [...prev.filter((l) => l.key !== key && t - l.at < CAPTION_LIMITS.holdMs), { key, name: (raw as VoiceCaptionPayload).userName || 'Üye', text: p.text, at: t }].slice(-3),
      );
    });
    const timer = setInterval(() => setLines((prev) => prev.filter((l) => Date.now() - l.at < CAPTION_LIMITS.holdMs)), 1000);
    return () => {
      off();
      clearInterval(timer);
    };
  }, [client, guildId, channelId, on]);

  return (
    <View style={{ marginHorizontal: 12, marginTop: 8, gap: 6 }}>
      <Pressable
        onPress={() => setOn((v) => !v)}
        style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: on ? colors.primary : colors.surfaceHigh }}
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
      >
        <Text style={{ color: on ? colors.primaryOn : colors.text, fontWeight: '700', fontSize: 12 }}>CC Altyazı {on ? 'açık' : 'kapalı'}</Text>
      </Pressable>
      {on
        ? lines.map((l) => (
            <Text key={l.key} style={{ color: '#fff', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: '#8be9fd', fontWeight: '700' }}>{l.name}: </Text>
              {l.text}
            </Text>
          ))
        : null}
    </View>
  );
}
