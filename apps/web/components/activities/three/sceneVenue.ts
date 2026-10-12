import type { Material, Object3D, Scene, Texture, WebGLRenderer } from 'three';

export type VenueTheme = 'billiards' | 'bowling' | 'tavla' | 'okey';

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
 * Üstten bakan kameralarda (tavla/bilardo/okey) tavan/zemin oyunu örtmez:
 * zemin halka (ortası boş), tavan yok veya yalnızca kenar kirişleri.
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

  // Arka plan: soft gradient (sis yok — oyun soluklaşmasın)
  scene.fog = null;
  const bg = makeNoiseTexture(THREE, 8, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (theme === 'bowling') {
      g.addColorStop(0, '#0e121c');
      g.addColorStop(0.55, '#1a2030');
      g.addColorStop(1, '#0a0c12');
    } else if (theme === 'tavla') {
      g.addColorStop(0, '#1c1430');
      g.addColorStop(0.5, '#2a1f42');
      g.addColorStop(1, '#120c1c');
    } else if (theme === 'okey') {
      g.addColorStop(0, '#181428');
      g.addColorStop(0.5, '#241c38');
      g.addColorStop(1, '#100c18');
    } else {
      g.addColorStop(0, '#141018');
      g.addColorStop(0.5, '#1e1824');
      g.addColorStop(1, '#0c0a10');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  track(bg);
  scene.background = bg;

  // Ortam yansıması (PBR) — asenkron; oyun geometrisini bloklamaz
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
        envState.dispose = () => {
          rt.dispose();
          pmremGen.dispose();
          env.dispose();
          if (scene.environment === rt.texture) scene.environment = null;
        };
      })
      .catch(() => undefined);
  }

  const neon =
    theme === 'bowling' ? 0x8be9fd : theme === 'tavla' ? 0xffb86c : theme === 'okey' ? 0xbd93f9 : 0xd4a574;

  if (theme === 'bowling') {
    buildBowlingAlley(THREE, group, track, neon);
  } else {
    buildTableRoom(THREE, group, track, theme, playR, neon);
  }

  // Dolgu ışık (mekan)
  const rim = new THREE.PointLight(neon, 0.65, 40, 2);
  rim.position.set(0, theme === 'bowling' ? 4.5 : 6, theme === 'bowling' ? -2 : 0);
  group.add(rim);
  const warm = new THREE.PointLight(0xffd8a8, 0.45, 35, 2);
  warm.position.set(-5, 5, 4);
  group.add(warm);

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

