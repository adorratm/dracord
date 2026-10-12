import type { Material, Object3D, Scene, Texture, WebGLRenderer } from 'three';

export type VenueTheme = 'billiards' | 'bowling' | 'tavla' | 'okey' | 'blackjack';

type Three = typeof import('three');

type VenueOpts = {
  /** Masa / oyun alanı yarıçapı — zemin burada delikli olur (üstten kamera kapanmaz) */
  playRadius?: number;
  renderer?: WebGLRenderer;
};

function makeNoiseTexture(
  THREE: Three,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): Texture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  paint(ctx, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function woodTexture(THREE: Three, base = '#3d2918', grain = '#2a1a0e'): Texture {
  return makeNoiseTexture(THREE, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      const y = (i / 80) * h + Math.sin(i * 1.7) * 3;
      ctx.strokeStyle = `rgba(0,0,0,${0.08 + (i % 5) * 0.02})`;
      ctx.lineWidth = 1 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < w; x += 8) {
        ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 2.5);
      }
      ctx.stroke();
    }
    ctx.fillStyle = grain;
    for (let i = 0; i < 400; i++) {
      ctx.globalAlpha = 0.04;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 12 + Math.random() * 20);
    }
    ctx.globalAlpha = 1;
  });
}

function carpetTexture(THREE: Three, c1 = '#2a1f3d', c2 = '#1a1228'): Texture {
  return makeNoiseTexture(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        ctx.fillStyle = Math.random() > 0.5 ? c1 : c2;
        ctx.globalAlpha = 0.35 + Math.random() * 0.3;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    ctx.globalAlpha = 1;
  });
}

function concreteTexture(THREE: Three): Texture {
  return makeNoiseTexture(THREE, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2a2d38';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) {
      const g = 40 + Math.floor(Math.random() * 50);
      ctx.fillStyle = `rgb(${g},${g},${g + 8})`;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    ctx.globalAlpha = 1;
  });
}

