import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import type { DracordClient } from '@dracord/sdk';
import {
  TOURNAMENT_AUTO_RESULT_GAMES,
  TOURNAMENT_FORMAT_LABEL,
  TOURNAMENT_GAME_LABEL,
  TOURNAMENT_LIMITS,
  roundRobinStandings,
  tournamentMatchPlayers,
  type TournamentDto,
  type TournamentFormat,
  type TournamentMatch,
} from '@dracord/types';
import { colors } from '@dracord/app-theme';

const STATUS_TR: Record<TournamentDto['status'], string> = {
  registration: 'Kayıt açık',
  running: 'Devam ediyor',
  finished: 'Bitti',
  cancelled: 'İptal',
};
const gameLabel = (t: TournamentDto) => (t.game === 'external' ? t.externalGameName || 'Harici oyun' : TOURNAMENT_GAME_LABEL[t.game]);
const roundName = (r: number, n: number, f: TournamentFormat = 'single') =>
  f === 'round_robin' ? `${r}. tur` : r === n ? 'Final' : r === n - 1 ? 'Yarı final' : r === n - 2 && f === 'single' ? 'Çeyrek final' : `${r}. tur`;
const matchRows = (m: TournamentMatch): Array<string | null> => {
  if (!m.players) return [m.p1, m.p2];
  const out: Array<string | null> = [...m.players];
  while (out.length < (m.slots ?? 2)) out.push(null);
  return out;
};

