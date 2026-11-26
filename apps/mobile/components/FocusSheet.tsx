import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { focusStateAt, type FocusPhase, type FocusSessionDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';
import { Icon } from './Icon';

const PRESETS = [
  { label: '25 / 5', focusMin: 25, breakMin: 5, longBreakMin: 15 },
  { label: '50 / 10', focusMin: 50, breakMin: 10, longBreakMin: 20 },
  { label: '90 / 15', focusMin: 90, breakMin: 15, longBreakMin: 30 },
] as const;

const PHASE: Record<FocusPhase, { label: string; color: string; hint: string }> = {
  idle: { label: 'Hazır', color: colors.outline, hint: 'Birlikte odaklanmak için bir süre seç.' },
  focus: { label: 'Odak', color: '#ff79c6', hint: 'Bildirimleri sustur, işine dön.' },
  break: { label: 'Kısa mola', color: '#50fa7b', hint: 'Kalk, su iç, gözlerini dinlendir.' },
  long: { label: 'Uzun mola', color: '#8be9fd', hint: 'Güzel iş! Biraz uzun bir ara ver.' },
};

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** D6 — kanalın ortak odak zamanlayıcısı (mobil): evre değişince titreşir */
export function FocusSheet({ channelId, open, onClose }: { channelId: string; open: boolean; onClose: () => void }) {
  const { client } = useAuth();
  const [session, setSession] = useState<FocusSessionDto | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const prev = useRef<FocusPhase | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    client.connectSocket();
    client.joinChannel(channelId);
    void client
      .getFocus(channelId)
      .then((s) => alive && setSession(s))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Yüklenemedi'));
    const off = client.onFocusEvent((s) => s.channelId === channelId && setSession(s));
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => {
      alive = false;
      off();
      clearInterval(id);
    };
  }, [client, channelId, open]);

  const st = session ? focusStateAt(session, now) : null;
  useEffect(() => {
    if (!st) return;
    if (prev.current && prev.current !== st.phase && st.phase !== 'idle') {
      try {
        Vibration.vibrate([0, 120, 80, 120]);
      } catch {
        /* izin yoksa sessiz geç */
      }
    }
    prev.current = st.phase;
  }, [st?.phase, st]);

  const run = (p: Promise<FocusSessionDto>) => {
    setError(null);
    void p.then(setSession).catch((e) => setError(e instanceof Error ? e.message : 'İşlem başarısız'));
  };

  const meta = PHASE[st?.phase ?? 'idle'];
  const left = !st || st.phase === 'idle' ? (session?.focusMin ?? 25) * 60_000 : st.endsAt - now;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => undefined}>
          <View style={s.head}>
            <Text style={s.title}>Odak zamanlayıcısı</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={12}>
              <Icon name="close" size={22} />
            </Pressable>
          </View>
          <View style={[s.ring, { borderColor: meta.color }]} accessibilityRole="timer" accessibilityLabel={`${meta.label}, ${mmss(left)} kaldı`}>
            <Text style={[s.phase, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
            <Text style={s.time}>{mmss(left)}</Text>
            {st && st.phase !== 'idle' ? <Text style={s.muted}>Tur {st.round}</Text> : null}
          </View>
          <Text style={[s.muted, { textAlign: 'center', marginBottom: 14 }]}>{meta.hint}</Text>
          {!st || st.phase === 'idle' ? (
            <View style={s.row}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  style={s.btn}
                  accessibilityRole="button"
                  onPress={() => run(client.startFocus(channelId, { ...p, longEvery: 4 }))}
                >
                  <Text style={s.btnText}>▶ {p.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={s.row}>
              <Pressable style={s.btn} accessibilityRole="button" onPress={() => run(client.stopFocus(channelId))}>
                <Text style={s.btnText}>■ Bitir</Text>
              </Pressable>
              <Pressable style={s.btn} accessibilityRole="button" onPress={() => session && run(client.startFocus(channelId, session))}>
                <Text style={s.btnText}>↺ Baştan</Text>
              </Pressable>
            </View>
          )}
          {error ? <Text style={{ color: colors.danger, marginTop: 10, textAlign: 'center' }}>{error}</Text> : null}
          <Text style={[s.muted, { textAlign: 'center', marginTop: 14 }]}>Kanaldaki herkes aynı sayacı görür.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 40 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  ring: { alignSelf: 'center', width: 200, height: 200, borderRadius: 100, borderWidth: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  phase: { fontSize: 13, fontWeight: '700', letterSpacing: 2 },
  time: { color: colors.text, fontSize: 46, fontWeight: '600', fontVariant: ['tabular-nums'] },
  muted: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8 },
  btn: { backgroundColor: colors.surfaceHigh, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  btnText: { color: colors.text, fontWeight: '600' },
});
