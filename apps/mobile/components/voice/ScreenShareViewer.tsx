import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { VideoView as LiveKitVideoView } from '@livekit/react-native';
import type { DracordClient } from '@dracord/sdk';
import type { RemoteControlStatePayload } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { Icon } from '../Icon';
import { useVoiceSession } from './VoiceSession';
import { AnnotationsView } from './AnnotationsView';

const LONG_PRESS_MS = 550;
const SLOP = 8;

/**
 * Mobil: uzak ekran paylaşımını izle + uzak kontrol (kontrol eden).
 * Dokunuş = sol tık · uzun bas = sağ tık · sürükle = basılı sürükleme · iki parmak = kaydırma · ⌨ = klavye.
 */
export function ScreenShareViewer({
  client,
  userId,
  guildId,
  channelId,
  sharerId,
  sharerName,
}: {
  client: DracordClient;
  userId: string;
  guildId: string;
  channelId: string;
  sharerId: string;
  sharerName: string;
}) {
  const voice = useVoiceSession();
  const share = voice.getScreenShareTrack(sharerId);
  const [state, setState] = useState<RemoteControlStatePayload | null>(null);
  const [full, setFull] = useState(false);
  const [kb, setKb] = useState(false);

  useEffect(() => {
    setState(null);
    const off = client.onRemoteControlState((p) => {
      if (p.channelId !== channelId || p.sharerId !== sharerId) return;
      setState(p);
    });
    return () => off();
  }, [client, channelId, sharerId]);

  const controlling = state?.status === 'active' && state.controllerId === userId;
  const pendingMine = state?.status === 'pending' && state.controllerId === userId;
  const someoneElse = state?.status === 'active' && state.controllerId !== userId;

  // Ayrılınca / ekran değişince kontrolü bırak
  useEffect(
    () => () => {
      if (controllingRef.current) client.revokeRemoteControl({ guildId, channelId, sharerId, reason: 'stopped' });
    },
    [client, guildId, channelId, sharerId],
  );
  const controllingRef = useRef(false);
  controllingRef.current = controlling;

  const toggleControl = () => {
    if (controlling || pendingMine) {
      client.revokeRemoteControl({ guildId, channelId, sharerId, reason: 'stopped' });
      setState(null);
      setKb(false);
      return;
    }
    client.requestRemoteControl({ guildId, channelId, sharerId });
    setState({ guildId, channelId, sharerId, status: 'pending', controllerId: userId, controllerName: null });
  };

  const sendKey = (key: string, code: string) => {
    for (const keyAction of ['down', 'up'] as const) {
      client.sendRemoteControlInput({ guildId, channelId, sharerId, type: 'key', keyAction, key, code });
    }
  };

  if (!share) {
    return (
      <View style={{ margin: 12, padding: 12, borderRadius: 12, backgroundColor: colors.surfaceHigh }}>
        <Text style={{ color: colors.textMuted }}>{sharerName} ekran paylaşıyor — görüntü yükleniyor…</Text>
      </View>
    );
  }

  const body = (
    <ControlSurface
      share={share}
      enabled={controlling}
      onInput={(ev) => client.sendRemoteControlInput({ guildId, channelId, sharerId, ...ev })}
      style={full ? { flex: 1 } : { height: 220 }}
      overlay={(box) => (
        <AnnotationsView
          client={client}
          guildId={guildId}
          channelId={channelId}
          sharerId={sharerId}
          box={box}
          videoW={share.width}
          videoH={share.height}
        />
      )}
    />
  );

  const bar = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Icon name="present_to_all" size={16} color={colors.primary} />
      <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
        {sharerName}
        {controlling ? ' · kontrol sende' : someoneElse ? ` · ${state?.controllerName ?? 'biri'} kontrol ediyor` : ''}
      </Text>
      {controlling ? (
        <Pressable onPress={() => setKb((v) => !v)} hitSlop={8} accessibilityLabel="Klavye">
          <Icon name="keyboard" size={20} color={kb ? colors.primary : colors.text} />
        </Pressable>
      ) : null}
      {!someoneElse ? (
        <Pressable
          onPress={toggleControl}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: controlling ? colors.danger : colors.surfaceHigh,
          }}
        >
          <Text style={{ color: controlling ? '#fff' : colors.text, fontWeight: '700', fontSize: 12 }}>
            {controlling ? 'Bırak' : pendingMine ? 'İstek bekleniyor…' : 'Kontrol iste'}
          </Text>
        </Pressable>
      ) : null}
      <Pressable onPress={() => setFull((v) => !v)} hitSlop={8} accessibilityLabel={full ? 'Küçült' : 'Tam ekran'}>
        <Icon name={full ? 'fullscreen_exit' : 'fullscreen'} size={22} color={colors.text} />
      </Pressable>
    </View>
  );

  const keyboard =
    controlling && kb ? (
      <TextInput
        autoFocus
        value=""
        onChangeText={() => undefined}
        onKeyPress={(e) => {
          const k = e.nativeEvent.key;
          if (k === 'Backspace') sendKey('Backspace', 'Backspace');
          else if (k === 'Enter') sendKey('Enter', 'Enter');
          else if (k && [...k].length === 1) sendKey(k, '');
        }}
        onSubmitEditing={() => sendKey('Enter', 'Enter')}
        blurOnSubmit={false}
        autoCorrect={false}
        autoCapitalize="none"
        placeholder="Yaz → karşı bilgisayara gider"
        placeholderTextColor={colors.textMuted}
        style={{ color: colors.text, backgroundColor: colors.surfaceHigh, margin: 8, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}
      />
    ) : null;

  if (full) {
    return (
      <Modal visible animationType="fade" onRequestClose={() => setFull(false)} supportedOrientations={['portrait', 'landscape']}>
        <View style={{ flex: 1, backgroundColor: '#000', paddingTop: 30 }}>
          {bar}
          {body}
          {keyboard}
        </View>
      </Modal>
    );
  }
  return (
    <View style={{ margin: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
      {bar}
      {body}
      {keyboard}
    </View>
  );
}

type PointerEv =
  | { type: 'move' | 'down' | 'up'; nx: number; ny: number; button?: number }
  | { type: 'wheel'; nx: number; ny: number; deltaY: number };

function ControlSurface({
  share,
  enabled,
  onInput,
  style,
  overlay,
}: {
  share: { track: unknown; width: number; height: number };
  enabled: boolean;
  onInput: (ev: PointerEv) => void;
  style: { height?: number; flex?: number };
  overlay?: (box: { w: number; h: number }) => React.ReactNode;
}) {
  const box = useRef({ w: 1, h: 1 });
  const [boxState, setBoxState] = useState({ w: 1, h: 1 });
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;
  const dims = useRef({ w: share.width, h: share.height });
  dims.current = { w: share.width, h: share.height };
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const norm = (x: number, y: number) => {
    const { w, h } = box.current;
    const a = dims.current.w / Math.max(1, dims.current.h);
    const cw = Math.min(w, h * a);
    const ch = cw / a;
    const ox = (w - cw) / 2;
    const oy = (h - ch) / 2;
    return {
      nx: Math.min(1, Math.max(0, (x - ox) / cw)),
      ny: Math.min(1, Math.max(0, (y - oy) / ch)),
    };
  };

  const pan = useMemo(() => {
    let start = { x: 0, y: 0, n: { nx: 0, ny: 0 } };
    let dragging = false;
    let longPressed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastMove = 0;
    let lastTwoY: number | null = null;
    const loc = (e: GestureResponderEvent) => ({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
    return PanResponder.create({
      onStartShouldSetPanResponder: () => enabledRef.current,
      onMoveShouldSetPanResponder: () => enabledRef.current,
      onPanResponderGrant: (e) => {
        const p = loc(e);
        start = { ...p, n: norm(p.x, p.y) };
        dragging = false;
        longPressed = false;
        lastTwoY = null;
        onInputRef.current({ type: 'move', ...start.n });
        timer = setTimeout(() => {
          if (dragging) return;
          longPressed = true;
          onInputRef.current({ type: 'down', ...start.n, button: 2 });
          onInputRef.current({ type: 'up', ...start.n, button: 2 });
        }, LONG_PRESS_MS);
      },
      onPanResponderMove: (e, g) => {
        if (g.numberActiveTouches >= 2) {
          if (timer) clearTimeout(timer);
          const y = g.moveY;
          if (lastTwoY === null) lastTwoY = y;
          const dy = lastTwoY - y;
          if (Math.abs(dy) >= 12) {
            lastTwoY = y;
            onInputRef.current({ type: 'wheel', ...start.n, deltaY: dy * 4 });
          }
          return;
        }
        if (longPressed) return;
        if (!dragging && Math.hypot(g.dx, g.dy) > SLOP) {
          if (timer) clearTimeout(timer);
          dragging = true;
          onInputRef.current({ type: 'down', ...start.n, button: 0 });
        }
        if (!dragging) return;
        const now = Date.now();
        if (now - lastMove < 33) return;
        lastMove = now;
        const p = loc(e);
        onInputRef.current({ type: 'move', ...norm(p.x, p.y) });
      },
      onPanResponderRelease: (e) => {
        if (timer) clearTimeout(timer);
        if (longPressed || lastTwoY !== null) return;
        const p = loc(e);
        if (dragging) onInputRef.current({ type: 'up', ...norm(p.x, p.y), button: 0 });
        else {
          onInputRef.current({ type: 'down', ...start.n, button: 0 });
          onInputRef.current({ type: 'up', ...start.n, button: 0 });
        }
      },
      onPanResponderTerminate: () => {
        if (timer) clearTimeout(timer);
        if (dragging) onInputRef.current({ type: 'up', ...start.n, button: 0 });
      },
    });
  }, []);

  return (
    <View
      style={style}
      onLayout={(e: LayoutChangeEvent) => {
        box.current = { w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 };
        setBoxState(box.current);
      }}
    >
      <LiveKitVideoView style={{ flex: 1 }} videoTrack={share.track as never} objectFit="contain" />
      {overlay ? overlay(boxState) : null}
      {enabled ? <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} {...pan.panHandlers} /> : null}
    </View>
  );
}
