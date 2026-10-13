/**
 * Yüksek kaliteli prosedürel oyun asset’leri (PBR).
 * Harici GLB bağımlılığı yok — Three.js MeshPhysicalMaterial + canvas map.
 */
import type {
  Group,
  Material,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  Texture,
} from 'three';

type Three = typeof import('three');

export type AssetBag = {
  textures: Texture[];
  materials: Material[];
  geometries: Array<{ dispose: () => void }>;
  dispose: () => void;
};

function bag(): AssetBag {
  const textures: Texture[] = [];
  const materials: Material[] = [];
  const geometries: Array<{ dispose: () => void }> = [];
  return {
    textures,
    materials,
    geometries,
    dispose() {
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
      geometries.forEach((g) => g.dispose());
    },
  };
}

function canvasTex(
  THREE: Three,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  bagRef: AssetBag,
): Texture {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  paint(cv.getContext('2d')!, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  bagRef.textures.push(tex);
  return tex;
}

function trackMat<T extends Material>(m: T, bagRef: AssetBag): T {
  bagRef.materials.push(m);
  return m;
}

function trackGeo<T extends { dispose: () => void }>(g: T, bagRef: AssetBag): T {
  bagRef.geometries.push(g);
  return g;
}

/** Keçe (bilardo / tavla) — merkez biraz daha açık (referans gibi yumuşak ışık) */
export function makeFeltMaterial(THREE: Three, color = '#1f7a42', bagRef: AssetBag) {
  const map = canvasTex(THREE, 512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.1, w * 0.5, h * 0.5, w * 0.7);
    g.addColorStop(0, color);
    g.addColorStop(1, '#14532d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
      const a = 0.02 + Math.random() * 0.05;
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1 + Math.random() * 2);
    }
  }, bagRef);
  map.repeat.set(1.2, 1);
  return trackMat(
    new THREE.MeshPhysicalMaterial({
      map,
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0,
      sheen: 0.18,
      sheenRoughness: 0.9,
      sheenColor: new THREE.Color(color),
    }),
    bagRef,
  );
}

