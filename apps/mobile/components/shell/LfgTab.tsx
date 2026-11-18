import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import type { DracordClient } from '@dracord/sdk';
import type { LfgListingDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';

const left = (iso: string) => {
  const m = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)} sa ${m % 60} dk` : `${m} dk`;
};

function Btn({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={{ paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', borderRadius: 10, backgroundColor: primary ? colors.primary : colors.surfaceHigh, opacity: disabled ? 0.5 : 1 }}
    >
      <Text style={{ color: primary ? colors.primaryOn : colors.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const input = { borderWidth: 1, borderColor: colors.surfaceHigh, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text } as const;

/** C5 — takım arama ilanları (mobil): gör, katıl/ayrıl, ilan aç */
export function LfgTab({ client, guildId, meId }: { client: DracordClient; guildId: string; meId: string }) {
  const [list, setList] = useState<LfgListingDto[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [game, setGame] = useState('');
  const [slots, setSlots] = useState('5');
  const [rank, setRank] = useState('');
  const [note, setNote] = useState('');
  const [voiceOn, setVoiceOn] = useState(true);

  const upsert = (l: LfgListingDto) =>
    setList((prev) => {
      const rest = (prev ?? []).filter((x) => x.id !== l.id);
      return l.closed ? rest : [l, ...rest];
    });

  useEffect(() => {
    let alive = true;
    void client.listLfg(guildId).then((l) => alive && setList(l)).catch(() => alive && setList([]));
    const off = client.onLfgUpdate((l) => l.guildId === guildId && upsert(l));
    return () => {
      alive = false;
      off();
    };
  }, [client, guildId]);

  const run = (fn: () => Promise<LfgListingDto>) =>
    void fn()
      .then(upsert)
      .catch((e) => Alert.alert('Takım ara', e instanceof Error ? e.message : 'İşlem başarısız'));

  const publish = () =>
    run(async () => {
      const l = await client.createLfg(guildId, { game, slots: Number(slots) || 2, rank: rank || null, note: note || null, voice: voiceOn });
      setCreating(false);
      setGame('');
      setNote('');
      return l;
    });

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
      <Btn label={creating ? 'Vazgeç' : 'İlan aç'} primary={!creating} onPress={() => setCreating(!creating)} />
      {creating ? (
        <View style={{ gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.surfaceHigh }}>
          <TextInput style={input} value={game} onChangeText={setGame} placeholder="Oyun" placeholderTextColor={colors.textMuted} maxLength={60} accessibilityLabel="Oyun" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[input, { width: 80 }]} value={slots} onChangeText={setSlots} keyboardType="number-pad" accessibilityLabel="Kişi sayısı" />
            <TextInput style={[input, { flex: 1 }]} value={rank} onChangeText={setRank} placeholder="Rank" placeholderTextColor={colors.textMuted} maxLength={40} accessibilityLabel="Rank" />
          </View>
          <TextInput style={input} value={note} onChangeText={setNote} placeholder="Not" placeholderTextColor={colors.textMuted} maxLength={200} accessibilityLabel="Not" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Switch value={voiceOn} onValueChange={setVoiceOn} accessibilityLabel="Sesli" />
            <Text style={{ color: colors.text, flex: 1 }}>Sesli</Text>
            <Btn label="Yayınla" primary disabled={!game.trim()} onPress={publish} />
          </View>
        </View>
      ) : null}
      {list === null ? <Text style={{ color: colors.textMuted }}>Yükleniyor…</Text> : null}
      {list?.length === 0 ? <Text style={{ color: colors.textMuted }}>Açık ilan yok. İlk ilanı sen aç!</Text> : null}
      {(list ?? []).map((l) => {
        const inIt = l.memberIds.includes(meId);
        const full = l.memberIds.length >= l.slots;
        return (
          <View key={l.id} style={{ padding: 12, borderRadius: 12, backgroundColor: colors.surfaceHigh, gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>
              {l.game}
              {l.rank ? `  ·  ${l.rank}` : ''}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {l.memberIds.length}/{l.slots} kişi{l.voice ? ' · sesli' : ''} · {left(l.expiresAt)} kaldı
            </Text>
            {l.note ? <Text style={{ color: colors.text }}>{l.note}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {inIt ? (
                <Btn label={l.authorId === meId ? 'Kapat' : 'Ayrıl'} onPress={() => run(() => client.leaveLfg(l.id))} />
              ) : (
                <Btn label={full ? 'Dolu' : 'Katıl'} primary disabled={full} onPress={() => run(() => client.joinLfg(l.id))} />
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
