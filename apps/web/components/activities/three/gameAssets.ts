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
  update: (t: number, dt: number) => void;
};

/**
 * Klasik casino kurpiyer (Sketchfab croupier tarzı referans):
 * beyaz gömlek + siyah yelek + kırmızı papyon, sarışın bob, güler yüz.
 * Not: Sketchfab modeli lisanslı — dosya indirilmez, stil taklit edilir.
 * @see https://sketchfab.com/3d-models/croupier-732a284aaee742efb57a30dc05651bd0
 */
export function makeDealerWoman(THREE: Three, bagRef: AssetBag): DealerRig {
  const root = new THREE.Group();
  root.name = 'dealer';
  root.scale.setScalar(1.08);

  const skin = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffd8be,
      roughness: 0.4,
      clearcoat: 0.28,
      clearcoatRoughness: 0.45,
      sheen: 0.4,
      sheenColor: new THREE.Color(0xffe8d8),
    }),
    bagRef,
  );
  const hairMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf0d078,
      roughness: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.22,
      sheen: 0.75,
      sheenColor: new THREE.Color(0xfff2c8),
    }),
    bagRef,
  );
  const hairHi = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xfff0b0,
      roughness: 0.26,
      clearcoat: 0.65,
      sheen: 0.85,
      sheenColor: new THREE.Color(0xfff8d8),
    }),
    bagRef,
  );
  const shirt = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf7f4ef,
      roughness: 0.55,
      clearcoat: 0.12,
    }),
    bagRef,
  );
  const vest = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x141018,
      roughness: 0.35,
      metalness: 0.08,
      clearcoat: 0.35,
      sheen: 0.25,
      sheenColor: new THREE.Color(0x403040),
    }),
    bagRef,
  );
  const pants = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1a1520,
      roughness: 0.45,
      clearcoat: 0.15,
    }),
    bagRef,
  );
  const bow = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc01828,
      roughness: 0.4,
      clearcoat: 0.2,
    }),
    bagRef,
  );
  const gold = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe8c850,
      metalness: 0.9,
      roughness: 0.22,
    }),
    bagRef,
  );
  const lipMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd83858,
      roughness: 0.25,
      emissive: 0x601020,
      emissiveIntensity: 0.22,
    }),
    bagRef,
  );
  const teethMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfff8f0, roughness: 0.35 }),
    bagRef,
  );
  const blushMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xff9aaa,
      transparent: true,
      opacity: 0.38,
      roughness: 0.85,
      depthWrite: false,
    }),
    bagRef,
  );
  const eyeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3a8ec8,
      roughness: 0.2,
      emissive: 0x102838,
      emissiveIntensity: 0.12,
    }),
    bagRef,
  );
  const eyeWhite = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfffaf5, roughness: 0.4 }),
    bagRef,
  );
  const lashMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1a1010, roughness: 0.45 }), bagRef);
  const browMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd4b060, roughness: 0.55 }),
    bagRef,
  );

  // —— Vücut: klasik kurpiyer üniforması ——
  const torso = new THREE.Group();
  torso.position.y = 0.9;
  root.add(torso);

  // Pantolon
  const hips = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.2, 0.22, 0.42, 20), bagRef), pants);
  hips.position.y = -0.22;
  hips.castShadow = true;
  torso.add(hips);

  // Beyaz gömlek
  const shirtMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.18, 0.21, 0.58, 20), bagRef),
    shirt,
  );
  shirtMesh.position.y = 0.28;
  shirtMesh.castShadow = true;
  torso.add(shirtMesh);

  // Yaka
  for (const sx of [-1, 1] as const) {
    const collar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.06, 0.08), bagRef), shirt);
    collar.position.set(sx * 0.08, 0.58, 0.12);
    collar.rotation.z = sx * -0.35;
    collar.rotation.x = -0.25;
    torso.add(collar);
  }

  // Siyah yelek (öne doğru açık V)
  const vestMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.19, 0.22, 0.48, 20), bagRef),
    vest,
  );
  vestMesh.position.set(0, 0.26, -0.01);
  vestMesh.scale.set(1.05, 1, 0.88);
  vestMesh.castShadow = true;
  torso.add(vestMesh);

  // Yelek düğmeleri
  for (let i = 0; i < 3; i++) {
    const btn = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.018, 8, 8), bagRef), gold);
    btn.position.set(0, 0.4 - i * 0.1, 0.175);
    torso.add(btn);
  }

  // Kırmızı papyon
  const bowCenter = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.035, 10, 8), bagRef), bow);
  bowCenter.position.set(0, 0.56, 0.2);
  torso.add(bowCenter);
  for (const sx of [-1, 1] as const) {
    const wing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.055, 0.03), bagRef), bow);
    wing.position.set(sx * 0.08, 0.56, 0.195);
    wing.rotation.z = sx * 0.15;
    torso.add(wing);
  }

  // Omuz dolgusu (üniforma silüeti)
  for (const sx of [-1, 1] as const) {
    const shoulder = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.09, 12, 10), bagRef), shirt);
    shoulder.position.set(sx * 0.2, 0.52, 0);
    shoulder.scale.set(1.1, 0.7, 0.9);
    torso.add(shoulder);
  }

  // Büst (gömlek altında hafif)
  const bust = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.16, 18, 14), bagRef), shirt);
  bust.scale.set(1.35, 0.85, 0.85);
  bust.position.set(0, 0.38, 0.06);
  torso.add(bust);

  for (const sx of [-1, 1] as const) {
    const leg = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 0.58, 12), bagRef),
      pants,
    );
    leg.position.set(sx * 0.09, 0.02, 0.02);
    leg.castShadow = true;
    root.add(leg);
    const shoe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.06, 0.2), bagRef), vest);
    shoe.position.set(sx * 0.09, -0.28, 0.04);
    root.add(shoe);
  }

  // —— Baş + güler yüz ——
  const head = new THREE.Group();
  head.position.y = 1.7;
  root.add(head);

  const skull = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.2, 32, 24), bagRef), skin);
  skull.scale.set(0.9, 1.1, 0.92);
  skull.castShadow = true;
  head.add(skull);

  for (const sx of [-1, 1] as const) {
    const blush = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.05, 12, 10), bagRef), blushMat);
    blush.position.set(sx * 0.115, -0.015, 0.145);
    blush.scale.set(1.35, 0.75, 0.45);
    head.add(blush);
  }

  // Gözler (gülerken hafif kısık)
  for (const sx of [-1, 1] as const) {
    const white = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.04, 12, 10), bagRef), eyeWhite);
    white.position.set(sx * 0.068, 0.03, 0.168);
    white.scale.set(1.05, 0.85, 0.7);
    head.add(white);
    const iris = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.022, 12, 10), bagRef), eyeMat);
    iris.position.set(sx * 0.068, 0.028, 0.198);
    head.add(iris);
    const pupil = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.01, 8, 8), bagRef),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x0a0810 }), bagRef),
    );
    pupil.position.set(sx * 0.068, 0.028, 0.215);
    head.add(pupil);
    const lash = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.075, 0.01, 0.018), bagRef), lashMat);
    lash.position.set(sx * 0.068, 0.058, 0.185);
    lash.rotation.z = sx * -0.12;
    head.add(lash);
    // Kaş — yumuşak kavis
    const brow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.07, 0.012, 0.016), bagRef), browMat);
    brow.position.set(sx * 0.07, 0.078, 0.175);
    brow.rotation.z = sx * 0.18;
    head.add(brow);
  }

  // Ağız grubu: üst dudak + alt çene + diş (konuşurken hareket)
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.08, 0.17);
  head.add(mouth);

  const upperLip = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.055, 14, 10), bagRef),
    lipMat,
  );
  upperLip.scale.set(1.55, 0.38, 0.55);
  upperLip.position.set(0, 0.012, 0.01);
  mouth.add(upperLip);

  const jaw = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.058, 14, 10), bagRef), lipMat);
  jaw.scale.set(1.5, 0.4, 0.6);
  jaw.position.set(0, -0.02, 0.012);
  mouth.add(jaw);

  // Gülümseme köşeleri
  for (const sx of [-1, 1] as const) {
    const corner = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.022, 10, 8), bagRef), lipMat);
    corner.position.set(sx * 0.075, 0.0, 0.005);
    corner.scale.set(0.9, 0.7, 0.6);
    mouth.add(corner);
  }

  const teeth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.025, 0.03), bagRef), teethMat);
  teeth.position.set(0, -0.002, 0.02);
  teeth.visible = false;
  mouth.add(teeth);

  // Burun
  const nose = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.028, 10, 8), bagRef), skin);
  nose.scale.set(0.7, 1.1, 0.9);
  nose.position.set(0, -0.02, 0.2);
  head.add(nose);

  // Sarışın bob (klasik kurpiyer saçı)
  const hairCap = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.24, 28, 20), bagRef), hairMat);
  hairCap.position.y = 0.05;
  hairCap.scale.set(1.12, 1.12, 1.12);
  head.add(hairCap);
  const bang = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 16, 12), bagRef), hairHi);
  bang.position.set(0, 0.1, 0.17);
  bang.scale.set(1.7, 0.5, 0.45);
  head.add(bang);
  for (const [x, y, z, s, hi] of [
    [-0.2, -0.02, 0.08, 0.12, 1],
    [0.2, -0.02, 0.08, 0.12, 1],
    [-0.19, -0.18, 0.02, 0.13, 0],
    [0.19, -0.18, 0.02, 0.13, 0],
    [-0.17, -0.32, -0.02, 0.12, 1],
    [0.17, -0.32, -0.02, 0.12, 1],
    [0, -0.28, -0.14, 0.14, 0],
    [-0.22, -0.12, -0.08, 0.11, 1],
    [0.22, -0.12, -0.08, 0.11, 1],
  ] as const) {
    const lock = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(s, 14, 12), bagRef),
      hi ? hairHi : hairMat,
    );
    lock.position.set(x, y, z);
    head.add(lock);
  }

  // Gömlek kollu kollar
  const mkArm = (side: 1 | -1) => {
    const g = new THREE.Group();
    g.position.set(side * 0.28, 1.38, 0.02);
    const upper = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.05, 0.058, 0.36, 12), bagRef),
      shirt,
    );
    upper.position.y = -0.16;
    upper.castShadow = true;
    g.add(upper);
    // Kol ağzı / manşet
    const cuff = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.048, 0.05, 0.06, 12), bagRef), shirt);
    cuff.position.set(0, -0.36, 0.02);
    g.add(cuff);
    const fore = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.04, 0.045, 0.28, 12), bagRef),
      skin,
    );
    fore.position.set(0, -0.5, 0.05);
    fore.rotation.x = -0.35;
    fore.castShadow = true;
    g.add(fore);
    const hand = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.05, 10, 8), bagRef), skin);
    hand.position.set(0, -0.66, 0.1);
    g.add(hand);
    root.add(g);
    return g;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  armR.rotation.z = -0.28;
  armL.rotation.z = 0.28;

  let talking = false;
  let dealT = 0;
  let lookX = 0;
  let lookZ = -1;

  return {
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
    lookAtSeat(x, z) {
      lookX = x;
      lookZ = z;
    },
    update(t, dt) {
      const breath = Math.sin(t * 2.4) * 0.012;
      torso.position.y = 0.9 + breath;
      torso.rotation.y = Math.sin(t * 0.55) * 0.04;
      torso.rotation.z = Math.sin(t * 0.7) * 0.025;

      const targetYaw = Math.atan2(lookX - 0, lookZ - (-2.2)) * 0.4;
      head.rotation.y += (targetYaw - head.rotation.y) * Math.min(1, dt * 4);
      head.rotation.x = Math.sin(t * 1.3) * 0.03 + (talking ? Math.sin(t * 12) * 0.035 : 0);

      // Güler yüz idle + konuşurken ağız
      if (talking) {
        const open = 0.35 + Math.abs(Math.sin(t * 18)) * 1.15;
        const open2 = 0.25 + Math.abs(Math.sin(t * 22 + 0.7)) * 0.9;
        jaw.scale.set(1.5, 0.28 + open * 0.45, 0.6);
        jaw.position.y = -0.02 - open * 0.035;
        jaw.position.z = 0.012 + open * 0.01;
        upperLip.scale.set(1.55, 0.32 + open2 * 0.12, 0.55);
        upperLip.position.y = 0.012 + open * 0.008;
        teeth.visible = open > 0.7;
        teeth.scale.set(1, Math.min(1.4, open * 0.9), 1);
      } else {
        // Hafif gülümseme
        const smile = 0.5 + Math.sin(t * 1.5) * 0.08;
        jaw.scale.set(1.55, 0.36, 0.58);
        jaw.position.set(0, -0.018, 0.012);
        upperLip.scale.set(1.58, 0.36, 0.52);
        upperLip.position.set(0, 0.01 + smile * 0.004, 0.01);
        teeth.visible = false;
      }

      if (dealT > 0) {
        dealT = Math.max(0, dealT - dt * 1.8);
        const wave = Math.sin((1 - dealT) * Math.PI) * 1.1;
        armR.rotation.x = -0.25 - wave * 0.95;
        armR.rotation.z = -0.28 - wave * 0.4;
      } else {
        armR.rotation.x += (Math.sin(t * 1.1) * 0.08 - armR.rotation.x) * 0.08;
        armR.rotation.z += (-0.28 - armR.rotation.z) * 0.08;
      }
      armL.rotation.x = Math.sin(t * 1.1 + 1) * 0.06;
      armL.rotation.z = 0.28 + Math.sin(t * 0.9) * 0.03;
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