/** Cilalı ahşap — sıcak damar, üstten bakınca düzgün */
export function makeWoodMaterial(THREE: Three, bagRef: AssetBag, tone: 'dark' | 'warm' = 'warm') {
  const base = tone === 'dark' ? '#3a2416' : '#8a5a32';
  const map = canvasTex(THREE, 512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    if (tone === 'dark') {
      g.addColorStop(0, '#2a1810');
      g.addColorStop(0.5, '#3d2618');
      g.addColorStop(1, '#2a1810');
    } else {
      g.addColorStop(0, '#6e4528');
      g.addColorStop(0.35, '#9a683c');
      g.addColorStop(0.65, '#7a4e2c');
      g.addColorStop(1, '#6e4528');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 110; i++) {
      const y = (i / 110) * h + Math.sin(i * 0.7) * 2;
      ctx.strokeStyle = `rgba(30,15,5,${0.06 + (i % 5) * 0.025})`;
      ctx.lineWidth = 1 + (i % 3 === 0 ? 1.2 : 0);
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 5) {
        ctx.lineTo(x, y + Math.sin(x * 0.035 + i * 0.5) * 2.8);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(220,170,100,${0.035})`;
      ctx.beginPath();
      const x0 = Math.random() * w;
      ctx.moveTo(x0, 0);
      ctx.bezierCurveTo(x0 + 25, h * 0.3, x0 - 18, h * 0.7, x0 + 12, h);
      ctx.stroke();
    }
  }, bagRef);
  map.repeat.set(2.5, 1.5);
  map.colorSpace = THREE.SRGBColorSpace;
  return trackMat(
    new THREE.MeshPhysicalMaterial({
      map,
      color: base,
      roughness: 0.4,
      metalness: 0.04,
      clearcoat: 0.45,
      clearcoatRoughness: 0.32,
    }),
    bagRef,
  );
}

/** Bilardo topu — doygun renk + net numara (ışık altında okunaklı) */
export function makePoolBall(
  THREE: Three,
  id: number,
  radius: number,
  colorHex: string,
  striped: boolean,
  bagRef: AssetBag,
): Mesh {
  const map = canvasTex(THREE, 768, 384, (ctx, w, h) => {
    if (striped) {
      ctx.fillStyle = '#f7f4ec';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = colorHex;
      ctx.fillRect(0, h * 0.26, w, h * 0.48);
    } else {
      ctx.fillStyle = id === 0 ? '#f7f4ec' : colorHex;
      ctx.fillRect(0, 0, w, h);
      if (id === 0) {
        const g = ctx.createRadialGradient(w * 0.35, h * 0.35, 8, w * 0.35, h * 0.35, w * 0.38);
        g.addColorStop(0, 'rgba(255,255,255,0.35)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    }
    if (id > 0) {
      for (const cx of [w * 0.25, w * 0.75]) {
        ctx.beginPath();
        ctx.arc(cx, h * 0.5, h * 0.24, 0, Math.PI * 2);
        ctx.fillStyle = '#fffef8';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.stroke();
        if (id === 8) {
          ctx.beginPath();
          ctx.arc(cx, h * 0.5, h * 0.24, 0, Math.PI * 2);
          ctx.fillStyle = '#141414';
          ctx.fill();
        }
        ctx.font = `bold ${Math.floor(h * 0.32)}px system-ui,sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = id === 8 ? '#fffef8' : '#111';
        ctx.fillText(String(id), cx, h * 0.52);
      }
    }
  }, bagRef);

  const geo = trackGeo(new THREE.SphereGeometry(radius, 48, 36), bagRef);
  const mat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map,
      roughness: id === 0 ? 0.22 : 0.28,
      metalness: 0.02,
      clearcoat: 0.45,
      clearcoatRoughness: 0.22,
      envMapIntensity: 0.45,
    }),
    bagRef,
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** İsteka */
export function makeCueStick(THREE: Three, length: number, bagRef: AssetBag): Mesh {
  const geo = trackGeo(new THREE.CylinderGeometry(0.075, 0.038, length, 20), bagRef);
  const map = canvasTex(THREE, 64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e8c49a');
    g.addColorStop(0.15, '#c4956a');
    g.addColorStop(0.5, '#8b5a32');
    g.addColorStop(1, '#3d2412');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, w, h * 0.08);
  }, bagRef);
  const mat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.35,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
    }),
    bagRef,
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

/** Bowling labutu — yüksek segment lathe + parlaklık + çift kırmızı bant */
export function makeBowlingPin(THREE: Three, bagRef: AssetBag): Group {
  const prof: [number, number][] = [
    [0, 0],
    [0.105, 0],
    [0.145, 0.08],
    [0.168, 0.22],
    [0.175, 0.38],
    [0.155, 0.52],
    [0.095, 0.68],
    [0.068, 0.82],
    [0.078, 0.94],
    [0.095, 1.05],
    [0.088, 1.14],
    [0.055, 1.2],
    [0, 1.22],
  ];
  const geo = trackGeo(
    new THREE.LatheGeometry(
      prof.map(([r, y]) => new THREE.Vector2(r, y)),
      48,
    ),
    bagRef,
  );
  const map = canvasTex(THREE, 256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f7f4ef';
    ctx.fillRect(0, 0, w, h);
    // speküler şerit
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.25)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e23d3d';
    ctx.fillRect(0, h * 0.22, w, h * 0.045);
    ctx.fillRect(0, h * 0.29, w, h * 0.03);
  }, bagRef);
  const mat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.22,
      metalness: 0.02,
      clearcoat: 0.75,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.2,
    }),
    bagRef,
  );
  const group = new THREE.Group();
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  return group;
}

