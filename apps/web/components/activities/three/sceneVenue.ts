import type { Material, Object3D, Scene, Texture } from 'three';

export type VenueTheme = 'billiards' | 'bowling' | 'tavla' | 'okey';

type Three = typeof import('three');

/**
 * Oyun masasının etrafına mekan / atmosfer ekler.
 * Dönen dispose ile texture/materyal temizlenir.
 */
export function addGameVenue(
  THREE: Three,
  scene: Scene,
  parent: Object3D,
  theme: VenueTheme,
): () => void {
  const disposables: Array<Material | Texture | { dispose: () => void }> = [];
  const track = <T extends Material | Texture | { dispose: () => void }>(x: T) => {
    disposables.push(x);
    return x;
  };

  scene.background = new THREE.Color(
    theme === 'bowling' ? 0x0a0c14 : theme === 'tavla' ? 0x1a1228 : 0x0d0f18,
  );
  scene.fog = new THREE.FogExp2(
    theme === 'bowling' ? 0x0a0c14 : theme === 'tavla' ? 0x1a1228 : 0x0d0f18,
    theme === 'bowling' ? 0.018 : 0.022,
  );

  // Zemin
  const floorMat = track(
    new THREE.MeshStandardMaterial({
      color: theme === 'billiards' ? 0x1a1210 : theme === 'bowling' ? 0x151820 : 0x16121f,
      roughness: 0.92,
      metalness: 0.05,
    }),
  );
  const floor = new THREE.Mesh(new THREE.CircleGeometry(28, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.85;
  floor.receiveShadow = true;
  parent.add(floor);

  // Duvar halkası (stilize mekan)
  const wallMat = track(
    new THREE.MeshStandardMaterial({
      color: theme === 'okey' ? 0x2a1f3d : 0x1c1a28,
      roughness: 0.88,
      metalness: 0.08,
      side: THREE.BackSide,
    }),
  );
  const walls = new THREE.Mesh(new THREE.CylinderGeometry(22, 24, 10, 32, 1, true), wallMat);
  walls.position.y = 3.2;
  parent.add(walls);

  // Tavan halkası
  const ceilMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x12141c,
      roughness: 1,
      side: THREE.BackSide,
    }),
  );
  const ceil = new THREE.Mesh(new THREE.CircleGeometry(23, 32), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 7.5;
  parent.add(ceil);

  // Neon şerit
  const neonColor =
    theme === 'bowling' ? 0x8be9fd : theme === 'tavla' ? 0xffb86c : 0xbd93f9;
  const neonMat = track(new THREE.MeshBasicMaterial({ color: neonColor }));
  const neonRing = new THREE.Mesh(new THREE.TorusGeometry(14, 0.06, 8, 64), neonMat);
  neonRing.rotation.x = Math.PI / 2;
  neonRing.position.y = 5.8;
  parent.add(neonRing);

  // Asılı ışıklar
  const lampGeo = new THREE.CylinderGeometry(0.55, 0.85, 0.35, 16);
  const lampMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x2a2038,
      emissive: neonColor,
      emissiveIntensity: 0.35,
      roughness: 0.5,
    }),
  );
  const lampPositions: [number, number][] =
    theme === 'bowling'
      ? [
          [0, 2],
          [0, -6],
          [0, 8],
        ]
      : [
          [-4, -3],
          [4, -3],
          [0, 3],
          [-5, 2],
          [5, 2],
        ];
  for (const [x, z] of lampPositions) {
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(x, 5.4, z);
    parent.add(lamp);
    const bulb = new THREE.PointLight(neonColor, 0.55, 16, 2);
    bulb.position.set(x, 4.9, z);
    parent.add(bulb);
  }

  // Mekan mobilyası / dekor
  if (theme === 'billiards') {
    const railMat = track(
      new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.7 }),
    );
    for (const sx of [-1, 1]) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 3.2), railMat);
      rack.position.set(sx * 9.5, 0.4, -1);
      parent.add(rack);
      for (let i = 0; i < 4; i++) {
        const cue = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.03, 2.6, 8),
          track(new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.45 })),
        );
        cue.rotation.z = sx * 0.08;
        cue.position.set(sx * 9.5, 1.1, -2.2 + i * 0.7);
        parent.add(cue);
      }
    }
    const stoolMat = track(
      new THREE.MeshStandardMaterial({ color: 0x2c1f18, roughness: 0.65 }),
    );
    for (const [x, z] of [
      [-7, 4],
      [7, 4],
      [-7, -4],
      [7, -4],
    ] as const) {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 16), stoolMat);
      seat.position.set(x, 0.55, z);
      parent.add(seat);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.55, 8), stoolMat);
      leg.position.set(x, 0.22, z);
      parent.add(leg);
    }
  } else if (theme === 'bowling') {
    const wallBack = new THREE.Mesh(
      new THREE.BoxGeometry(14, 5, 0.4),
      track(new THREE.MeshStandardMaterial({ color: 0x1a1d2e, roughness: 0.8 })),
    );
    wallBack.position.set(0, 2.2, -14);
    parent.add(wallBack);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.25, 0.12),
      track(new THREE.MeshBasicMaterial({ color: 0xff79c6 })),
    );
    stripe.position.set(0, 3.8, -13.7);
    parent.add(stripe);
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const lane = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.08, 18),
        track(new THREE.MeshStandardMaterial({ color: 0xb8895a, roughness: 0.4 })),
      );
      lane.position.set(i * 3.4, -0.72, -2);
      parent.add(lane);
    }
  } else if (theme === 'tavla') {
    const cushionMat = track(
      new THREE.MeshStandardMaterial({ color: 0x4a2f6e, roughness: 0.85 }),
    );
    for (const [x, z, w, d] of [
      [0, 8.5, 10, 2.2],
      [0, -8.5, 10, 2.2],
      [9.5, 0, 2.2, 8],
      [-9.5, 0, 2.2, 8],
    ] as const) {
      const sofa = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), cushionMat);
      sofa.position.set(x, -0.2, z);
      parent.add(sofa);
    }
    const tableMat = track(
      new THREE.MeshStandardMaterial({ color: 0x3b2a1a, roughness: 0.55 }),
    );
    for (const [x, z] of [
      [-8, 5],
      [8, 5],
      [-8, -5],
      [8, -5],
    ] as const) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.5, 16), tableMat);
      t.position.set(x, -0.35, z);
      parent.add(t);
    }
  } else {
    // okey — lounge rafları / vitrin
    const shelfMat = track(
      new THREE.MeshStandardMaterial({ color: 0x352448, roughness: 0.7 }),
    );
    for (const sx of [-1, 1]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.5, 4.5), shelfMat);
      shelf.position.set(sx * 11, 1.2, 0);
      parent.add(shelf);
      for (let r = 0; r < 3; r++) {
        const board = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.9, 0.9),
          track(new THREE.MeshStandardMaterial({ color: 0xd4c4a8, roughness: 0.5 })),
        );
        board.position.set(sx * 10.3, 0.3 + r * 1.05, -1.2 + r * 0.3);
        parent.add(board);
      }
    }
    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(7.5, 40),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x3a2458,
          roughness: 1,
        }),
      ),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = -0.82;
    parent.add(rug);
  }

  // Zemin ızgara / desen
  const grid = track(
    new THREE.GridHelper(40, 40, neonColor, theme === 'tavla' ? 0x2a2038 : 0x1a1c28),
  );
  grid.position.y = -0.84;
  parent.add(grid);

  return () => {
    scene.fog = null;
    for (const d of disposables) d.dispose();
  };
}
