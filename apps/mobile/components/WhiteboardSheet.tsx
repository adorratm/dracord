import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { WhiteboardStroke } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';
import { Icon } from './Icon';

const ASPECT = 16 / 9;
const BG = '#1e1f29';
const COLORS = ['#f8f8f2', '#ff5555', '#ffb86c', '#f1fa8c', '#50fa7b', '#8be9fd', '#bd93f9', '#ff79c6'];

function pathOf(p: number[], W: number, H: number): string {
  if (p.length < 2) return '';
  let d = `M${(p[0]! * W).toFixed(1)} ${(p[1]! * H).toFixed(1)}`;
  if (p.length === 2) d += ` l0.1 0.1`;
  for (let i = 2; i < p.length; i += 2) d += ` L${(p[i]! * W).toFixed(1)} ${(p[i + 1]! * H).toFixed(1)}`;
  return d;
}

/** G3 — the channel's shared whiteboard on mobile: see it live, draw with a finger, undo */
export function WhiteboardSheet({ channelId, open, onClose }: { channelId: string; open: boolean; onClose: () => void }) {
  const { client, user } = useAuth();
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [current, setCurrent] = useState<number[] | null>(null);
  const [color, setColor] = useState(COLORS[0]!);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const boxRef = useRef(box);
  boxRef.current = box;
  const pts = useRef<number[]>([]);
  const colorRef = useRef(color);
  colorRef.current = color;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    client.connectSocket();
    client.joinChannel(channelId);
    void client.getWhiteboard(channelId).then((l) => alive && setStrokes(l)).catch(() => undefined);
    const off = client.onWhiteboardEvent((e) => {
      if (e.channelId !== channelId) return;
      if (e.kind === 'clear') setStrokes([]);
      else if (e.kind === 'remove') setStrokes((p) => p.filter((s) => !e.strokeIds.includes(s.id)));
      else setStrokes((p) => (p.some((s) => s.id === e.stroke.id) ? p : [...p, e.stroke]));
    });
    return () => {
      alive = false;
      off();
    };
  }, [client, channelId, open]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { w, h } = boxRef.current;
          if (!w) return;
          pts.current = [e.nativeEvent.locationX / w, e.nativeEvent.locationY / h];
          setCurrent([...pts.current]);
        },
        onPanResponderMove: (e) => {
          const { w, h } = boxRef.current;
          if (!w || pts.current.length >= 3990) return;
          pts.current.push(e.nativeEvent.locationX / w, e.nativeEvent.locationY / h);
          setCurrent([...pts.current]);
        },
        onPanResponderRelease: () => {
          const points = pts.current.map((v) => Math.min(1, Math.max(0, v)));
          pts.current = [];
          setCurrent(null);
          if (points.length < 2) return;
          void client
            .addWhiteboardStroke(channelId, { tool: 'pen', color: colorRef.current, width: 5, points })
            .then((s) => setStrokes((p) => (p.some((x) => x.id === s.id) ? p : [...p, s])))
            .catch(() => undefined);
        },
      }),
    [client, channelId],
  );

  const undo = () => {
    const mine = [...strokes].reverse().find((s) => s.userId === user?.id);
    if (!mine) return;
    setStrokes((p) => p.filter((s) => s.id !== mine.id));
    void client.removeWhiteboardStrokes(channelId, [mine.id]).catch(() => undefined);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const w = Math.min(width, height * ASPECT);
    setBox({ w, h: w / ASPECT });
  };

  const sw = (s: { width: number; tool: string }) => Math.max(1, (s.width * (s.tool === 'marker' ? 3 : 1) * box.w) / 1000);

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 36 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, marginBottom: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17, flex: 1 }}>Beyaz tahta</Text>
          <Pressable onPress={undo} accessibilityRole="button" accessibilityLabel="Geri al" hitSlop={8}>
            <Icon name="undo" size={24} />
          </Pressable>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={8}>
            <Icon name="close" size={24} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 12, marginBottom: 10 }}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="button"
              accessibilityLabel={`Renk ${c}`}
              accessibilityState={{ selected: color === c }}
              style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: colors.primary }}
            />
          ))}
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 }} onLayout={onLayout}>
          {box.w > 0 ? (
            <View style={{ width: box.w, height: box.h, borderRadius: 12, overflow: 'hidden' }} {...pan.panHandlers}>
              <Svg width={box.w} height={box.h}>
                <Rect x={0} y={0} width={box.w} height={box.h} fill={BG} />
                {strokes.map((s) => (
                  <Path
                    key={s.id}
                    d={pathOf(s.points, box.w, box.h)}
                    stroke={s.color}
                    strokeOpacity={s.tool === 'marker' ? 0.35 : 1}
                    strokeWidth={sw(s)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
                {current ? (
                  <Path d={pathOf(current, box.w, box.h)} stroke={color} strokeWidth={sw({ width: 5, tool: 'pen' })} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                ) : null}
              </Svg>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
