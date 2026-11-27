'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  RemoteControlInputPayload,
  RemoteControlStatePayload,
} from '@dracord/types';
import type { DracordClient } from '@dracord/sdk';
import { decodeRc, rcCanDirect, rcRoute, rcSend, RC_TOPIC, type RcDataListener, type RcInput, type RcRoomLike } from './remote-control-rtc';

export type RemoteControlUi = {
  status: 'idle' | 'pending' | 'active';
  isController: boolean;
  isSharer: boolean;
  controllerName: string | null;
  pendingFromName: string | null;
  /** Paylaşan tarafta uyarı (ör. macOS Erişilebilirlik izni) */
  notice?: string | null;
  /** Kontrol eden: girdinin yolu (doğrudan LiveKit / sunucu) ve ölçülen gidiş-dönüş */
  transport?: 'direct' | 'server';
  latencyMs?: number | null;
};

const PING_EVERY_MS = 2000;
/** bu süre yanıt gelmezse doğrudan yol bırakılır, sunucuya dönülür */
const PONG_TIMEOUT_MS = 6000;

/**
 * Ekran paylaşımı uzak kontrol — sunucu tek controller otoritesi.
 */
export function useRemoteControl(opts: {
  client: DracordClient;
  userId: string | null | undefined;
  guildId: string | null | undefined;
  channelId: string | null | undefined;
  /** Odaklı paylaşımın kimliği (paylaşan user id) */
  sharerId: string | null | undefined;
  /** Yerel ekran paylaşımı açık mı */
  localSharing: boolean;
  /** LiveKit odası (varsa girdiler doğrudan gider) */
  room?: RcRoomLike | null;
}) {
  const { client, userId, guildId, channelId, sharerId, localSharing, room } = opts;
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  /** son pong zamanı: paylaşan doğrudan yolu desteklediğini böyle kanıtlar (eski sürüm yanıt vermez) */
  const [lastPongAt, setLastPongAt] = useState(0);
  const lastPongRef = useRef(0);
  const [state, setState] = useState<RemoteControlStatePayload | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const moveThrottle = useRef(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const offState = client.onRemoteControlState((payload) => {
      if (
        channelId &&
        payload.channelId === channelId &&
        (!sharerId || payload.sharerId === sharerId || payload.sharerId === userId)
      ) {
        setState(payload);
        if (payload.status !== 'pending') setPendingName(null);
        if (payload.status === 'pending' && payload.controllerName) {
          setPendingName(payload.controllerName);
        }
      }
    });
    const offReq = client.onRemoteControlRequest((payload) => {
      if (!localSharing) return;
      if (payload.sharerId !== userId) return;
      if (channelId && payload.channelId !== channelId) return;
      setPendingName(payload.controllerName ?? 'Bir kullanıcı');
      setState({
        guildId: payload.guildId,
        channelId: payload.channelId,
        sharerId: payload.sharerId,
        status: 'pending',
        controllerId: payload.controllerId,
        controllerName: payload.controllerName ?? null,
        sharerName: null,
        reason: null,
      });
    });
    const offInput = client.onRemoteControlInput((payload) => {
      if (payload.sharerId !== userId) return;
      injectRef.current(payload);
    });
    return () => {
      offState();
      offReq();
      offInput();
    };
  }, [client, channelId, sharerId, userId, localSharing]);

  // Paylaşan: girdiyi masaüstüne uygula (socket ve LiveKit yolu aynı fonksiyondan geçer)
  const injectRef = useRef<(p: RcInput) => void>(() => undefined);
  injectRef.current = (payload: RcInput) => {
      const desktop = (
        window as Window & {
          dracordDesktop?: {
            injectRemoteControlInput?: (ev: unknown) => Promise<unknown>;
          };
        }
      ).dracordDesktop;
      if (!desktop?.injectRemoteControlInput) return;
      void (desktop.injectRemoteControlInput({
        type: payload.type,
        nx: payload.nx,
        ny: payload.ny,
        button: payload.button,
        deltaY: payload.deltaY,
        key: payload.key,
        code: payload.code,
        keyAction: payload.keyAction,
      }) as Promise<{ ok?: boolean; error?: string } | undefined>).then((r) => {
        if (r && r.ok === false && r.error === 'mac_accessibility_required') {
          setNotice('Uzak kontrol için Sistem Ayarları → Gizlilik ve Güvenlik → Erişilebilirlik → Dracord iznini aç.');
        } else if (r && r.ok === false && r.error === 'mac_window_share_unsupported') {
          setNotice('macOS’ta uzak kontrol yalnız tüm ekran paylaşımında çalışır.');
        } else if (r && r.ok === false && r.error === 'unsupported_platform') {
          setNotice('Bu işletim sisteminde uzak kontrol desteklenmiyor.');
        }
      }).catch(() => undefined);
  };

  // Paylaşan: LiveKit verisi — yalnız sunucunun onayladığı kontrol edenden, oturum etkinken
  const authRef = useRef<{ controllerId: string | null; active: boolean }>({ controllerId: null, active: false });
  authRef.current = {
    controllerId: state?.controllerId ?? null,
    active: Boolean(localSharing && userId && state?.sharerId === userId && state.status === 'active'),
  };
  // Kontrol eden: ping yanıtları
  const pingsRef = useRef(new Map<number, number>());
  useEffect(() => {
    if (!room) return;
    const onData: RcDataListener = (data, participant, _kind, topic) => {
      if (topic !== RC_TOPIC || !participant) return;
      const m = decodeRc(data);
      if (!m) return;
      if (m.k === 'pong') {
        const sentAt = pingsRef.current.get(m.id);
        if (sentAt !== undefined) {
          pingsRef.current.delete(m.id);
          const rtt = Math.round(performance.now() - sentAt);
          setLatencyMs((prev) => (prev == null ? rtt : Math.round(prev * 0.6 + rtt * 0.4)));
          lastPongRef.current = performance.now();
          setLastPongAt(lastPongRef.current);
        }
        return;
      }
      const a = authRef.current;
      if (!a.active || !a.controllerId || participant.identity !== a.controllerId) return;
      if (m.k === 'ping') rcSend(room, participant.identity, { v: 1, k: 'pong', id: m.id });
      else injectRef.current(m.p);
    };
    room.on('dataReceived', onData);
    return () => {
      room.off('dataReceived', onData);
    };
  }, [room]);

  // Paylaşım bitince sunucu oturumunu da düşür + lokal state sıfırla
  useEffect(() => {
    if (localSharing || !userId || !channelId || !guildId) return;
    if (!state || state.sharerId !== userId) return;
    if (state.status === 'pending' || state.status === 'active') {
      client.revokeRemoteControl({
        guildId,
        channelId,
        sharerId: userId,
        reason: 'share_ended',
      });
    }
    setState(null);
    setPendingName(null);
  }, [localSharing, state, userId, channelId, guildId, client]);

  // Desktop: paylaşım boyutunu main’e bildir
  useEffect(() => {
    const desktop = (
      window as Window & {
        dracordDesktop?: {
          setRemoteControlBounds?: (
            b: { x: number; y: number; width: number; height: number } | null,
          ) => Promise<unknown>;
        };
      }
    ).dracordDesktop;
    if (!desktop?.setRemoteControlBounds) return;
    if (localSharing) {
      const scr = window.screen as Screen & {
        availLeft?: number;
        availTop?: number;
      };
      const w = scr?.width || 1920;
      const h = scr?.height || 1080;
      void desktop.setRemoteControlBounds({
        x: scr?.availLeft ?? 0,
        y: scr?.availTop ?? 0,
        width: w,
        height: h,
      });
    } else {
      void desktop.setRemoteControlBounds(null);
    }
  }, [localSharing]);

  // Desktop (paylaşan): kontrol aktifken global acil durdurma kısayolu (Ctrl+Shift+F12)
  const sharerActive = Boolean(
    localSharing && userId && state?.sharerId === userId && state.status === 'active',
  );
  const stopRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const desktop = (
      window as Window & {
        dracordDesktop?: {
          setRemoteControlActive?: (active: boolean) => Promise<unknown>;
          onRemoteControlEmergencyStop?: (cb: () => void) => () => void;
        };
      }
    ).dracordDesktop;
    if (!desktop?.setRemoteControlActive) return;
    void desktop.setRemoteControlActive(sharerActive);
    if (!sharerActive) return;
    const off = desktop.onRemoteControlEmergencyStop?.(() => stopRef.current());
    return () => {
      off?.();
      void desktop.setRemoteControlActive?.(false);
    };
  }, [sharerActive]);

  const request = useCallback(() => {
    if (!guildId || !channelId || !sharerId || !userId) return;
    client.requestRemoteControl({
      guildId,
      channelId,
      sharerId,
    });
    setState({
      guildId,
      channelId,
      sharerId,
      status: 'pending',
      controllerId: userId,
      controllerName: null,
      sharerName: null,
      reason: null,
    });
  }, [client, guildId, channelId, sharerId, userId]);

  const accept = useCallback(() => {
    if (!guildId || !channelId || !userId || !state?.controllerId) return;
    client.respondRemoteControl({
      guildId,
      channelId,
      sharerId: userId,
      controllerId: state.controllerId,
      accept: true,
    });
  }, [client, guildId, channelId, userId, state?.controllerId]);

  const reject = useCallback(() => {
    if (!guildId || !channelId || !userId || !state?.controllerId) return;
    client.respondRemoteControl({
      guildId,
      channelId,
      sharerId: userId,
      controllerId: state.controllerId,
      accept: false,
    });
    setState(null);
    setPendingName(null);
  }, [client, guildId, channelId, userId, state?.controllerId]);

  const stop = useCallback(() => {
    if (!guildId || !channelId) return;
    const sid = state?.sharerId || sharerId || userId;
    if (!sid) return;
    client.revokeRemoteControl({
      guildId,
      channelId,
      sharerId: sid,
      reason: 'stopped',
    });
    setState(null);
    setPendingName(null);
  }, [client, guildId, channelId, state?.sharerId, sharerId, userId]);

  stopRef.current = stop;

  const controlling = Boolean(state?.status === 'active' && state.controllerId === userId);
  const reachable = controlling && rcCanDirect(room, sharerId);
  /** doğrudan yol yalnız paylaşan yakın zamanda pong verdiyse (sürüm desteği + bağlantı kanıtı) */
  const directOk = () =>
    rcRoute({ reachable, lastPongAt: lastPongRef.current, now: performance.now(), timeoutMs: PONG_TIMEOUT_MS }) === 'direct';
  const direct = reachable && lastPongAt > 0;

  /** Kontrol eden: doğrudan (LiveKit) ya da sunucu üstünden gönder */
  const deliver = useCallback(
    (payload: RemoteControlInputPayload) => {
      if (room && sharerId && directOk()) {
        const { guildId: _g, channelId: _c, sharerId: _s, ...p } = payload;
        rcSend(room, sharerId, { v: 1, k: 'in', p }, () => {
          // gönderim başarısız: bu olayı sunucudan ilet, doğrudan yolu bırak
          lastPongRef.current = 0;
          setLastPongAt(0);
          client.sendRemoteControlInput(payload);
        });
      } else {
        client.sendRemoteControlInput(payload);
      }
    },
    // directOk ref okur; reachable değişince yeniden oluşur
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, room, sharerId, reachable],
  );

  // Kontrol eden: el sıkışma + gecikme ölçümü; yanıt kesilirse sunucu yoluna dön
  useEffect(() => {
    if (!reachable || !room || !sharerId) {
      setLatencyMs(null);
      lastPongRef.current = 0;
      setLastPongAt(0);
      pingsRef.current.clear();
      return;
    }
    let id = 0;
    const t = window.setInterval(() => {
      id += 1;
      pingsRef.current.set(id, performance.now());
      if (pingsRef.current.size > 10) pingsRef.current.delete(pingsRef.current.keys().next().value!);
      rcSend(room, sharerId, { v: 1, k: 'ping', id });
      if (lastPongRef.current > 0 && performance.now() - lastPongRef.current > PONG_TIMEOUT_MS) {
        lastPongRef.current = 0;
        setLastPongAt(0);
        setLatencyMs(null);
      }
    }, PING_EVERY_MS);
    // ilk ping hemen: el sıkışma beklemesin
    id += 1;
    pingsRef.current.set(id, performance.now());
    rcSend(room, sharerId, { v: 1, k: 'ping', id });
    return () => window.clearInterval(t);
  }, [reachable, room, sharerId]);

  const sendPointer = useCallback(
    (ev: {
      type: 'move' | 'down' | 'up' | 'wheel';
      nx: number;
      ny: number;
      button?: number;
      deltaY?: number;
    }) => {
      if (!guildId || !channelId || !sharerId) return;
      if (state?.status !== 'active' || state.controllerId !== userId) return;
      if (ev.type === 'move') {
        const now = performance.now();
        if (now - moveThrottle.current < 16) return; // ~60 Hz
        moveThrottle.current = now;
      }
      const payload: RemoteControlInputPayload = {
        guildId,
        channelId,
        sharerId,
        type: ev.type,
        nx: ev.nx,
        ny: ev.ny,
        button: ev.button,
        deltaY: ev.deltaY,
      };
      deliver(payload);
    },
    [deliver, guildId, channelId, sharerId, state, userId],
  );

  const sendKey = useCallback(
    (ev: {
      type: 'key';
      keyAction: 'down' | 'up';
      key: string;
      code: string;
      ctrl?: boolean;
      alt?: boolean;
      shift?: boolean;
      meta?: boolean;
    }) => {
      if (!guildId || !channelId || !sharerId) return;
      if (state?.status !== 'active' || state.controllerId !== userId) return;
      deliver({
        guildId,
        channelId,
        sharerId,
        type: 'key',
        keyAction: ev.keyAction,
        key: ev.key,
        code: ev.code,
        ctrl: ev.ctrl,
        alt: ev.alt,
        shift: ev.shift,
        meta: ev.meta,
      });
    },
    [deliver, guildId, channelId, sharerId, state, userId],
  );

  const ui: RemoteControlUi | null = useMemo(() => {
    if (!sharerId && !localSharing) return null;
    const status = state?.status ?? 'idle';
    const isController = Boolean(userId && state?.controllerId === userId);
    const isSharer = Boolean(localSharing || (userId && state?.sharerId === userId));
    return {
      status,
      isController,
      isSharer,
      controllerName: state?.controllerName ?? null,
      pendingFromName: isSharer && status === 'pending' ? pendingName : null,
      notice: isSharer && status === 'active' ? notice : null,
      transport: isController && status === 'active' ? (direct ? 'direct' : 'server') : undefined,
      latencyMs: isController && direct ? latencyMs : null,
    };
  }, [state, userId, localSharing, sharerId, pendingName, notice, direct, latencyMs]);

  return {
    remoteControl: ui,
    requestRemoteControl: request,
    acceptRemoteControl: accept,
    rejectRemoteControl: reject,
    stopRemoteControl: stop,
    sendRemoteControlPointer: sendPointer,
    sendRemoteControlKey: sendKey,
  };
}
