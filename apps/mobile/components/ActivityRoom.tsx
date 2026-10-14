import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { ActivitySessionDto, ChannelSummary } from '@dracord/types';
import {
  BJ_BET_OPTIONS,
  BJ_DEFAULT_BET,
  bjCardLabel,
  bjHandValue,
  bjParseState,
  GAME_KIND_LABEL,
  watchPartyParseState,
  tavlaReadBoard,
  tavlaReadDice,
  tavlaAllLegal,
  tavlaApplyMove,
  tavlaRemoveDie,
  bowlingReadFrames,
  bowlingScoreRolls,
  bowlingNextShooter,
  billiardsParseBalls,
  billiardsParseGroups,
  COLOR_NAME,
  okeyFromIndicator,
  asTile,
  tilePoints,
} from '@dracord/game-core';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';
import { GameGlHost } from './GameGlHost';
import { primaryBtn, primaryBtnText } from '../lib/ui';

export function ActivityRoom({
  guildId,
  channel,
}: {
  guildId: string;
  channel: ChannelSummary;
}) {
  const { client, user } = useAuth();
  const [session, setSession] = useState<ActivitySessionDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const s = await client.getChannelActivity(guildId, channel.id);
    setSession(s);
    return s;
  }, [client, guildId, channel.id]);

  useEffect(() => {
    void (async () => {
      try {
        let s = await refresh();
        if (!s) s = await client.startActivity({ guildId, channelId: channel.id });
        setSession(s);
        if (user && s && !s.playerIds.includes(user.id) && !s.spectatorIds.includes(user.id)) {
          setSession(await client.joinActivity(s.id, false));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Aktivite açılamadı');
      }
    })();
  }, [client, guildId, channel.id, refresh, user]);

  const kind =
    session?.kind ??
    (channel.type === 'WATCH_PARTY' ? 'watch_party' : channel.gameKind) ??
    'blackjack';

  const patch = async (state: Record<string, unknown>) => {
    if (!session) return;
    setBusy(true);
    try {
      setSession(await client.patchActivityState(session.id, state));
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.danger }}>{error}</Text>
      </View>
    );
  }
  if (!session || !user) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: colors.textMuted }}>Oda hazırlanıyor…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceHigh,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: '700' }}>{channel.name}</Text>
        <Text style={{ color: colors.primary, fontSize: 12 }}>{GAME_KIND_LABEL[kind]}</Text>
        <Pressable onPress={() => void refresh()} disabled={busy}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>↻</Text>
        </Pressable>
      </View>

      {session.kind === 'watch_party' ? (
        <WatchPartyNative session={session} onPatch={patch} />
      ) : session.kind === 'blackjack' ? (
        <BlackjackNative session={session} userId={user.id} busy={busy} onPatch={patch} />
      ) : session.kind === 'tavla' ? (
        <TavlaNative session={session} userId={user.id} busy={busy} onPatch={patch} />
      ) : session.kind === 'bowling' ? (
        <BowlingNative session={session} userId={user.id} busy={busy} onPatch={patch} />
      ) : session.kind === 'billiards' ? (
        <BilliardsNative session={session} userId={user.id} busy={busy} onPatch={patch} />
      ) : session.kind === 'okey' ? (
        <OkeyNative session={session} userId={user.id} busy={busy} onPatch={patch} />
      ) : (
        <View style={{ flex: 1 }}>
          <GameGlHost kind={session.kind} />
          <Text style={{ color: colors.textMuted, padding: 12, fontSize: 12 }}>
            {GAME_KIND_LABEL[session.kind]} · game-core + expo-gl
          </Text>
        </View>
      )}
    </View>
  );
}

