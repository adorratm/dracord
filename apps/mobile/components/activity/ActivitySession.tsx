import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ActivityKind } from '@dracord/types';

type ActivitySessionApi = {
  activityChannelId: string | null;
  activityGuildId: string | null;
  activityChannelName: string | null;
  activityKind: ActivityKind | null;
  activitySessionId: string | null;
  /** Oyuncu + izleyici id’leri — overlay kanal listesi için */
  activityParticipantIds: string[];
  setActiveActivity: (opts: {
    guildId: string;
    channelId: string;
    channelName: string;
    kind: ActivityKind;
    sessionId: string;
    participantIds?: string[];
  }) => void;
  setActivityParticipants: (ids: string[]) => void;
  clearActiveActivity: () => void;
};

const Ctx = createContext<ActivitySessionApi | null>(null);

export function useActivitySession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('ActivitySessionProvider gerekli');
  return v;
}

export function useActivitySessionOptional() {
  return useContext(Ctx);
}

export function ActivitySessionProvider({ children }: { children: ReactNode }) {
  const [activityChannelId, setChannelId] = useState<string | null>(null);
  const [activityGuildId, setGuildId] = useState<string | null>(null);
  const [activityChannelName, setChannelName] = useState<string | null>(null);
  const [activityKind, setKind] = useState<ActivityKind | null>(null);
  const [activitySessionId, setSessionId] = useState<string | null>(null);
  const [activityParticipantIds, setParticipantIds] = useState<string[]>([]);

  const setActiveActivity = useCallback(
    (opts: {
      guildId: string;
      channelId: string;
      channelName: string;
      kind: ActivityKind;
      sessionId: string;
      participantIds?: string[];
    }) => {
      setGuildId(opts.guildId);
      setChannelId(opts.channelId);
      setChannelName(opts.channelName);
      setKind(opts.kind);
      setSessionId(opts.sessionId);
      if (opts.participantIds) {
        setParticipantIds([...new Set(opts.participantIds)]);
      }
    },
    [],
  );

  const setActivityParticipants = useCallback((ids: string[]) => {
    setParticipantIds([...new Set(ids)]);
  }, []);

  const clearActiveActivity = useCallback(() => {
    setGuildId(null);
    setChannelId(null);
    setChannelName(null);
    setKind(null);
    setSessionId(null);
    setParticipantIds([]);
  }, []);

  const value = useMemo(
    () => ({
      activityChannelId,
      activityGuildId,
      activityChannelName,
      activityKind,
      activitySessionId,
      activityParticipantIds,
      setActiveActivity,
      setActivityParticipants,
      clearActiveActivity,
    }),
    [
      activityChannelId,
      activityGuildId,
      activityChannelName,
      activityKind,
      activitySessionId,
      activityParticipantIds,
      setActiveActivity,
      setActivityParticipants,
      clearActiveActivity,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
