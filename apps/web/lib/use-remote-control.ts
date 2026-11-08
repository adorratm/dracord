'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  RemoteControlInputPayload,
  RemoteControlStatePayload,
} from '@dracord/types';
import type { DracordClient } from '@dracord/sdk';

export type RemoteControlUi = {
  status: 'idle' | 'pending' | 'active';
  isController: boolean;
  isSharer: boolean;
  controllerName: string | null;
  pendingFromName: string | null;
};

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
}) {
  const { client, userId, guildId, channelId, sharerId, localSharing } = opts;
  const [state, setState] = useState<RemoteControlStatePayload | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const moveThrottle = useRef(0);

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
      const desktop = (
        window as Window & {
          dracordDesktop?: {
            injectRemoteControlInput?: (ev: unknown) => Promise<unknown>;
          };
        }
      ).dracordDesktop;
      if (!desktop?.injectRemoteControlInput) return;
      void desktop.injectRemoteControlInput({
        type: payload.type,
        nx: payload.nx,
        ny: payload.ny,
        button: payload.button,
        deltaY: payload.deltaY,
        key: payload.key,
        code: payload.code,
        keyAction: payload.keyAction,
      });
    });
    return () => {
      offState();
      offReq();
      offInput();
    };
  }, [client, channelId, sharerId, userId, localSharing]);

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
      client.sendRemoteControlInput(payload);
    },
    [client, guildId, channelId, sharerId, state, userId],
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
      client.sendRemoteControlInput({
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
    [client, guildId, channelId, sharerId, state, userId],
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
    };
  }, [state, userId, localSharing, sharerId, pendingName]);

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
