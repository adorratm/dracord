import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { UserStreakDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';

type Client = { getMyStreak(): Promise<UserStreakDto> };

/** @dracord/ui/lib/streak ile aynı eşik simgeleri (mobil DOM paketini içe almaz) */
function tierIcon(t: number | null): string {
  if (!t) return '';
  return t >= 365 ? '👑' : t >= 100 ? '💎' : t >= 30 ? '🏆' : t >= 14 ? '⭐' : t >= 7 ? '🔥' : '✨';
}

/** Günlük seri kartı (mobil) */
export function StreakView({ client }: { client: Client }) {
  const [s, setS] = useState<UserStreakDto | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    client
      .getMyStreak()
      .then((v) => alive && setS(v))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [client]);

  if (err) return <Text style={st.muted}>Seri bilgisi alınamadı.</Text>;
  if (!s) return <View style={[st.card, { height: 110 }]} />;
  return (
    <View style={st.card}>
      <View style={st.row}>
        <Text style={st.big}>{s.current > 0 ? '🔥' : '🌑'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>{s.current} günlük seri</Text>
          <Text style={st.muted}>
            {s.activeToday
              ? 'Bugünü kaptın ✓'
              : s.current > 0
                ? 'Bugün bir mesaj at ya da 5 dk seste kal, seri bozulmasın.'
                : 'Her gün bir mesaj ya da 5 dk ses ile seri başlat.'}
          </Text>
        </View>
      </View>
      {s.nextMilestone ? (
        <Text style={st.line}>
          Sıradaki rozet: {tierIcon(s.nextMilestone)} {s.nextMilestone} gün · {s.nextMilestone - s.current} gün kaldı
        </Text>
      ) : null}
      <Text style={st.line}>
        🏅 En iyi: {s.best} gün · 🧊 Dondurucu: {s.freezes}/{s.maxFreezes}
        {s.tier ? ` · ${tierIcon(s.tier)} ${s.tier}+ gün rozeti` : ''}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: colors.surfaceHigh, borderRadius: 14, padding: 14, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  big: { fontSize: 40 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  line: { color: colors.text, fontSize: 13, marginTop: 10 },
});