/** Bowling topu — mermer + parmak delikleri */
export function makeBowlingBall(THREE: Three, radius: number, bagRef: AssetBag): Group {
  const map = canvasTex(THREE, 512, 256, (ctx, w, h) => {
    const base = ctx.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#4a2080');
    base.addColorStop(0.4, '#7b3fd4');
    base.addColorStop(0.7, '#2d1458');
    base.addColorStop(1, '#5a2aa0');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(140,200,255,${0.04 + Math.random() * 0.08})`;
      ctx.lineWidth = 2 + Math.random() * 6;
      ctx.beginPath();
      ctx.moveTo(Math.random() * w, Math.random() * h);
      ctx.bezierCurveTo(
        Math.random() * w,
        Math.random() * h,
        Math.random() * w,
        Math.random() * h,
        Math.random() * w,
        Math.random() * h,
      );
      ctx.stroke();
    }
  }, bagRef);
  const geo = trackGeo(new THREE.SphereGeometry(radius, 48, 36), bagRef);
  const mat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.18,
      metalness: 0.15,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      envMapIntensity: 1.3,
    }),
    bagRef,
  );
  const group = new THREE.Group();
  const ball = new THREE.Mesh(geo, mat);
  ball.castShadow = true;
  group.add(ball);
  // Parmak delikleri
  const holeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0a0612, roughness: 0.9 }),
    bagRef,
  );
  const holeGeo = trackGeo(new THREE.CircleGeometry(radius * 0.14, 16), bagRef);
  for (const [ax, ay] of [
    [0.35, 0.45],
    [-0.15, 0.55],
    [0.1, 0.15],
  ] as const) {
    const hole = new THREE.Mesh(holeGeo, holeMat);
    hole.position.set(ax * radius, ay * radius, radius * 0.92);
    hole.lookAt(0, 0, 0);
    group.add(hole);
  }
  return group;
}

/** Tavla pulu */
export function makeChecker(
  THREE: Three,
  color: 'white' | 'purple',
  bagRef: AssetBag,
): Mesh {
  const geo = trackGeo(new THREE.CylinderGeometry(0.42, 0.44, 0.18, 40), bagRef);
  const map = canvasTex(THREE, 256, 256, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    if (color === 'white') {
      const g = ctx.createRadialGradient(cx * 0.7, cy * 0.7, 10, cx, cy, w * 0.5);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.6, '#e8e4dc');
      g.addColorStop(1, '#c8c2b4');
      ctx.fillStyle = g;
    } else {
      const g = ctx.createRadialGradient(cx * 0.7, cy * 0.7, 10, cx, cy, w * 0.5);
      g.addColorStop(0, '#a78bfa');
      g.addColorStop(0.5, '#7c4dff');
      g.addColorStop(1, '#3b1f7a');
      ctx.fillStyle = g;
    }
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color === 'white' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.38, 0, Math.PI * 2);
    ctx.stroke();
  }, bagRef);
  const mat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.28,
      metalness: color === 'purple' ? 0.25 : 0.05,
      clearcoat: 0.55,
      clearcoatRoughness: 0.2,
      envMapIntensity: 1,
    }),
    bagRef,
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Zar */
export function makeDie(THREE: Three, bagRef: AssetBag): Mesh {
  const size = 128;
  const faces = [1, 2, 3, 4, 5, 6];
  const canvases = faces.map((n) => {
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#f4efe6';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, size - 6, size - 6);
    ctx.fillStyle = '#1a1228';
    const dots: Record<number, [number, number][]> = {
      1: [[0.5, 0.5]],
      2: [
        [0.28, 0.28],
        [0.72, 0.72],
      ],
      3: [
        [0.28, 0.28],
        [0.5, 0.5],
        [0.72, 0.72],
      ],
      4: [
        [0.28, 0.28],
        [0.72, 0.28],
        [0.28, 0.72],
        [0.72, 0.72],
      ],
      5: [
        [0.28, 0.28],
        [0.72, 0.28],
        [0.5, 0.5],
        [0.28, 0.72],
        [0.72, 0.72],
      ],
      6: [
        [0.28, 0.25],
        [0.72, 0.25],
        [0.28, 0.5],
        [0.72, 0.5],
        [0.28, 0.75],
        [0.72, 0.75],
      ],
    };
    for (const [x, y] of dots[n]!) {
      ctx.beginPath();
      ctx.arc(x * size, y * size, size * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    return cv;
  });
  // Box: +x -x +y -y +z -z → right left top bottom front back
  const order = [0, 1, 2, 3, 4, 5]; // we'll map 1..6
  const mats = order.map((i) => {
    const tex = new THREE.CanvasTexture(canvases[i]!);
    tex.colorSpace = THREE.SRGBColorSpace;
    bagRef.textures.push(tex);
    return trackMat(
      new THREE.MeshPhysicalMaterial({
        map: tex,
        roughness: 0.35,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
      }),
      bagRef,
    );
  });
  const geo = trackGeo(new THREE.BoxGeometry(0.85, 0.85, 0.85), bagRef);
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true;
  return mesh;
}

/** Okey taşı yüzeyi */
export function makeOkeyTileFace(
  THREE: Three,
  key: string,
  bagRef: AssetBag,
  sideMat: Material,
): Material[] {
  const map = canvasTex(THREE, 160, 220, (ctx, w, h) => {
    if (key === 'back') {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#5b3d8a');
      g.addColorStop(1, '#2a1848');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#bd93f9';
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#e0d0ff';
      ctx.font = `bold ${Math.floor(w * 0.45)}px Georgia,serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♛', w / 2, h / 2);
      return;
    }
    const [cs, ns, ws] = key.split('-');
    const wild = ws === '1';
    // fildişi
    const ivory = ctx.createLinearGradient(0, 0, 0, h);
    ivory.addColorStop(0, '#fff8ec');
    ivory.addColorStop(1, '#e8dcc4');
    ctx.fillStyle = ivory;
    ctx.fillRect(0, 0, w, h);
    if (wild) {
      ctx.strokeStyle = '#bd93f9';
      ctx.lineWidth = 10;
      ctx.strokeRect(6, 6, w - 12, h - 12);
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, w - 8, h - 8);
    }
    if (cs === 'j') {
      ctx.fillStyle = '#7c3aed';
      ctx.font = `bold ${Math.floor(h * 0.4)}px Georgia,serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', w / 2, h / 2);
    } else {
      const colors = ['#d4a017', '#2563eb', '#1f2937', '#dc2626'];
      ctx.fillStyle = colors[Number(cs)] ?? '#111';
      ctx.font = `bold ${Math.floor(h * 0.42)}px system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ns!, w / 2, h * 0.42);
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.72, h * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }, bagRef);
  const face = trackMat(
    new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.4,
      clearcoat: 0.25,
      clearcoatRoughness: 0.45,
    }),
    bagRef,
  );
  return [sideMat, sideMat, face, sideMat, sideMat, sideMat];
}

