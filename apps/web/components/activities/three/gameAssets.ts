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

export function createAssetBag(): AssetBag {
  return bag();
}

export function disposeObjectExtras(root: Object3D, assets: AssetBag) {
  assets.dispose();
  void root;
}

export type { MeshPhysicalMaterial };