function laneWoodTexture(THREE: Three): Texture {
  return makeNoiseTexture(THREE, 512, 256, (ctx, w, h) => {
    const grd = ctx.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, '#c4a06a');
    grd.addColorStop(0.5, '#d4b07a');
    grd.addColorStop(1, '#b89058');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(80,50,20,${0.06 + (i % 4) * 0.02})`;
      ctx.lineWidth = 1;
      const y = (i / 40) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < w; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 1.2);
      ctx.stroke();
    }
  });
}

/**
 * Oyun alanını kapatmayan iç mekan.
 * Işıklar yumuşak ve nötr — renkleri yıkayan spot/mor neon yok.
 */
export function addGameVenue(
  THREE: Three,
  scene: Scene,
  parent: Object3D,
  theme: VenueTheme,
  opts: VenueOpts = {},
): () => void {
  const disposables: Array<Material | Texture | { dispose: () => void }> = [];
  const track = <T extends Material | Texture | { dispose: () => void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const group = new THREE.Group();
  group.name = 'game-venue';
  parent.add(group);

  const playR = opts.playRadius ?? (theme === 'bowling' ? 4 : theme === 'tavla' ? 10 : 7);

  scene.fog = null;
  const bg = makeNoiseTexture(THREE, 8, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (theme === 'bowling') {
      g.addColorStop(0, '#12161f');
      g.addColorStop(0.55, '#1a2030');
      g.addColorStop(1, '#0c0e14');
    } else if (theme === 'tavla') {
      g.addColorStop(0, '#1a1428');
      g.addColorStop(0.5, '#241c36');
      g.addColorStop(1, '#100c18');
    } else if (theme === 'okey') {
      g.addColorStop(0, '#161222');
      g.addColorStop(0.5, '#201828');
      g.addColorStop(1, '#0e0a14');
    } else if (theme === 'blackjack') {
      g.addColorStop(0, '#1a0e14');
      g.addColorStop(0.5, '#140c12');
      g.addColorStop(1, '#0a0608');
    } else {
      g.addColorStop(0, '#16120e');
      g.addColorStop(0.5, '#1c1612');
      g.addColorStop(1, '#0c0a08');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  track(bg);
  scene.background = bg;

  const envState: { dispose: (() => void) | null } = { dispose: null };
  if (opts.renderer) {
    const renderer = opts.renderer;
    void import('three/examples/jsm/environments/RoomEnvironment.js')
      .then(({ RoomEnvironment }) => {
        if (!group.parent) return;
        const pmremGen = new THREE.PMREMGenerator(renderer);
        const env = new RoomEnvironment();
        const rt = pmremGen.fromScene(env as unknown as Scene, 0.04);
        scene.environment = rt.texture;
        scene.environmentIntensity = 0.55;
        envState.dispose = () => {
          rt.dispose();
          pmremGen.dispose();
          env.dispose();
          if (scene.environment === rt.texture) scene.environment = null;
        };
      })
      .catch(() => undefined);
  }

  const accent =
    theme === 'bowling'
      ? 0x6ec8d4
      : theme === 'tavla'
        ? 0xd4a574
        : theme === 'okey'
          ? 0xa78bfa
          : theme === 'blackjack'
            ? 0xd4af37
            : 0xc4a574;

  if (theme === 'bowling') {
    buildBowlingAlley(THREE, group, track, accent);
  } else {
    buildTableRoom(THREE, group, track, theme, playR, accent);
  }

  // Çok hafif dolgu — renk kayması yaratmayan düşük yoğunluk
  const rim = new THREE.PointLight(0xffe8cc, 0.22, 32, 2);
  rim.position.set(theme === 'bowling' ? 0 : -3.5, theme === 'bowling' ? 3.8 : 5.5, theme === 'bowling' ? 2 : 2.5);
  group.add(rim);

  return () => {
    scene.fog = null;
    if (scene.background === bg) scene.background = new THREE.Color(0x11131e);
    envState.dispose?.();
    parent.remove(group);
    group.traverse((o) => {
      const m = o as { geometry?: { dispose: () => void } };
      m.geometry?.dispose();
    });
    for (const d of disposables) d.dispose();
  };
}

function softSpot(
  THREE: Three,
  group: import('three').Group,
  x: number,
  y: number,
  z: number,
  lookZ: number,
  intensity: number,
  withShadow = false,
) {
  const light = new THREE.SpotLight(0xfff0dd, intensity, 20, Math.PI / 3.2, 0.72, 1.35);
  light.position.set(x, y, z);
  light.target.position.set(x * 0.35, 0, lookZ);
  if (withShadow) {
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.0004;
    light.shadow.radius = 2;
  } else {
    light.castShadow = false;
  }
  group.add(light);
  group.add(light.target);
  return light;
}

function buildTableRoom(
  THREE: Three,
  group: import('three').Group,
  track: <T extends Material | Texture | { dispose: () => void }>(x: T) => T,
  theme: VenueTheme,
  playR: number,
  accent: number,
) {
  const woodTex = track(woodTexture(THREE));
  woodTex.repeat.set(4, 4);
  const carpetTex = track(
    carpetTexture(
      THREE,
      theme === 'billiards'
        ? '#3a2418'
        : theme === 'blackjack'
          ? '#3a1420'
          : theme === 'tavla'
            ? '#3a2458'
            : '#2a2040',
      theme === 'billiards'
        ? '#241810'
        : theme === 'blackjack'
          ? '#1a0a10'
          : '#1a1228',
    ),
  );
  carpetTex.repeat.set(6, 6);

  const floorMat = track(
    new THREE.MeshStandardMaterial({
      map: carpetTex,
      roughness: 0.95,
      metalness: 0.02,
    }),
  );
  const floor = new THREE.Mesh(new THREE.RingGeometry(playR * 0.92, playR + 14, 64), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.9;
  floor.receiveShadow = true;
  group.add(floor);

  const underMat = track(new THREE.MeshStandardMaterial({ color: 0x0a0810, roughness: 1 }));
  const under = new THREE.Mesh(new THREE.CircleGeometry(playR * 0.9, 48), underMat);
  under.rotation.x = -Math.PI / 2;
  under.position.y = -0.95;
  under.receiveShadow = true;
  group.add(under);

  const wallTex = track(woodTexture(THREE, '#2c2038', '#1a1424'));
  wallTex.repeat.set(2, 1);
  const wallMat = track(
    new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.85,
      metalness: 0.05,
    }),
  );
  const wallH = 5.5;
  const wallY = wallH / 2 - 0.5;
  const dist = playR + 6;
  const panels: [number, number, number, number, number][] = [
    [dist * 2.2, wallH, 0.35, 0, -dist],
    [dist * 2.2, wallH, 0.35, 0, dist],
    [0.35, wallH, dist * 2.2, -dist, 0],
    [0.35, wallH, dist * 2.2, dist, 0],
  ];
  for (const [w, h, d, x, z] of panels) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    p.position.set(x, wallY, z);
    p.receiveShadow = true;
    group.add(p);
  }

  const neonMat = track(
    new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.35,
      roughness: 0.45,
    }),
  );
  for (const z of [-dist + 0.2, dist - 0.2]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(dist * 2, 0.08, 0.08), neonMat);
    strip.position.set(0, wallH - 0.3, z);
    group.add(strip);
  }

  // Avize gövdeleri (ışık kaynağı yumuşak, düşük yoğunluk)
  const shadeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x2a2420,
      emissive: 0xffd8a8,
      emissiveIntensity: 0.18,
      roughness: 0.5,
    }),
  );
  const lampSpots: [number, number, number][] =
    theme === 'billiards'
      ? [
          [-1.6, 3.8, 0],
          [1.6, 3.8, 0],
        ]
      : theme === 'blackjack'
        ? [
            [-2.2, 4.1, -0.8],
            [2.2, 4.1, -0.8],
            [0, 4.2, 1.4],
          ]
        : [
            [-2.4, 4.0, -1.2],
            [2.4, 4.0, -1.2],
            [0, 4.0, 1.8],
          ];
  for (const [x, y, z] of lampSpots) {
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.85, 0.22, 20), shadeMat);
    shade.position.set(x, y, z);
    group.add(shade);
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.0, 6),
      track(new THREE.MeshStandardMaterial({ color: 0x111111 })),
    );
    cord.position.set(x, y + 0.65, z);
    group.add(cord);
    // Bilardo / blackjack: bir spot gölge atsın; diğerleri yumuşak dolgu
    const cast = (theme === 'billiards' || theme === 'blackjack') && x < 0;
    softSpot(
      THREE,
      group,
      x,
      y - 0.15,
      z,
      z,
      theme === 'billiards' ? 1.45 : theme === 'blackjack' ? 1.6 : 1.75,
      cast,
    );
  }

  if (theme === 'blackjack') {
    // Yan chip / bar rafları
    const gold = track(
      new THREE.MeshPhysicalMaterial({
        color: 0xd4af37,
        metalness: 0.85,
        roughness: 0.28,
        clearcoat: 0.4,
      }),
    );
    const velvet = track(new THREE.MeshStandardMaterial({ color: 0x4a1020, roughness: 0.9 }));
    for (const sx of [-1, 1]) {
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 2.4), velvet);
      cabinet.position.set(sx * (playR + 2.0), 0.2, -0.4);
      cabinet.castShadow = true;
      group.add(cabinet);
      for (let i = 0; i < 4; i++) {
        const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 24), gold);
        chip.position.set(sx * (playR + 1.75), 0.55 + i * 0.08, -1.2 + i * 0.35);
        chip.castShadow = true;
        group.add(chip);
      }
    }
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.55, 0.12),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x1a0a10,
          emissive: 0xd4af37,
          emissiveIntensity: 0.22,
          roughness: 0.5,
        }),
      ),
    );
    sign.position.set(0, 3.2, -(playR + 5.7));
    group.add(sign);
  } else if (theme === 'billiards') {
    const rackMat = track(new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.6 }));
    for (const sx of [-1, 1]) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 2.8), rackMat);
      rack.position.set(sx * (playR + 2.2), 0.6, -1);
      group.add(rack);
      for (let i = 0; i < 5; i++) {
        const cue = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.025, 2.4, 10),
          track(new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.35, metalness: 0.1 })),
        );
        cue.position.set(sx * (playR + 2.05), 1.0, -2 + i * 0.55);
        cue.rotation.z = sx * 0.05;
        group.add(cue);
      }
    }
  } else if (theme === 'tavla') {
    const cushionMat = track(new THREE.MeshStandardMaterial({ color: 0x5a3a7a, roughness: 0.8 }));
    for (const [x, z, w, d] of [
      [0, playR + 3.2, 8, 1.6],
      [0, -(playR + 3.2), 8, 1.6],
    ] as const) {
      const sofa = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, d), cushionMat);
      sofa.position.set(x, -0.35, z);
      group.add(sofa);
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, 0.35), cushionMat);
      back.position.set(x, 0.15, z + (z > 0 ? 0.55 : -0.55));
      group.add(back);
    }
  } else {
    const shelfMat = track(new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.65 }));
    for (const sx of [-1, 1]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.8, 3.2), shelfMat);
      shelf.position.set(sx * (playR + 2.5), 0.9, 0);
      group.add(shelf);
    }
  }
}

function buildBowlingAlley(
  THREE: Three,
  group: import('three').Group,
  track: <T extends Material | Texture | { dispose: () => void }>(x: T) => T,
  accent: number,
) {
  const laneTex = track(laneWoodTexture(THREE));
  laneTex.repeat.set(1, 4);
  const concrete = track(concreteTexture(THREE));
  concrete.repeat.set(4, 4);
  const carpet = track(carpetTexture(THREE, '#2a2438', '#1a1528'));
  carpet.repeat.set(8, 8);

  // Approach / oturma alanı — halı
  const carpetMat = track(
    new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95, metalness: 0 }),
  );
  const approach = new THREE.Mesh(new THREE.BoxGeometry(26, 0.12, 14), carpetMat);
  approach.position.set(0, -0.88, 8);
  approach.receiveShadow = true;
  group.add(approach);

  // Şerit altı beton
  const floorMat = track(
    new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.88, metalness: 0.06 }),
  );
  const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.18, 24), floorMat);
  floor.position.set(0, -0.95, -6);
  floor.receiveShadow = true;
  group.add(floor);

  const ceilMat = track(
    new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.95, side: THREE.DoubleSide }),
  );
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(28, 0.2, 38), ceilMat);
  ceil.position.set(0, 6.35, -3);
  group.add(ceil);
  // Tavan kirişleri
  const beamMat = track(new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.8 }));
  for (let i = -3; i <= 3; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(26, 0.22, 0.35), beamMat);
    beam.position.set(0, 6.15, i * 4.2);
    group.add(beam);
  }

  const wallMat = track(new THREE.MeshStandardMaterial({ color: 0x1c2230, roughness: 0.82 }));
  const wallAccent = track(
    new THREE.MeshStandardMaterial({
      color: 0x2a3348,
      roughness: 0.7,
      map: track(woodTexture(THREE, '#2a3040', '#1a2030')),
    }),
  );
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 7.2, 38), wallMat);
    wall.position.set(sx * 13.2, 2.6, -3);
    wall.receiveShadow = true;
    group.add(wall);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 28), wallAccent);
    panel.position.set(sx * 12.95, 1.8, -2);
    group.add(panel);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.16, 32),
      track(
        new THREE.MeshStandardMaterial({
          color: accent,
          emissive: accent,
          emissiveIntensity: 0.4,
        }),
      ),
    );
    strip.position.set(sx * 12.9, 4.8, -2);
    group.add(strip);
  }

  // Pin deck arka duvar + skor ekranları
  const back = new THREE.Mesh(new THREE.BoxGeometry(22, 6.5, 0.6), wallMat);
  back.position.set(0, 2.6, -14.8);
  back.receiveShadow = true;
  group.add(back);
  const maskMat = track(new THREE.MeshStandardMaterial({ color: 0x0e1018, roughness: 0.75 }));
  for (let i = -2; i <= 2; i++) {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.2), maskMat);
    hood.position.set(i * 3.6, 2.1, -13.6);
    group.add(hood);
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.9, 0.08),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x061018,
          emissive: i === 0 ? 0x3d5a80 : 0x2a4060,
          emissiveIntensity: 0.35,
        }),
      ),
    );
    screen.position.set(i * 3.6, 4.55, -14.4);
    group.add(screen);
  }
  const neon = track(
    new THREE.MeshStandardMaterial({
      color: 0xff79c6,
      emissive: 0xff79c6,
      emissiveIntensity: 0.5,
    }),
  );
  for (const y of [3.7, 5.2]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 0.08), neon);
    s.position.set(0, y, -14.35);
    group.add(s);
  }

  const laneMat = track(
    new THREE.MeshStandardMaterial({
      map: laneTex,
      roughness: 0.32,
      metalness: 0.06,
    }),
  );
  const gutterMat = track(new THREE.MeshStandardMaterial({ color: 0x12151c, roughness: 0.65 }));
  const gutterRail = track(
    new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.25,
      metalness: 0.4,
      roughness: 0.4,
    }),
  );
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const lane = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.14, 22), laneMat);
    lane.position.set(i * 3.6, -0.78, -3);
    lane.receiveShadow = true;
    group.add(lane);
    for (const gx of [-1, 1]) {
      const gutter = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 22), gutterMat);
      gutter.position.set(i * 3.6 + gx * 1.18, -0.9, -3);
      group.add(gutter);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 22), gutterRail);
      rail.position.set(i * 3.6 + gx * 1.38, -0.72, -3);
      group.add(rail);
    }
    // Ball return
    const ret = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.35, 3.2),
      track(new THREE.MeshStandardMaterial({ color: 0x2a3040, metalness: 0.45, roughness: 0.4 })),
    );
    ret.position.set(i * 3.6 + (i > 0 ? 1.7 : -1.7), -0.55, 6.5);
    group.add(ret);
  }

  // Oturma + masa
  const seatMat = track(new THREE.MeshStandardMaterial({ color: 0x3a3558, roughness: 0.72 }));
  const tableMat = track(new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.55 }));
  for (const sx of [-1, 1]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 1.4), seatMat);
    bench.position.set(sx * 7.5, -0.35, 9.2);
    bench.castShadow = true;
    bench.receiveShadow = true;
    group.add(bench);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.85, 0.28), seatMat);
    back.position.set(sx * 7.5, 0.2, 9.75);
    group.add(back);
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.1), tableMat);
    table.position.set(sx * 7.5, 0.05, 7.8);
    table.castShadow = true;
    group.add(table);
  }

  // Foul line şeritleri (yan şeritlerde)
  const foulMat = track(
    new THREE.MeshStandardMaterial({ color: 0xc04040, emissive: 0x801010, emissiveIntensity: 0.2 }),
  );
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const foul = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.02, 0.08), foulMat);
    foul.position.set(i * 3.6, -0.7, 6.2);
    group.add(foul);
  }

  for (const [x, z] of [
    [0, 4],
    [0, -2],
    [0, -8],
    [-6, 1],
    [6, 1],
    [-6, -6],
    [6, -6],
  ] as const) {
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.65, 0.14, 16),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x2a3040,
          emissive: 0xffe8c8,
          emissiveIntensity: 0.28,
        }),
      ),
    );
    lamp.position.set(x, 6.05, z);
    group.add(lamp);
    softSpot(THREE, group, x, 5.85, z, z - 1.2, 1.85);
  }
}
