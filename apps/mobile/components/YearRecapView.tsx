import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import type { YearRecapDto } from '@dracord/types';

type Client = { getYearRecap(year?: number): Promise<YearRecapDto> };

interface Props {
  client: Client;
  name: string;
}

const nf = new Intl.NumberFormat('tr-TR');
const hours = (m: number) => (m >= 120 ? `${nf.format(Math.round(m / 60))} saat` : `${nf.format(m)} dk`);
const CARD = ['#2a1458', '#0b4a6a', '#7a2a14', '#26307a', '#2a5a1a', '#6a1a40'];

/** Yıl özeti (mobil): kart kart, metin olarak paylaşılır. */
export function YearRecapView({ client, name }: Props) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(new Date().getMonth() === 0 ? thisYear - 1 : thisYear);
  const [r, setR] = useState<YearRecapDto | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setR(null);
    setErr(null);
    client
      .getYearRecap(year)
      .then((d) => alive && setR(d))
      .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : 'Özet yüklenemedi'));
    return () => {
      alive = false;
    };
  }, [client, year]);

  const share = () => {
    if (!r) return;
    void Share.share({
      message: `Dracord ${r.year} özetim ${r.persona.emoji} ${r.persona.title}\n${nf.format(r.messages)} mesaj · ${hours(r.voiceMinutes)} seste · ${r.longestStreak} gün seri${r.games.played ? ` · ${r.games.played} oyun` : ''}\ndracord.com.tr`,
    });
  };

  const cards: { k: string; top: string; big: string; sub?: string }[] = r
    ? [
        { k: 'p', top: `${r.year} yılında sen…`, big: `${r.persona.emoji} ${r.persona.title}`, sub: r.persona.desc },
        { k: 'm', top: 'Bu yıl', big: `${nf.format(r.messages)} mesaj`, sub: `${nf.format(r.activeDays)} aktif gün · en uzun seri ${r.longestStreak} gün` },
        ...(r.voiceMinutes ? [{ k: 'v', top: 'Ses kanallarında', big: `🎙️ ${hours(r.voiceMinutes)}` }] : []),
        ...(r.topFriends.length
          ? [{ k: 'f', top: 'En çok yazıştıkların', big: r.topFriends.map((f) => f.displayName).join(', '), sub: `${nf.format(r.topFriends[0]!.messages)} mesajla ${r.topFriends[0]!.displayName} ilk sırada` }]
          : []),
        ...(r.topGuilds.length ? [{ k: 'g', top: 'Evin gibi olan sunucu', big: r.topGuilds[0]!.name, sub: `${nf.format(r.topGuilds[0]!.messages)} mesaj` }] : []),
        ...(r.topEmojis.length ? [{ k: 'e', top: 'Favori tepkilerin', big: r.topEmojis.map((e) => e.emoji).join(' '), sub: `${nf.format(r.reactionsGiven)} tepki` }] : []),
        ...(r.games.played
          ? [{ k: 'o', top: 'Oyun masasında', big: `🎮 ${nf.format(r.games.played)} oyun`, sub: `${nf.format(r.games.won)} galibiyet${r.tournamentsWon ? ` · 🏆 ${r.tournamentsWon} turnuva` : ''}` }]
          : []),
      ]
    : [];

  return (
    <View style={s.wrap}>
      <View style={s.years}>
        {[thisYear, thisYear - 1].map((y) => (
          <Pressable key={y} onPress={() => setYear(y)} accessibilityRole="button" accessibilityState={{ selected: y === year }} style={[s.yearBtn, y === year && s.yearOn]}>
            <Text style={s.yearTxt}>{y}</Text>
          </Pressable>
        ))}
      </View>
      {err && <Text style={s.err}>{err}</Text>}
      {!r && !err && <ActivityIndicator color="#fff" />}
      {r && <Text style={s.hello}>Merhaba {name}, işte yılın 👇</Text>}
      {cards.map((c, i) => (
        <View key={c.k} style={[s.card, { backgroundColor: CARD[i % CARD.length] }]}>
          <Text style={s.top}>{c.top}</Text>
          <Text style={s.big}>{c.big}</Text>
          {c.sub ? <Text style={s.sub}>{c.sub}</Text> : null}
        </View>
      ))}
      {r && (
        <Pressable onPress={share} accessibilityRole="button" style={s.share}>
          <Text style={s.shareTxt}>Özetimi paylaş</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },
  years: { flexDirection: 'row', gap: 8 },
  yearBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  yearOn: { backgroundColor: '#d9467a' },
  yearTxt: { color: '#fff', fontWeight: '700' },
  err: { color: '#ff8a8a' },
  hello: { color: '#fff', fontSize: 16 },
  card: { borderRadius: 22, padding: 20, gap: 6 },
  top: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  big: { color: '#fff', fontSize: 28, fontWeight: '900' },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  share: { marginTop: 4, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  shareTxt: { color: '#000', fontWeight: '800' },
});