function BlackjackNative({
  session,
  userId,
  busy,
  onPatch,
}: {
  session: ActivitySessionDto;
  userId: string;
  busy: boolean;
  onPatch: (state: Record<string, unknown>) => Promise<void>;
}) {
  const st = useMemo(
    () => bjParseState(session.state as Record<string, unknown>, session.playerIds),
    [session],
  );
  const my = st.seats[userId];
  const myVal = my ? bjHandValue(my.cards) : null;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
      <GameGlHost kind="blackjack" />
      <Text style={{ color: colors.textMuted, marginTop: 12 }}>
        Faz: {st.phase} · Chip: {st.bank[userId] ?? 0}
      </Text>
      <Text style={{ color: colors.text, fontWeight: '700', marginTop: 8 }}>Kurpiyer</Text>
      <Text style={{ color: colors.text }}>
        {st.dealer.map((c, i) => (st.holeHidden && i === 1 ? '🂠 ' : `${bjCardLabel(c)} `))}
      </Text>
      <Text style={{ color: colors.text, fontWeight: '700', marginTop: 8 }}>
        Senin elin {myVal ? `(${myVal.total})` : ''}
      </Text>
      <Text style={{ color: colors.text }}>{my?.cards.map((c) => bjCardLabel(c)).join(' ') || '—'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {BJ_BET_OPTIONS.map((b) => (
          <Pressable
            key={b}
            disabled={busy}
            onPress={() =>
              void onPatch({
                ...st,
                pendingBets: { ...st.pendingBets, [userId]: b },
              })
            }
            style={{ paddingHorizontal: 12, height: 36, borderRadius: 10, backgroundColor: colors.primary, justifyContent: 'center' }}
          >
            <Text style={{ color: colors.primaryOn, fontWeight: '700' }}>{b === BJ_DEFAULT_BET ? `${b}★` : b}</Text>
          </Pressable>
        ))}
        <Pressable
          disabled={busy}
          onPress={() => void onPatch({ ...st, phase: 'dealing', round: st.round + 1 })}
          style={{ paddingHorizontal: 12, height: 36, borderRadius: 10, backgroundColor: colors.success, justifyContent: 'center' }}
        >
          <Text style={{ color: colors.primaryOn, fontWeight: '700' }}>Turu başlat</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function TavlaNative({
  session,
  userId,
  busy,
  onPatch,
}: {
  session: ActivitySessionDto;
  userId: string;
  busy: boolean;
  onPatch: (state: Record<string, unknown>) => Promise<void>;
}) {
  const board = tavlaReadBoard(session.state.board);
  const dice = tavlaReadDice(session.state.dice);
  const myIdx = session.playerIds.indexOf(userId);
  const me: 0 | 1 | null = myIdx === 0 ? 0 : myIdx === 1 ? 1 : null;
  const turn = Number(session.state.turn ?? 0);
  const myTurn = me !== null && turn === myIdx;
  const legal = me !== null && dice.length ? tavlaAllLegal(board, me, dice) : [];

  return (
    <ScrollView contentContainerStyle={{ padding: 12 }}>
      <GameGlHost kind="tavla" />
      <Text style={{ color: colors.textMuted, marginTop: 8 }}>
        Sıra: {turn === 0 ? 'Beyaz' : 'Mor'} · Zar: {dice.join(', ') || '—'}
      </Text>
      <Pressable
        disabled={busy || !myTurn}
        style={{ ...primaryBtn, marginTop: 12, opacity: busy || !myTurn ? 0.5 : 1 }}
        onPress={() => {
          const d1 = 1 + Math.floor(Math.random() * 6);
          const d2 = 1 + Math.floor(Math.random() * 6);
          const roll = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
          void onPatch({ ...session.state, dice: roll });
        }}
      >
        <Text style={primaryBtnText}>Zar at</Text>
      </Pressable>
      {legal.slice(0, 8).map((mv, i) => (
        <Pressable
          key={`${mv.from}-${mv.to}-${i}`}
          disabled={busy}
          onPress={() => {
            if (me === null) return;
            const nb = tavlaApplyMove(board, me, mv);
            const nd = tavlaRemoveDie(dice, mv.die);
            void onPatch({ ...session.state, board: nb, dice: nd, turn: nd.length ? turn : 1 - turn });
          }}
          style={{ padding: 10, marginTop: 6, backgroundColor: colors.surfaceHigh, borderRadius: 8 }}
        >
          <Text style={{ color: colors.text }}>
            {String(mv.from)} → {String(mv.to)} (zar {mv.die})
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function BowlingNative({
  session,
  userId,
  busy,
  onPatch,
}: {
  session: ActivitySessionDto;
  userId: string;
  busy: boolean;
  onPatch: (state: Record<string, unknown>) => Promise<void>;
}) {
  const frames = bowlingReadFrames(session.state.frames);
  const rolls = frames[userId] ?? [];
  const score = bowlingScoreRolls(rolls);
  const shooter = bowlingNextShooter(session.playerIds, frames);

  return (
    <ScrollView contentContainerStyle={{ padding: 12 }}>
      <GameGlHost kind="bowling" />
      <Text style={{ color: colors.textMuted, marginTop: 8 }}>
        Skor: {score} · Atış: {rolls.join(', ') || '—'}
      </Text>
      <Text style={{ color: colors.textMuted }}>Sıradaki: {shooter === userId ? 'Sen' : shooter}</Text>
      <Pressable
        disabled={busy || shooter !== userId}
        style={{ ...primaryBtn, marginTop: 12, opacity: busy || shooter !== userId ? 0.5 : 1 }}
        onPress={() => {
          const pins = Math.floor(Math.random() * 11);
          const next = [...rolls, pins];
          void onPatch({
            ...session.state,
            frames: { ...frames, [userId]: next },
          });
        }}
      >
        <Text style={primaryBtnText}>Atış yap</Text>
      </Pressable>
    </ScrollView>
  );
}

function BilliardsNative({
  session,
  userId,
  busy,
  onPatch,
}: {
  session: ActivitySessionDto;
  userId: string;
  busy: boolean;
  onPatch: (state: Record<string, unknown>) => Promise<void>;
}) {
  const balls = billiardsParseBalls(session.state.balls);
  const groups = billiardsParseGroups(session.state.groups);
  const turn = String(session.state.turn ?? session.playerIds[0] ?? '');

  return (
    <ScrollView contentContainerStyle={{ padding: 12 }}>
      <GameGlHost kind="billiards" />
      <Text style={{ color: colors.textMuted, marginTop: 8 }}>
        Toplar: {balls?.filter((b) => !b.sunk).length ?? 0} · Sıra: {turn === userId ? 'Sen' : turn}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        Gruplar: {Object.entries(groups).map(([id, g]) => `${id.slice(0, 4)}:${g}`).join(' ')}
      </Text>
      <Pressable
        disabled={busy || turn !== userId}
        style={{ ...primaryBtn, marginTop: 12, opacity: busy || turn !== userId ? 0.5 : 1 }}
        onPress={() => {
          void onPatch({
            ...session.state,
            shot: { dx: Math.random() - 0.5, dz: Math.random() - 0.5, power: 0.6 + Math.random() * 0.3, by: userId, id: Date.now() },
            turn: session.playerIds[(session.playerIds.indexOf(userId) + 1) % session.playerIds.length],
          });
        }}
      >
        <Text style={primaryBtnText}>Vuruş</Text>
      </Pressable>
    </ScrollView>
  );
}

function OkeyNative({
  session,
  userId,
  busy,
  onPatch,
}: {
  session: ActivitySessionDto;
  userId: string;
  busy: boolean;
  onPatch: (state: Record<string, unknown>) => Promise<void>;
}) {
  const hands = (session.state.hands as Record<string, number[]>) ?? {};
  const myHand = hands[userId] ?? [];
  const indicator = Number(session.state.indicator ?? 0);
  const okey = okeyFromIndicator(indicator);
  const tiles = myHand.map((c) => asTile(c, okey));
  const pts = tiles.reduce((s, t) => s + tilePoints(t.code, okey), 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 12 }}>
      <GameGlHost kind="okey" />
      <Text style={{ color: colors.textMuted, marginTop: 8 }}>
        El: {myHand.length} taş · Puan: {pts} · Okey: {okey ? `${COLOR_NAME[okey.c]} ${okey.n}` : '—'}
      </Text>
      <Text style={{ color: colors.text, marginTop: 8, flexWrap: 'wrap' }}>
        {tiles.map((t, i) => (
          <Text key={i}>
            {t.wild ? '🃏' : `${COLOR_NAME[t.c]?.[0] ?? '?'}${t.n}`}{' '}
          </Text>
        ))}
      </Text>
      <Pressable
        disabled={busy}
        style={{ ...primaryBtn, marginTop: 12 }}
        onPress={() => void onPatch({ ...session.state, phase: 'draw', by: userId })}
      >
        <Text style={primaryBtnText}>Taş çek / sıra</Text>
      </Pressable>
    </ScrollView>
  );
}

function WatchPartyNative({
  session,
  onPatch,
}: {
  session: ActivitySessionDto;
  onPatch: (state: Record<string, unknown>) => Promise<void>;
}) {
  const st = watchPartyParseState(session.state as Record<string, unknown>);
  const [url, setUrl] = useState(st.mediaUrl);
  const player = useVideoPlayer(st.mediaUrl || null, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (!st.mediaUrl) return;
    try {
      player.replace(st.mediaUrl);
    } catch {
      /* ignore */
    }
  }, [st.mediaUrl, player]);

  useEffect(() => {
    if (!st.mediaUrl) return;
    try {
      const target = Number(st.at) || 0;
      if (Math.abs(player.currentTime - target) > 1.5) {
        player.currentTime = target;
      }
      if (st.playing) player.play();
      else player.pause();
    } catch {
      /* ignore */
    }
  }, [st.playing, st.at, st.mediaUrl, player]);

  return (
    <View style={{ flex: 1, padding: 12 }}>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="Medya URL"
        placeholderTextColor={colors.textMuted}
        style={{
          height: 44,
          borderRadius: 12,
          paddingHorizontal: 12,
          backgroundColor: colors.surface,
          color: colors.text,
          marginBottom: 8,
        }}
      />
      <Pressable
        onPress={() => void onPatch({ mediaUrl: url.trim(), playing: false, at: 0 })}
        style={{
          height: 40,
          borderRadius: 12,
          backgroundColor: colors.surfaceHigh,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: '700' }}>URL ayarla</Text>
      </Pressable>
      {st.mediaUrl ? (
        <VideoView
          player={player}
          style={{ width: '100%', height: 220, backgroundColor: '#000' }}
          contentFit="contain"
          nativeControls
        />
      ) : (
        <Text style={{ color: colors.textMuted }}>Host medya URL’i ayarlamadı</Text>
      )}
      <Pressable
        onPress={() => void onPatch({ mediaUrl: st.mediaUrl, playing: !st.playing, at: st.at })}
        style={{ ...primaryBtn, marginTop: 12 }}
      >
        <Text style={primaryBtnText}>{st.playing ? 'Duraklat' : 'Oynat'}</Text>
      </Pressable>
    </View>
  );
}
