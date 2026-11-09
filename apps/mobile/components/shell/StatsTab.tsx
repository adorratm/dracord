import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { DracordClient } from '@dracord/sdk';
import { GUILD_STATS_RANGES, type GuildStatsDto, type GuildStatsRange } from '@dracord/types';
import { colors } from '@dracord/app-theme';

const nf = (n: number) => n.toLocaleString('tr-TR');
const dayLabel = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, day).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

/** Sunucu istatistikleri (B2) — mobil özet. MANAGE_GUILD (API denetler). */
export function StatsTab({ client, guildId }: { client: DracordClient; guildId: string }) {
  const [days, setDays] = useState<GuildStatsRange>(30);
  const [data, setData] = useState<GuildStatsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    setSel(null);
    client
      .getGuildStats(guildId, days)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Yüklenemedi'));
    return () => {
      alive = false;
    };
  }, [client, guildId, days]);

  const max = Math.max(1, ...(data?.daily.map((d) => d.messages) ?? [1]));
  const picked = sel !== null && data ? data.daily[sel] : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {GUILD_STATS_RANGES.map((r) => (
          <Pressable
            key={r}
            onPress={() => setDays(r)}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: days === r ? colors.primary : colors.surfaceHigh }}
          >
            <Text style={{ color: days === r ? colors.primaryOn : colors.text, fontWeight: '700', fontSize: 12 }}>{r} gün</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {!data && !error ? <Text style={{ color: colors.textMuted }}>Yükleniyor…</Text> : null}
      {data ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Tile label="Üye" value={nf(data.memberCount)} sub={`+${data.totals.joins} / −${data.totals.leaves}`} />
            <Tile label="Mesaj" value={nf(data.totals.messages)} />
            <Tile label="Aktif üye" value={nf(data.totals.activeMembers)} />
            <Tile label="Ses" value={`${nf(data.totals.voiceMinutes)} dk`} />
          </View>
          <View style={{ backgroundColor: colors.surfaceHigh, borderRadius: 12, padding: 10, gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Günlük mesaj</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, minHeight: 16 }}>
              {picked
                ? `${dayLabel(picked.day)} · ${nf(picked.messages)} mesaj · ${picked.activeMembers} aktif`
                : `En yüksek: ${nf(max)} — çubuğa dokun`}
            </Text>
            <View style={{ height: 110, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
              {data.daily.map((d, i) => (
                <Pressable
                  key={d.day}
                  onPress={() => setSel(i)}
                  style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
                  accessibilityLabel={`${dayLabel(d.day)} ${d.messages} mesaj`}
                >
                  <View
                    style={{
                      height: d.messages > 0 ? `${Math.max(2, (d.messages / max) * 100)}%` : 0,
                      borderTopLeftRadius: 3,
                      borderTopRightRadius: 3,
                      backgroundColor: sel === i ? colors.text : colors.primary,
                    }}
                  />
                </Pressable>
              ))}
            </View>
          </View>
          <Rank title="En aktif kanallar" rows={data.topChannels.map((c) => [`#${c.name}`, c.messages])} />
          <Rank title="En çok yazanlar" rows={data.topMembers.map((m) => [m.displayName, m.messages])} />
        </>
      ) : null}
    </ScrollView>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surfaceHigh, borderRadius: 12, padding: 10 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      {sub ? <Text style={{ color: colors.textMuted, fontSize: 11 }}>{sub}</Text> : null}
    </View>
  );
}

function Rank({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <View style={{ backgroundColor: colors.surfaceHigh, borderRadius: 12, padding: 10, gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{title}</Text>
      {rows.length === 0 ? <Text style={{ color: colors.textMuted }}>Bu dönemde mesaj yok.</Text> : null}
      {rows.map(([label, n]) => (
        <View key={label} style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row' }}>
            <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
              {label}
            </Text>
            <Text style={{ color: colors.textMuted }}>{nf(n)}</Text>
          </View>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${(n / max) * 100}%`, backgroundColor: colors.primary }} />
          </View>
        </View>
      ))}
    </View>
  );
}
