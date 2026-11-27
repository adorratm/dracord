import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { DracordClient } from '@dracord/sdk';
import { CAPTION_LIMITS, sanitizeCaption, type VoiceCaptionPayload } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import {
  canCaptionSelf,
  canTranslateOnDevice,
  speechErrorText,
  speechModule,
  SPEECH_IOS_CATEGORY,
  translateOnDevice,
} from '../../lib/native-ml';
import { preferredTranslateTarget } from '../../lib/translate';

type Line = { key: string; name: string; text: string; at: number; translated?: string };

const SEND_EVERY_MS = 350;

function localeTag(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'tr-TR';
  } catch {
    return 'tr-TR';
  }
}

/**
 * A7 — mobil altyazı: kanaldakilerin altyazısı, cihaz üstü çevirisi ve (yeni sürümde)
 * kendi konuşmanı altyazılama. Native modül yoksa yalnız izleme kalır.
 */
export function CaptionsStrip({
  client,
  guildId,
  channelId,
  me,
}: {
  client: DracordClient;
  guildId: string;
  channelId: string;
  me?: { id: string; name: string } | null;
}) {
  const [on, setOn] = useState(false);
  const [translate, setTranslate] = useState(false);
  const [mine, setMine] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const translateRef = useRef(translate);
  translateRef.current = translate;
  const canSelf = canCaptionSelf();
  const canTr = canTranslateOnDevice();

  const upsert = useCallback((l: Line) => {
    const t = Date.now();
    setLines((prev) => [...prev.filter((x) => x.key !== l.key && t - x.at < CAPTION_LIMITS.holdMs), l].slice(-3));
  }, []);

  // başkalarının altyazısı (+ isteğe bağlı çeviri)
  useEffect(() => {
    setLines([]);
    if (!on) return;
    const off = client.onVoiceCaption((raw) => {
      const p = sanitizeCaption(raw);
      if (!p || p.guildId !== guildId || p.channelId !== channelId) return;
      const uid = String((raw as VoiceCaptionPayload).userId ?? '');
      const key = `${uid}:${p.id}`;
      upsert({ key, name: (raw as VoiceCaptionPayload).userName || 'Üye', text: p.text, at: Date.now() });
      if (p.final && translateRef.current) {
        void translateOnDevice(p.text, preferredTranslateTarget(), p.lang ?? null).then((r) => {
          if (!r.ok) return;
          setLines((prev) => prev.map((l) => (l.key === key ? { ...l, translated: r.text } : l)));
        });
      }
    });
    const timer = setInterval(() => setLines((prev) => prev.filter((l) => Date.now() - l.at < CAPTION_LIMITS.holdMs)), 1000);
    return () => {
      off();
      clearInterval(timer);
    };
  }, [client, guildId, channelId, on, upsert]);

  // kendi konuşmanı altyazıla
  useEffect(() => {
    if (!mine || !on) return;
    const m = speechModule();
    if (!m) return;
    let alive = true;
    let seg = `${Date.now().toString(36)}`;
    let lastSent = 0;
    const lang = localeTag();
    const short = lang.split('-')[0]!.toLowerCase();
    const send = (text: string, final: boolean) => {
      const now = Date.now();
      if (!final && now - lastSent < SEND_EVERY_MS) return;
      lastSent = now;
      const clipped = text.trim().slice(0, CAPTION_LIMITS.textMax);
      if (!clipped) return;
      client.sendVoiceCaption({ guildId, channelId, id: seg, text: clipped, final, lang: short });
      if (me) upsert({ key: `${me.id}:${seg}`, name: me.name, text: clipped, at: now });
      if (final) seg = `${Date.now().toString(36)}`;
    };
    const opts = {
      lang,
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      iosCategory: SPEECH_IOS_CATEGORY,
    };
    const subs = [
      m.addListener('result', (e) => {
        const text = e.results?.[0]?.transcript ?? '';
        send(text, e.isFinal);
      }),
      m.addListener('error', (e) => {
        if (!alive || e.error === 'no-speech' || e.error === 'aborted') return;
        setNote(speechErrorText(e.error));
        setMine(false);
      }),
      m.addListener('end', () => {
        // sessizlikte servis kapanabiliyor: açık kaldıkça yeniden başlat
        if (alive) {
          try {
            m.start(opts);
          } catch {
            setMine(false);
          }
        }
      }),
    ];
    void m
      .requestPermissionsAsync()
      .then((p) => {
        if (!alive) return;
        if (!p.granted) {
          setNote(speechErrorText('not-allowed'));
          setMine(false);
          return;
        }
        setNote(null);
        m.start(opts);
      })
      .catch(() => {
        setNote(speechErrorText('service-not-allowed'));
        setMine(false);
      });
    return () => {
      alive = false;
      subs.forEach((s) => s.remove());
      try {
        m.abort();
      } catch {
        /* zaten durmuş */
      }
    };
  }, [mine, on, client, guildId, channelId, me, upsert]);

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      style={{ paddingHorizontal: 10, paddingVertical: 6, minHeight: 32, justifyContent: 'center', borderRadius: 999, backgroundColor: active ? colors.primary : colors.surfaceHigh }}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
    >
      <Text style={{ color: active ? colors.primaryOn : colors.text, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ marginHorizontal: 12, marginTop: 8, gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {chip(`CC Altyazı ${on ? 'açık' : 'kapalı'}`, on, () => {
          setOn((v) => !v);
          if (on) setMine(false);
        })}
        {on && canTr ? chip('Çevir', translate, () => setTranslate((v) => !v)) : null}
        {on && canSelf ? chip(mine ? 'Konuşmamı altyazılıyor' : 'Konuşmamı altyazıla', mine, () => setMine((v) => !v)) : null}
      </View>
      {note ? <Text style={{ color: colors.danger, fontSize: 12 }}>{note}</Text> : null}
      {on
        ? lines.map((l) => (
            <Text key={l.key} style={{ color: '#fff', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: '#8be9fd', fontWeight: '700' }}>{l.name}: </Text>
              {translate && l.translated ? l.translated : l.text}
              {translate && l.translated ? <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{`\n${l.text}`}</Text> : null}
            </Text>
          ))
        : null}
    </View>
  );
}