const BJ_SUITS = ['♠', '♥', '♦', '♣'] as const;
const BJ_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

/** Poker kartı — yüz veya sırt */
export function makePlayingCard(
  THREE: Three,
  cardId: number | 'back',
  bagRef: AssetBag,
  w = 0.72,
  h = 1.05,
): Mesh {
  const map = canvasTex(THREE, 256, 384, (ctx, cw, ch) => {
    if (cardId === 'back') {
      const g = ctx.createLinearGradient(0, 0, cw, ch);
      g.addColorStop(0, '#2a1848');
      g.addColorStop(0.5, '#4a2080');
      g.addColorStop(1, '#1a1028');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 10;
      ctx.strokeRect(12, 12, cw - 24, ch - 24);
      ctx.strokeStyle = 'rgba(212,175,55,0.45)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        ctx.strokeRect(22 + i * 4, 22 + i * 4, cw - 44 - i * 8, ch - 44 - i * 8);
      }
      ctx.fillStyle = '#f1e4a8';
      ctx.font = `bold ${Math.floor(cw * 0.22)}px Georgia,serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♠', cw / 2, ch / 2);
      return;
    }
    const rank = cardId % 13;
    const suit = Math.floor(cardId / 13) % 4;
    const red = suit === 1 || suit === 2;
    const ivory = ctx.createLinearGradient(0, 0, 0, ch);
    ivory.addColorStop(0, '#fffdf8');
    ivory.addColorStop(1, '#ebe4d4');
    ctx.fillStyle = ivory;
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, cw - 12, ch - 12);
    ctx.fillStyle = red ? '#c01c28' : '#141414';
    ctx.font = `bold ${Math.floor(ch * 0.14)}px system-ui,sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const label = `${BJ_RANKS[rank]}${BJ_SUITS[suit]}`;
    ctx.fillText(label, 16, 14);
    ctx.font = `${Math.floor(ch * 0.28)}px Georgia,serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(BJ_SUITS[suit]!, cw / 2, ch * 0.52);
    ctx.save();
    ctx.translate(cw - 16, ch - 14);
    ctx.rotate(Math.PI);
    ctx.font = `bold ${Math.floor(ch * 0.14)}px system-ui,sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }, bagRef);
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;

  const edge = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.85 }),
    bagRef,
  );
  const face = trackMat(
    new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.42,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.35,
    }),
    bagRef,
  );
  const geo = trackGeo(new THREE.BoxGeometry(w, 0.02, h), bagRef);
  const mesh = new THREE.Mesh(geo, [edge, edge, face, edge, edge, edge]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export type DealerInteractKind = 'tickle' | 'chest';

export type DealerRig = {
  root: Group;
  head: Group;
  jaw: Mesh;
  armR: Group;
  armL: Group;
  torso: Group;
  setTalking: (v: boolean) => void;
  setDealPulse: () => void;
  lookAtSeat: (x: number, z: number) => void;
  /** Kameraya / masaya bakış — yüz görünsün */
  faceCamera: (camX: number, camY: number, camZ: number) => void;
  update: (t: number, dt: number) => void;
  /** Dokunma: gıdıklama / göğüs — opsiyonel */
  poke?: (kind: DealerInteractKind, strength?: number) => void;
  /** VRM / harici model için opsiyonel temizlik */
  dispose?: () => void;
  kind?: 'procedural' | 'vrm';
};

/** Anime kurpiyer yüzü — tek canvas; ikinci 3D yüz yok */
function makeDealerFaceMap(THREE: Three, bagRef: AssetBag, openMouth = false): Texture {
  return canvasTex(THREE, 512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // Oval anime yüz
    const skinG = ctx.createRadialGradient(w * 0.5, h * 0.42, 30, w * 0.5, h * 0.5, w * 0.48);
    skinG.addColorStop(0, '#fff0e6');
    skinG.addColorStop(0.65, '#ffd4c0');
    skinG.addColorStop(1, '#f0b8a0');
    ctx.fillStyle = skinG;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.52, w * 0.36, h * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();

    // Allık
    ctx.fillStyle = 'rgba(255,140,160,0.4)';
    ctx.beginPath();
    ctx.ellipse(w * 0.3, h * 0.58, 40, 26, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.7, h * 0.58, 40, 26, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // İnce kaşlar
    ctx.strokeStyle = '#c89850';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.34);
    ctx.quadraticCurveTo(w * 0.32, h * 0.28, w * 0.42, h * 0.34);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.58, h * 0.34);
    ctx.quadraticCurveTo(w * 0.68, h * 0.28, w * 0.78, h * 0.34);
    ctx.stroke();

    // Büyük anime gözler
    const drawEye = (cx: number) => {
      ctx.fillStyle = '#1a1218';
      ctx.beginPath();
      ctx.ellipse(cx, h * 0.44, 48, 52, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fffaf8';
      ctx.beginPath();
      ctx.ellipse(cx, h * 0.45, 40, 44, 0, 0, Math.PI * 2);
      ctx.fill();
      // Iris
      const ig = ctx.createRadialGradient(cx, h * 0.46, 4, cx, h * 0.48, 22);
      ig.addColorStop(0, '#a8e8ff');
      ig.addColorStop(0.45, '#4a9ee0');
      ig.addColorStop(1, '#1a4068');
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.ellipse(cx, h * 0.48, 20, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0812';
      ctx.beginPath();
      ctx.arc(cx, h * 0.49, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(cx - 7, h * 0.42, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 8, h * 0.5, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // Kirpik
      ctx.strokeStyle = '#1a1014';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx - 42, h * 0.4);
      ctx.quadraticCurveTo(cx, h * 0.32, cx + 42, h * 0.4);
      ctx.stroke();
    };
    drawEye(w * 0.33);
    drawEye(w * 0.67);

    // Küçük burun
    ctx.strokeStyle = 'rgba(200,140,120,0.45)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.54);
    ctx.lineTo(w * 0.48, h * 0.62);
    ctx.quadraticCurveTo(w * 0.5, h * 0.64, w * 0.52, h * 0.62);
    ctx.stroke();

    // Ağız — yalnızca canvas (ekstra 3D çene yok)
    if (openMouth) {
      ctx.fillStyle = '#4a1020';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.76, 36, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff5f0';
      ctx.fillRect(w * 0.5 - 26, h * 0.7, 52, 8);
      ctx.fillStyle = '#ff5a7a';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.82, 30, 10, 0, 0, Math.PI);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#e04068';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w * 0.4, h * 0.74);
      ctx.quadraticCurveTo(w * 0.5, h * 0.84, w * 0.6, h * 0.74);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,90,120,0.35)';
      ctx.beginPath();
      ctx.moveTo(w * 0.42, h * 0.74);
      ctx.quadraticCurveTo(w * 0.5, h * 0.8, w * 0.58, h * 0.74);
      ctx.quadraticCurveTo(w * 0.5, h * 0.77, w * 0.42, h * 0.74);
      ctx.fill();
    }
  }, bagRef);
}