function buildTableRoom(
  THREE: Three,
  group: import('three').Group,
  track: <T extends Material | Texture | { dispose: () => void }>(x: T) => T,
  theme: VenueTheme,
  playR: number,
  neon: number,
) {
  const woodTex = track(woodTexture(THREE));
  woodTex.repeat.set(4, 4);
  const carpetTex = track(
    carpetTexture(
      THREE,
      theme === 'billiards' ? '#3a2418' : theme === 'tavla' ? '#3a2458' : '#2a2040',
      theme === 'billiards' ? '#241810' : '#1a1228',
    ),
  );
  carpetTex.repeat.set(6, 6);

  // Zemin: ORTA DELİKLİ halka — üstten bakınca masa görünür
  const floorMat = track(
    new THREE.MeshStandardMaterial({
      map: carpetTex,
      roughness: 0.95,
      metalness: 0.02,
    }),
  );
  const floor = new THREE.Mesh(
    new THREE.RingGeometry(playR * 0.92, playR + 14, 64),
    floorMat,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.9;
  floor.receiveShadow = true;
  group.add(floor);

  // Merkezde çok koyu ince zemin (masa altı gölge), masa geometrisinin ALTINDA
  const underMat = track(
    new THREE.MeshStandardMaterial({ color: 0x0a0810, roughness: 1 }),
  );
  const under = new THREE.Mesh(new THREE.CircleGeometry(playR * 0.9, 48), underMat);
  under.rotation.x = -Math.PI / 2;
  under.position.y = -0.95;
  under.receiveShadow = true;
  group.add(under);

  // 4 duvar paneli (kamera üstte — duvarlar görüşü kesmez)
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

  // Kenar neon şeritler (duvar üstü)
  const neonMat = track(new THREE.MeshStandardMaterial({
    color: neon,
    emissive: neon,
    emissiveIntensity: 0.85,
    roughness: 0.4,
  }));
  for (const z of [-dist + 0.2, dist - 0.2]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(dist * 2, 0.08, 0.08), neonMat);
    strip.position.set(0, wallH - 0.3, z);
    group.add(strip);
  }

  // Asılı avizeler — masa ÜSTÜNDE ama küçük, kamerayı kapatmaz
  const shadeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x2a2030,
      emissive: neon,
      emissiveIntensity: 0.25,
      roughness: 0.45,
    }),
  );
  const lampSpots: [number, number][] =
    theme === 'billiards'
      ? [
          [-2.2, 0],
          [2.2, 0],
        ]
      : [
          [-3, -2],
          [3, -2],
          [0, 2.5],
        ];
  for (const [x, z] of lampSpots) {
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 0.28, 20), shadeMat);
    shade.position.set(x, 4.2, z);
    group.add(shade);
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6),
      track(new THREE.MeshStandardMaterial({ color: 0x111111 })),
    );
    cord.position.set(x, 5.0, z);
    group.add(cord);
    const light = new THREE.SpotLight(0xffe6c8, 8, 18, Math.PI / 5, 0.45, 1);
    light.position.set(x, 4.0, z);
    light.target.position.set(x, 0, z);
    light.castShadow = true;
    group.add(light);
    group.add(light.target);
  }

  // Dekor
  if (theme === 'billiards') {
    const rackMat = track(
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.6 }),
    );
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
    const cushionMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x5a3a7a,
        roughness: 0.8,
      }),
    );
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
    // okey
    const shelfMat = track(
      new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.65 }),
    );
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
  neon: number,
) {
  const laneTex = track(laneWoodTexture(THREE));
  laneTex.repeat.set(1, 3);
  const concrete = track(concreteTexture(THREE));
  concrete.repeat.set(4, 4);

  // Kapalı salon zemini
  const floorMat = track(
    new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.9, metalness: 0.05 }),
  );
  const floor = new THREE.Mesh(new THREE.BoxGeometry(28, 0.2, 36), floorMat);
  floor.position.set(0, -0.95, -4);
  floor.receiveShadow = true;
  group.add(floor);

  // Tavan (kamera içeride — bowling yatay bakış)
  const ceilMat = track(
    new THREE.MeshStandardMaterial({ color: 0x1a1d28, roughness: 0.95, side: THREE.DoubleSide }),
  );
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(28, 0.15, 36), ceilMat);
  ceil.position.set(0, 6.2, -4);
  group.add(ceil);

  // Yan duvarlar
  const wallMat = track(
    new THREE.MeshStandardMaterial({ color: 0x222636, roughness: 0.85 }),
  );
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 36), wallMat);
    wall.position.set(sx * 13.5, 2.5, -4);
    group.add(wall);
    // Neon duvar şeridi
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.2, 30),
      track(
        new THREE.MeshStandardMaterial({
          color: neon,
          emissive: neon,
          emissiveIntensity: 1.2,
        }),
      ),
    );
    strip.position.set(sx * 13.2, 4.5, -3);
    group.add(strip);
  }

  // Arka pin duvarı + skor paneli
  const back = new THREE.Mesh(new THREE.BoxGeometry(18, 6, 0.5), wallMat);
  back.position.set(0, 2.5, -14.5);
  group.add(back);
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(10, 1.2, 0.1),
    track(
      new THREE.MeshStandardMaterial({
        color: 0x0a0a12,
        emissive: 0x4a3080,
        emissiveIntensity: 0.4,
      }),
    ),
  );
  screen.position.set(0, 4.8, -14.2);
  group.add(screen);
  const pink = track(
    new THREE.MeshStandardMaterial({
      color: 0xff79c6,
      emissive: 0xff79c6,
      emissiveIntensity: 1.1,
    }),
  );
  for (const y of [3.6, 5.4]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(12, 0.12, 0.08), pink);
    s.position.set(0, y, -14.15);
    group.add(s);
  }

  // Yan bowling şeritleri (dokulu)
  const laneMat = track(
    new THREE.MeshStandardMaterial({
      map: laneTex,
      roughness: 0.35,
      metalness: 0.05,
    }),
  );
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const lane = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 20), laneMat);
    lane.position.set(i * 3.6, -0.78, -2);
    lane.receiveShadow = true;
    group.add(lane);
    for (const gx of [-1, 1]) {
      const gutter = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.1, 20),
        track(new THREE.MeshStandardMaterial({ color: 0x151820, roughness: 0.7 })),
      );
      gutter.position.set(i * 3.6 + gx * 1.15, -0.88, -2);
      group.add(gutter);
    }
  }

  // Oturma / approach alanı
  const seatMat = track(
    new THREE.MeshStandardMaterial({ color: 0x3a3050, roughness: 0.75 }),
  );
  for (const sx of [-1, 1]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.45, 1.2), seatMat);
    bench.position.set(sx * 8, -0.4, 8);
    group.add(bench);
  }

  // Tavan spotları
  for (const [x, z] of [
    [0, 2],
    [0, -4],
    [0, -9],
    [-6, -2],
    [6, -2],
  ] as const) {
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 0.2, 16),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x333848,
          emissive: neon,
          emissiveIntensity: 0.5,
        }),
      ),
    );
    lamp.position.set(x, 5.9, z);
    group.add(lamp);
    const spot = new THREE.SpotLight(0xfff0dd, 12, 22, Math.PI / 6, 0.5, 1);
    spot.position.set(x, 5.7, z);
    spot.target.position.set(x, 0, z - 2);
    group.add(spot);
    group.add(spot.target);
  }
}
