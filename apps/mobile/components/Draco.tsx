import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/** Animasyonlu Draco maskotu — float + glow (RN native driver) */
export function Draco({ size = 160 }: { size?: number }) {
  const float = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (v: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
    const a = loop(float, 1600);
    const b = loop(glow, 1100);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [float, glow]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const rotate = float.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1.5deg'] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.1] });

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="image"
      accessibilityLabel="Draco maskotu"
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: size * 0.84,
          height: size * 0.84,
          borderRadius: size,
          backgroundColor: 'rgba(80,250,123,0.35)',
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }}
      />
      <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="body" cx="40%" cy="35%" rx="65%" ry="65%">
              <Stop offset="0%" stopColor="#e2d4ff" />
              <Stop offset="55%" stopColor="#c4a8f0" />
              <Stop offset="100%" stopColor="#a78bdb" />
            </RadialGradient>
            <RadialGradient id="eye" cx="35%" cy="30%" rx="70%" ry="70%">
              <Stop offset="0%" stopColor="#8affb0" />
              <Stop offset="100%" stopColor="#50fa7b" />
            </RadialGradient>
          </Defs>

          <Path
            d="M108 148 Q128 158 132 172 Q128 178 122 172 L118 164"
            stroke="#a78bdb"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <Path d="M130 176 L142 172 L134 164 Z" fill="#ff79c6" />

          <Path
            d="M62 108 C28 78, 12 108, 28 132 C42 124, 50 128, 64 118 Z"
            fill="#6b4fa0"
            opacity={0.85}
          />
          <Path d="M62 108 C38 88, 22 110, 34 126 Z" fill="#ff79c6" opacity={0.55} />
          <Path
            d="M138 108 C172 78, 188 108, 172 132 C158 124, 150 128, 136 118 Z"
            fill="#6b4fa0"
            opacity={0.85}
          />
          <Path d="M138 108 C162 88, 178 110, 166 126 Z" fill="#ff79c6" opacity={0.55} />

          <Path
            d="M58 118 C70 102, 130 102, 142 118 C148 128, 145 148, 130 155 C115 162, 85 162, 70 155 C55 148, 52 128, 58 118 Z"
            fill="#4a3570"
          />
          <Circle cx="100" cy="126" r="5" fill="#ff79c6" />
          <Circle cx="99" cy="124.5" r="1.6" fill="#ffd6ee" />

          <Ellipse cx="100" cy="128" rx="28" ry="24" fill="url(#body)" />
          <Circle cx="100" cy="86" r="42" fill="url(#body)" />

          <Path
            d="M68 58 C78 42, 92 38, 100 48 C108 38, 122 42, 132 58 C124 48, 112 52, 100 62 C88 52, 76 48, 68 58 Z"
            fill="#6b4fa0"
          />
          <Path d="M100 48 L106 62 L100 58 L94 62 Z" fill="#6b4fa0" />

          <Path d="M62 70 L42 28 L78 58 Z" fill="#a78bdb" />
          <Path d="M64 66 L50 38 L74 58 Z" fill="#ff79c6" />
          <Path d="M138 70 L158 28 L122 58 Z" fill="#a78bdb" />
          <Path d="M136 66 L150 38 L126 58 Z" fill="#ff79c6" />

          <Path
            d="M58 86 Q100 58 142 86"
            stroke="#1e2a22"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          <Rect x="48" y="78" width="14" height="22" rx="4" fill="#1e2a22" />
          <Rect x="138" y="78" width="14" height="22" rx="4" fill="#1e2a22" />
          <Rect x="50" y="82" width="10" height="6" rx="1" fill="#50fa7b" />

          <Ellipse cx="86" cy="86" rx="10" ry="12" fill="#2a1f3d" />
          <Ellipse cx="86" cy="86" rx="7.5" ry="10" fill="url(#eye)" />
          <Circle cx="89" cy="82" r="3" fill="#ffffff" />
          <Ellipse cx="114" cy="86" rx="10" ry="12" fill="#2a1f3d" />
          <Ellipse cx="114" cy="86" rx="7.5" ry="10" fill="url(#eye)" />
          <Circle cx="117" cy="82" r="3" fill="#ffffff" />

          <Ellipse cx="70" cy="98" rx="6" ry="3.5" fill="#ff79c6" opacity={0.45} />
          <Ellipse cx="130" cy="98" rx="6" ry="3.5" fill="#ff79c6" opacity={0.45} />

          <Path
            d="M92 104 Q100 112 108 104"
            stroke="#2a1f3d"
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <Polygon points="94,104 96,109 98,104" fill="#ffffff" />
          <Polygon points="102,104 104,109 106,104" fill="#ffffff" />
          <Ellipse cx="152" cy="100" rx="9" ry="11" fill="url(#body)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