/**
 * Anime casino kurpiyeri — platin saç, iri gözler, dolgun büst; tek yüz paneli.
 */
export function makeDealerWoman(THREE: Three, bagRef: AssetBag): DealerRig {
  const root = new THREE.Group();
  root.name = 'dealer';
  root.scale.setScalar(1.12);

  const skin = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffe0cc,
      roughness: 0.38,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      sheen: 0.55,
      sheenColor: new THREE.Color(0xfff0e8),
    }),
    bagRef,
  );
  const hairMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffe8a8,
      roughness: 0.28,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
      sheen: 0.9,
      sheenColor: new THREE.Color(0xfff6d0),
    }),
    bagRef,
  );
  const hairHi = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xfff6c8,
      roughness: 0.22,
      clearcoat: 0.75,
      sheen: 1,
      sheenColor: new THREE.Color(0xffffff),
    }),
    bagRef,
  );
  const dress = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1a0c18,
      roughness: 0.32,
      clearcoat: 0.4,
      sheen: 0.35,
      sheenColor: new THREE.Color(0x604050),
    }),
    bagRef,
  );
  const accent = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.25,
    }),
    bagRef,
  );
  const ribbon = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xff4a6a,
      roughness: 0.4,
      clearcoat: 0.25,
    }),
    bagRef,
  );
  // Tip uyumu için gizli jaw mesh (görünmez — çift yüz olmasın)
  const jawHidden = trackMat(
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    bagRef,
  );

  const torso = new THREE.Group();
  torso.position.y = 0.88;
  root.add(torso);

  // Kalça / etek
  const hips = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.24, 0.28, 0.38, 22), bagRef),
    dress,
  );
  hips.position.y = -0.28;
  hips.castShadow = true;
  torso.add(hips);
  const skirt = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.26, 0.42, 0.32, 22), bagRef),
    dress,
  );
  skirt.position.y = -0.48;
  torso.add(skirt);

  // İnce bel
  const waist = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.14, 0.2, 0.28, 20), bagRef),
    dress,
  );
  waist.position.y = 0.08;
  waist.castShadow = true;
  torso.add(waist);

  // İri büst (ayrı küreler)
  for (const sx of [-1, 1] as const) {
    const breast = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.155, 20, 16), bagRef),
      skin,
    );
    breast.scale.set(1.05, 0.95, 1.15);
    breast.position.set(sx * 0.12, 0.32, 0.16);
    breast.castShadow = true;
    torso.add(breast);
  }
  // Dekolte üstü kumaş bandı
  const cleave = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.2, 18, 12), bagRef),
    dress,
  );
  cleave.scale.set(1.55, 0.55, 0.7);
  cleave.position.set(0, 0.28, 0.08);
  torso.add(cleave);

  // Omuzlar
  for (const sx of [-1, 1] as const) {
    const shoulder = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.08, 12, 10), bagRef), skin);
    shoulder.position.set(sx * 0.22, 0.48, 0);
    torso.add(shoulder);
  }

  // Kırmızı kurdele boyunda
  const bowC = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.03, 10, 8), bagRef), ribbon);
  bowC.position.set(0, 0.52, 0.2);
  torso.add(bowC);
  for (const sx of [-1, 1] as const) {
    const wing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.05, 0.025), bagRef), ribbon);
    wing.position.set(sx * 0.07, 0.52, 0.195);
    wing.rotation.z = sx * 0.2;
    torso.add(wing);
  }

  // Bacaklar
  for (const sx of [-1, 1] as const) {
    const leg = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.05, 0.062, 0.62, 12), bagRef),
      skin,
    );
    leg.position.set(sx * 0.1, 0.0, 0.02);
    leg.castShadow = true;
    root.add(leg);
    const shoe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.07, 0.22), bagRef), dress);
    shoe.position.set(sx * 0.1, -0.32, 0.05);
    root.add(shoe);
  }

  // —— Baş: tek yüz paneli (skull arkada, yüz önde; ekstra çene yok) ——
  const head = new THREE.Group();
  head.position.y = 1.68;
  root.add(head);

  const skull = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.19, 28, 22), bagRef), skin);
  skull.scale.set(0.95, 1.15, 0.88);
  skull.castShadow = true;
  head.add(skull);

  const faceClosed = makeDealerFaceMap(THREE, bagRef, false);
  const faceOpen = makeDealerFaceMap(THREE, bagRef, true);
  faceClosed.wrapS = faceClosed.wrapT = THREE.ClampToEdgeWrapping;
  faceOpen.wrapS = faceOpen.wrapT = THREE.ClampToEdgeWrapping;

  const faceMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: faceClosed,
      transparent: true,
      roughness: 0.42,
      metalness: 0,
      side: THREE.FrontSide,
      depthWrite: true,
    }),
    bagRef,
  );
  // Kameraya bakan düz yüz — eğim yok (üst üste binme olmasın)
  const face = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.36, 0.42), bagRef), faceMat);
  face.position.set(0, 0.02, 0.175);
  head.add(face);

  const jaw = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.02, 6, 6), bagRef), jawHidden);
  jaw.visible = false;
  head.add(jaw);

  // Uzun anime saç — yüzü kapatmadan yanlardan
  const hairTop = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.23, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), bagRef),
    hairMat,
  );
  hairTop.position.set(0, 0.12, -0.02);
  hairTop.scale.set(1.2, 1.05, 1.15);
  head.add(hairTop);
  const bang = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.08, 14, 10), bagRef), hairHi);
  bang.position.set(0, 0.18, 0.1);
  bang.scale.set(1.7, 0.32, 0.45);
  head.add(bang);
  for (const [x, y, z, s, hi] of [
    [-0.22, 0.02, 0.02, 0.1, 1],
    [0.22, 0.02, 0.02, 0.1, 1],
    [-0.2, -0.18, -0.06, 0.12, 0],
    [0.2, -0.18, -0.06, 0.12, 0],
    [-0.16, -0.38, -0.1, 0.11, 1],
    [0.16, -0.38, -0.1, 0.11, 1],
    [0, -0.12, -0.22, 0.15, 0],
    [-0.12, -0.55, -0.08, 0.09, 0],
    [0.12, -0.55, -0.08, 0.09, 0],
  ] as const) {
    const lock = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(s, 12, 10), bagRef),
      hi ? hairHi : hairMat,
    );
    lock.position.set(x, y, z);
    head.add(lock);
  }
  // Küçük küpe
  for (const sx of [-1, 1] as const) {
    const earring = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.025, 8, 8), bagRef), accent);
    earring.position.set(sx * 0.2, -0.08, 0.05);
    head.add(earring);
  }

  const mkArm = (side: 1 | -1) => {
    const g = new THREE.Group();
    g.position.set(side * 0.3, 1.32, 0.02);
    const upper = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.045, 0.052, 0.34, 12), bagRef),
      skin,
    );
    upper.position.y = -0.15;
    upper.castShadow = true;
    g.add(upper);
    const fore = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.038, 0.042, 0.28, 12), bagRef),
      skin,
    );
    fore.position.set(0, -0.48, 0.04);
    fore.rotation.x = -0.3;
    fore.castShadow = true;
    g.add(fore);
    const hand = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.048, 10, 8), bagRef), skin);
    hand.position.set(0, -0.64, 0.08);
    g.add(hand);
    root.add(g);
    return g;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  armR.rotation.z = -0.32;
  armL.rotation.z = 0.32;

  let talking = false;
  let dealT = 0;
  let lookX = 0;
  let lookZ = -1;
  let tickle = 0;
  let chestPlay = 0;

  return {
    kind: 'procedural' as const,
    root,
    head,
    jaw,
    armR,
    armL,
    torso,
    setTalking(v) {
      talking = v;
    },
    setDealPulse() {
      dealT = 1;
    },
    poke(kind, strength = 1) {
      const s = Math.min(1.4, Math.max(0.35, strength));
      if (kind === 'chest') chestPlay = Math.min(1.2, chestPlay + 0.75 * s);
      else tickle = Math.min(1.2, tickle + 0.85 * s);
    },
    lookAtSeat(x, z) {
      lookX = x;
      lookZ = z;
    },
    faceCamera(camX, _camY, camZ) {
      lookX = camX;
      lookZ = camZ + 2.75;
      // Hafif kamera bakışı — aşırı eğim yüzü bozmasın
      head.rotation.x = -0.12;
    },
    update(t, dt) {
      tickle = Math.max(0, tickle - dt * 1.35);
      chestPlay = Math.max(0, chestPlay - dt * 0.95);
      const breath = Math.sin(t * 2.2) * 0.014;
      const tk = tickle;
      const cp = chestPlay;
      torso.position.y = 0.88 + breath + Math.sin(t * 28) * 0.02 * tk;
      torso.rotation.y = Math.sin(t * 0.5) * 0.04 + Math.sin(t * 22) * 0.08 * tk;
      torso.rotation.z =
        Math.sin(t * 0.65) * 0.015 +
        Math.sin(t * 18) * 0.06 * tk +
        Math.sin(t * 9) * 0.05 * cp;
      torso.rotation.x = Math.sin(t * 12) * 0.04 * cp;

      const targetYaw = Math.atan2(lookX, Math.max(0.35, lookZ)) * 0.45;
      head.rotation.y +=
        (targetYaw + Math.sin(t * 26) * 0.12 * tk - head.rotation.y) *
        Math.min(1, dt * 4);
      const basePitch = -0.1;
      head.rotation.x =
        basePitch +
        Math.sin(t * 1.2) * 0.015 +
        (talking ? Math.sin(t * 10) * 0.02 : 0) +
        Math.sin(t * 20) * 0.05 * tk;

      // Konuşma yalnızca yüz texture değişimi — ikinci ağız yok
      if (talking) {
        const open = Math.abs(Math.sin(t * 16));
        faceMat.map = open > 0.55 ? faceOpen : faceClosed;
        faceMat.needsUpdate = true;
      } else if (faceMat.map !== faceClosed) {
        faceMat.map = faceClosed;
        faceMat.needsUpdate = true;
      }
      jaw.visible = false;

      if (dealT > 0) {
        dealT = Math.max(0, dealT - dt * 1.8);
        const wave = Math.sin((1 - dealT) * Math.PI) * 1.1;
        armR.rotation.x = -0.25 - wave * 0.95;
        armR.rotation.z = -0.32 - wave * 0.4;
      } else {
        armR.rotation.x +=
          (Math.sin(t * 1.1) * 0.08 - Math.sin(t * 30) * 0.25 * tk - armR.rotation.x) *
          0.08;
        armR.rotation.z += (-0.32 - armR.rotation.z) * 0.08;
      }
      armL.rotation.x = Math.sin(t * 1.1 + 1) * 0.06 + Math.sin(t * 32) * 0.2 * tk;
      armL.rotation.z = 0.32 + Math.sin(t * 0.9) * 0.03;
    },
  };
}

export function createAssetBag(): AssetBag {
  return bag();
}

export function disposeObjectExtras(root: Object3D, assets: AssetBag) {
  assets.dispose();
  void root;
}

export type { MeshPhysicalMaterial };
