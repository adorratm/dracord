import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { DracordClient } from '@dracord/sdk';
import type { ChallengesDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';

const nf = (n: number) => n.toLocaleString('tr-TR');

/** Haftalık görevler + sezon özeti (C3) — mobil, Seviyeler sekmesinin başında */
export function ChallengesCard({ client, guildId }: { client: DracordClient; guildId: string }) {
  const [d, setD] = useState<ChallengesDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState<'week' | 'season'>('week');

  useEffect(() => {
    let alive = true;
    void client.getChallenges(guildId).then((x) => alive && setD(x)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [client, guildId]);

  if (!d || !d.enabled) return null;
  const rows = (board === 'week' ? d.weekly : d.seasonBoard).slice(0, 5);
  const me = board === 'week' ? { s: d.me.weekScore, r: d.me.weekRank } : { s: d.me.seasonScore, r: d.me.seasonRank };

  return (
    <View style={{ gap: 8, marginBottom: 10 }}>
      <Text style={{ color: colors.text, fontWeight: '800' }}>Bu haftanın görevleri</Text>
      {d.challenges.map((c) => (
        <View key={c.id} style={{ padding: 10, borderRadius: 12, backgroundColor: colors.surfaceHigh, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.text, flex: 1, fontWeight: '600' }}>{c.label}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>+{c.rewardXp} XP</Text>
            {c.claimed ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>✓ Alındı</Text>
            ) : c.done ? (
              <Pressable
                disabled={busy}
                onPress={() => {
                  setBusy(true);
                  void client
                    .claimChallenge(guildId, c.id)
                    .then(setD)
                    .catch((e) => Alert.alert('Görev', e instanceof Error ? e.message : 'Alınamadı'))
                    .finally(() => setBusy(false));
                }}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primary, opacity: busy ? 0.5 : 1 }}
              >
                <Text style={{ color: colors.primaryOn, fontWeight: '700', fontSize: 12 }}>Ödülü al</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${Math.round((c.progress / c.target) * 100)}%`, backgroundColor: colors.primary }} />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            {nf(c.progress)} / {nf(c.target)}
          </Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
        {(['week', 'season'] as const).map((b) => (
          <Pressable
            key={b}
            onPress={() => setBoard(b)}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: board === b ? colors.primary : colors.surfaceHigh }}
          >
            <Text style={{ color: board === b ? colors.primaryOn : colors.text, fontWeight: '700', fontSize: 12 }}>
              {b === 'week' ? 'Bu hafta' : 'Bu sezon (ay)'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{me.r ? `Sen: ${me.r}. · ${nf(me.s)} puan` : 'Henüz puanın yok'}</Text>
      {rows.map((r) => (
        <Text key={r.userId} style={{ color: colors.text }} numberOfLines={1}>
          {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : `${r.rank}.`} {r.displayName} — {nf(r.score)}
        </Text>
      ))}
      <Text style={{ color: colors.text, fontWeight: '800', marginTop: 6 }}>Tüm zamanlar</Text>
    </View>
  );
}