function Btn({ label, onPress, primary, danger, disabled }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: primary ? colors.primary : colors.surfaceHigh,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: primary ? colors.primaryOn : danger ? colors.danger : colors.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/** Turnuvalar (C2) — mobil: görüntüle, katıl, sonuç bildir; düzenleyici başlat/karar ver. Oluşturma web/desktop'ta. */
export function TournamentsTab({ client, guildId, meId, canManage }: { client: DracordClient; guildId: string; meId: string; canManage: boolean }) {
  const [list, setList] = useState<TournamentDto[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upsert = useCallback((t: TournamentDto) => {
    setList((prev) => {
      const cur = prev ?? [];
      return cur.some((x) => x.id === t.id) ? cur.map((x) => (x.id === t.id ? t : x)) : [t, ...cur];
    });
  }, []);

  useEffect(() => {
    let alive = true;
    void client.listTournaments(guildId).then((l) => alive && setList(l)).catch(() => alive && setList([]));
    const off = client.onTournamentUpdate((t) => t.guildId === guildId && upsert(t));
    return () => {
      alive = false;
      off();
    };
  }, [client, guildId, upsert]);

  const run = (fn: () => Promise<TournamentDto>) => {
    setBusy(true);
    void fn()
      .then(upsert)
      .catch((e) => Alert.alert('Turnuva', e instanceof Error ? e.message : 'İşlem başarısız'))
      .finally(() => setBusy(false));
  };

  const t = list?.find((x) => x.id === openId) ?? null;
  const names = useMemo(() => new Map((t?.participants ?? []).map((p) => [p.userId, p.displayName])), [t]);

  if (!t) {
    return (
      <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Tek eleme, lig ya da 4'lü masa. Yeni turnuvayı web veya masaüstünden oluştur.</Text>
        {list === null ? <Text style={{ color: colors.textMuted }}>Yükleniyor…</Text> : null}
        {list?.length === 0 ? <Text style={{ color: colors.textMuted }}>Henüz turnuva yok.</Text> : null}
        {(list ?? []).map((x) => (
          <Pressable key={x.id} onPress={() => setOpenId(x.id)} style={{ padding: 12, borderRadius: 12, backgroundColor: colors.surfaceHigh }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>🏆 {x.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {gameLabel(x)} · {TOURNAMENT_FORMAT_LABEL[x.format ?? 'single']} · {STATUS_TR[x.status]} · {x.participants.length}/{x.maxPlayers}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  const manage = canManage || t.creatorId === meId;
  const joined = t.participants.some((p) => p.userId === meId);
  const format = t.format ?? 'single';
  const auto = TOURNAMENT_AUTO_RESULT_GAMES.includes(t.game);
  const mineList: TournamentMatch[] =
    t.status === 'running'
      ? t.matches.filter((m) => (m.status === 'ready' || m.status === 'disputed') && tournamentMatchPlayers(m).includes(meId))
      : [];
  const champ = t.winnerId ? names.get(t.winnerId) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
      <Pressable onPress={() => setOpenId(null)}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>‹ Turnuvalar</Text>
      </Pressable>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{t.name}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        {gameLabel(t)} · {TOURNAMENT_FORMAT_LABEL[format]} · {STATUS_TR[t.status]} · {t.participants.length}/{t.maxPlayers} oyuncu
      </Text>
      {t.description ? <Text style={{ color: colors.text }}>{t.description}</Text> : null}
      {champ ? <Text style={{ color: colors.text, fontWeight: '800' }}>🏆 Şampiyon: {champ}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {t.status === 'registration' ? (
          joined ? (
            <Btn label="Kaydımı sil" disabled={busy} onPress={() => run(() => client.tournamentAction(t.id, 'leave'))} />
          ) : (
            <Btn label={t.participants.length >= t.maxPlayers ? 'Dolu' : 'Katıl'} primary disabled={busy || t.participants.length >= t.maxPlayers} onPress={() => run(() => client.tournamentAction(t.id, 'join'))} />
          )
        ) : null}
        {manage && t.status === 'registration' ? (
          <Btn label="Başlat" primary disabled={busy || t.participants.length < TOURNAMENT_LIMITS.minPlayers} onPress={() => run(() => client.tournamentAction(t.id, 'start'))} />
        ) : null}
        {manage && (t.status === 'registration' || t.status === 'running') ? (
          <Btn
            label="İptal et"
            danger
            disabled={busy}
            onPress={() =>
              Alert.alert('Turnuvayı iptal et', 'Emin misin?', [
                { text: 'Vazgeç', style: 'cancel' },
                { text: 'İptal et', style: 'destructive', onPress: () => run(() => client.tournamentAction(t.id, 'cancel')) },
              ])
            }
          />
        ) : null}
      </View>

      {mineList.map((mine) => {
        const others = tournamentMatchPlayers(mine).filter((p) => p !== meId);
        const table = others.length > 1;
        const rep = mine.reports[meId];
        return (
          <View key={mine.id} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.primary, gap: 6 }}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
              {roundName(mine.round, t.rounds, format)} · {table ? 'senin masan' : 'senin maçın'}
            </Text>
            <Text style={{ color: colors.text }}>
              {table ? 'Masadakiler' : 'Rakip'}: {others.map((o) => names.get(o) ?? 'Oyuncu').join(', ')}
            </Text>
            <Text style={{ color: mine.status === 'disputed' ? colors.danger : colors.textMuted, fontSize: 12 }}>
              {mine.status === 'disputed'
                ? 'Bildirimler uyuşmadı — düzenleyici karar verecek.'
                : rep
                  ? `Bildirdin — ${table ? 'masadan bir onay daha' : 'rakibin onayı'} bekleniyor.`
                  : auto
                    ? `${TOURNAMENT_GAME_LABEL[t.game]} oyun kanalında birlikte oynayın — sonuç kendiliğinden işlenir.`
                    : 'Oynadıktan sonra sonucu bildir.'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Btn label="Ben kazandım" primary disabled={busy || rep === meId} onPress={() => run(() => client.reportTournamentMatch(t.id, mine.id, meId))} />
              {others.map((o) => (
                <Btn
                  key={o}
                  label={table ? `${names.get(o) ?? 'Oyuncu'} kazandı` : 'Rakip kazandı'}
                  disabled={busy || rep === o}
                  onPress={() => run(() => client.reportTournamentMatch(t.id, mine.id, o))}
                />
              ))}
            </View>
          </View>
        );
      })}

      {format === 'round_robin' && t.status !== 'registration' ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Puan durumu</Text>
          {roundRobinStandings(t.matches, t.participants.map((p) => p.userId)).map((r, i) => (
            <Text key={r.userId} style={{ color: colors.text }}>
              {i + 1}. {names.get(r.userId) ?? 'Ayrılmış üye'} — {r.wins} G ({r.played}/{t.participants.length - 1})
            </Text>
          ))}
        </View>
      ) : null}

      {t.status === 'registration' ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Kayıtlılar</Text>
          {t.participants.map((p) => (
            <Text key={p.userId} style={{ color: colors.text }}>
              • {p.displayName}
            </Text>
          ))}
        </View>
      ) : (
        Array.from({ length: t.rounds }, (_, i) => i + 1).map((r) => (
          <View key={r} style={{ gap: 6 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>{roundName(r, t.rounds, format).toUpperCase()}</Text>
            {t.matches
              .filter((m) => m.round === r)
              .sort((a, b) => a.index - b.index)
              .map((m) => (
                <View
                  key={m.id}
                  style={{ borderRadius: 10, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: m.status === 'disputed' ? colors.danger : 'transparent' }}
                >
                  {matchRows(m).map((p, k) => (
                    <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text
                        style={{
                          flex: 1,
                          color: m.winnerId && p === m.winnerId ? colors.text : colors.textMuted,
                          fontWeight: m.winnerId && p === m.winnerId ? '800' : '400',
                          textDecorationLine: m.winnerId && p !== m.winnerId ? 'line-through' : 'none',
                        }}
                        numberOfLines={1}
                      >
                        {p ? (names.get(p) ?? 'Ayrılmış üye') : m.bye ? 'rakipsiz' : '—'}
                        {m.winnerId && p === m.winnerId ? ' ✓' : ''}
                      </Text>
                      {manage && p && (m.status === 'ready' || m.status === 'disputed') ? (
                        <Pressable disabled={busy} onPress={() => run(() => client.reportTournamentMatch(t.id, m.id, p, true))} hitSlop={6}>
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>kazandı</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}
