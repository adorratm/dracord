import { useCallback, useEffect, useState } from 'react';
import { SocketEvents, type GameAppDto, type GameLaunchDto, type GameSessionDto } from '@dracord/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type SocketLike = { on(e: any, f: any): unknown; off(e: any, f: any): unknown };
/* eslint-enable @typescript-eslint/no-explicit-any */

export type GamesClient = {
  connectSocket(): SocketLike;
  getGameCatalog(): Promise<Array<GameAppDto & { testMode: boolean }>>;
  listGameSessions(guildId: string, channelId: string): Promise<GameSessionDto[]>;
  startGameSession(gameId: string, guildId: string, channelId: string): Promise<GameSessionDto>;
  joinGameSession(sessionId: string): Promise<GameSessionDto>;
  leaveGameSession(sessionId: string): Promise<{ ok: true }>;
  launchGameSession(sessionId: string): Promise<GameLaunchDto>;
};

/** Ses kanalındaki harici oyun oturumları + açık oyun */
export function useGameSessions(
  client: GamesClient | null | undefined,
  guildId: string | null | undefined,
  channelId: string | null | undefined,
) {
  const [sessions, setSessions] = useState<GameSessionDto[]>([]);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessions([]);
    setOpenSessionId(null);
    if (!client || !guildId || !channelId) return;
    void client.listGameSessions(guildId, channelId).then(setSessions).catch(() => undefined);
    const sock = client.connectSocket();
    const onUpd = (s: GameSessionDto) => {
      if (s.guildId !== guildId || s.channelId !== channelId) return;
      setSessions((prev) => {
        const rest = prev.filter((x) => x.id !== s.id);
        return s.status === 'active' ? [...rest, s] : rest;
      });
      if (s.status !== 'active') setOpenSessionId((cur) => (cur === s.id ? null : cur));
    };
    sock.on(SocketEvents.GAME_SESSION_UPDATE, onUpd);
    return () => {
      sock.off(SocketEvents.GAME_SESSION_UPDATE, onUpd);
    };
  }, [client, guildId, channelId]);

  const start = useCallback(
    async (gameId: string) => {
      if (!client || !guildId || !channelId) return;
      setError(null);
      try {
        const s = await client.startGameSession(gameId, guildId, channelId);
        setSessions((prev) => [...prev.filter((x) => x.id !== s.id), s]);
        setOpenSessionId(s.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Oyun başlatılamadı');
      }
    },
    [client, guildId, channelId],
  );

  const join = useCallback(
    async (sessionId: string) => {
      if (!client) return;
      setError(null);
      try {
        await client.joinGameSession(sessionId);
        setOpenSessionId(sessionId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Katılınamadı');
      }
    },
    [client],
  );

  const close = useCallback(
    async (opts?: { leave?: boolean }) => {
      const id = openSessionId;
      setOpenSessionId(null);
      if (id && opts?.leave !== false && client) await client.leaveGameSession(id).catch(() => undefined);
    },
    [client, openSessionId],
  );

  const openSession = sessions.find((s) => s.id === openSessionId) ?? null;
  return { sessions, openSession, start, join, close, error, clearError: () => setError(null) };
}
