/**
 * VRM / GLB anime kurpiyer — DealerRig API uyumlu.
 * Model: public/models/dealer/anime-dealer.vrm
 */

import type { Group, Mesh, Object3D, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import type { AssetBag, DealerInteractKind, DealerRig } from '../gameAssets';

type Three = typeof import('three');

export const DEALER_VRM_URL = '/models/dealer/anime-dealer.vrm';
export const DEALER_GLB_URL = '/models/dealer/anime-dealer.glb';

/** Masa kenarında belden yukarı — ölçek / gömme (z: masa içine girmesin) */
export const DEALER_VRM_SCALE = 2.55;
export const DEALER_VRM_POS = { x: 0, y: -1.35, z: -3.05 };

export type VrmDealerRig = DealerRig & {
  kind: 'vrm';
  dispose: () => void;
  classifyHit?: (worldPoint: Vector3) => DealerInteractKind;
};

function proxyGroup(THREE: Three, name: string): Group {
  const g = new THREE.Group();
  g.name = name;
  return g;
}

function hiddenJaw(THREE: Three): Mesh {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.001, 4, 4),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  m.visible = false;
  m.name = 'jaw-proxy';
  return m;
}

/** Raycast için ucuz görünmez kutular — tam VRM mesh değil */
function makeHitTargets(THREE: Three, root: Group): Mesh[] {
  const mat = new THREE.MeshBasicMaterial({
    visible: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const mk = (
    name: string,
    kind: DealerInteractKind,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.name = name;
    m.userData.dealerHit = kind;
    m.position.set(x, y, z);
    m.frustumCulled = false;
    root.add(m);
    return m;
  };
  // Model yerel birimleri (root scale sonrası dünya boyutu ~×2.55)
  return [
    mk('dealer-hit-chest', 'chest', 0.45, 0.32, 0.32, 0, 1.22, 0.14),
    mk('dealer-hit-body', 'tickle', 0.58, 1.05, 0.4, 0, 1.05, 0.02),
  ];
}

/** Paylaşılan temp — her karede new Euler/Quaternion yok */
function createBoneRotator(THREE: Three) {
  const euler = new THREE.Euler(0, 0, 0, 'XYZ');
  const q = new THREE.Quaternion();
  return (
    bone: Object3D,
    base: Quaternion,
    x: number,
    y: number,
    z: number,
  ) => {
    euler.set(x, y, z, 'XYZ');
    q.setFromEuler(euler);
    bone.quaternion.copy(base).multiply(q);
  };
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (res.ok) return true;
    if (res.status === 405 || res.status === 501) {
      const g = await fetch(url, { method: 'GET', cache: 'no-store' });
      return g.ok;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * VRM anime dealer. Dosya yoksa null → prosedürel fallback.
 */
export async function createDealerWomanFromVrm(
  THREE: Three,
  _bag?: AssetBag,
  modelUrl: string = DEALER_VRM_URL,
): Promise<VrmDealerRig | null> {
  const candidates = [modelUrl, DEALER_GLB_URL].filter(
    (u, i, a) => a.indexOf(u) === i,
  );
  let url: string | null = null;
  for (const c of candidates) {
    if (await urlExists(c)) {
      url = c;
      break;
    }
  }
  if (!url) return null;

  try {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(url);
    const vrm = gltf.userData.vrm as VRM | undefined;

    // Saf GLB (VRM humanoid yok)
    if (!vrm) {
      const root = new THREE.Group();
      root.name = 'dealer-glb';
      const scene = gltf.scene;
      scene.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) {
          m.castShadow = false;
          m.receiveShadow = false;
          m.frustumCulled = true;
        }
      });
      root.add(scene);
      root.scale.setScalar(DEALER_VRM_SCALE);
      root.rotation.y = 0;
      const hitTargets = makeHitTargets(THREE, root);
      let talking = false;
      let dealT = 0;
      let lookX = 0;
      let lookZ = 1;
      let tickle = 0;
      let chestPlay = 0;
      let hold: DealerInteractKind | null = null;
      const head = proxyGroup(THREE, 'head');
      const torso = proxyGroup(THREE, 'torso');
      const armR = proxyGroup(THREE, 'armR');
      const armL = proxyGroup(THREE, 'armL');
      const jaw = hiddenJaw(THREE);
      return {
        kind: 'vrm',
        root,
        head,
        torso,
        armR,
        armL,
        jaw,
        hitTargets,
        setTalking(v) {
          talking = v;
        },
        setDealPulse() {
          dealT = 0.65;
        },
        poke(kind, strength = 1) {
          const s = Math.min(1.2, Math.max(0.35, strength));
          if (kind === 'chest') chestPlay = Math.min(1.1, Math.max(chestPlay, 0.7 * s));
          else tickle = Math.min(1.1, Math.max(tickle, 0.75 * s));
        },
        setInteractHold(kind) {
          hold = kind;
        },
        classifyHit(worldPoint) {
          // Hit box userData üzerinden Blackjack tarafı tercih edilir
          void worldPoint;
          return 'tickle';
        },
        lookAtSeat(x, z) {
          lookX = x;
          lookZ = z;
        },
        faceCamera(camX, _camY, camZ) {
          lookX = camX;
          lookZ = camZ + 2.5;
        },
        update(t, dt) {
          if (hold === 'tickle') tickle = Math.max(tickle, 0.7);
          else if (hold === 'chest') chestPlay = Math.max(chestPlay, 0.8);
          tickle = Math.max(0, tickle - dt * 1.6);
          chestPlay = Math.max(0, chestPlay - dt * 1.2);
          const yaw = Math.atan2(lookX, Math.max(0.4, lookZ)) * 0.2;
          root.rotation.y = yaw;
          scene.rotation.z =
            Math.sin(t * 2.4) * 0.03 +
            Math.sin(t * 12) * 0.06 * tickle +
            Math.sin(t * 8) * 0.05 * chestPlay;
          scene.rotation.x =
            Math.sin(t * 1.7) * 0.02 +
            Math.sin(t * 14) * 0.04 * tickle +
            Math.sin(t * 10) * 0.07 * chestPlay;
          if (dealT > 0) dealT = Math.max(0, dealT - dt);
          void talking;
        },
        dispose() {
          root.remove(scene);
          for (const h of hitTargets) {
            root.remove(h);
            h.geometry.dispose();
          }
          scene.traverse((o) => {
            const m = o as Mesh;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material;
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
            else if (mat) mat.dispose();
          });
        },
      };
    }

    VRMUtils.rotateVRM0(vrm);

    const root = new THREE.Group();
    root.name = 'dealer-vrm';
    root.add(vrm.scene);

    // Gölge + skinned mesh = tıklanınca FPS düşüşü; kapat
    vrm.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = false;
        m.receiveShadow = false;
        m.frustumCulled = true;
      }
    });

    root.scale.setScalar(DEALER_VRM_SCALE);
    root.rotation.y = 0;
    const hitTargets = makeHitTargets(THREE, root);

    const humanoid = vrm.humanoid;
    const bone = (name: Parameters<typeof humanoid.getNormalizedBoneNode>[0]) =>
      humanoid.getNormalizedBoneNode(name);

    const headBone = bone('head');
    const neckBone = bone('neck');
    const spineBone = bone('spine');
    const chestBone = bone('chest');
    const upperChestBone = bone('upperChest');
    const hipsBone = bone('hips');
    const rightArmBone = bone('rightUpperArm');
    const leftArmBone = bone('leftUpperArm');
    const rightLowerArm = bone('rightLowerArm');
    const leftLowerArm = bone('leftLowerArm');

    if (!headBone || !rightArmBone || !leftArmBone) {
      console.warn('[dealer] VRM humanoid kollar/baş eksik');
    }

    const cloneQ = (b: Object3D | null) =>
      b?.quaternion.clone() ?? new THREE.Quaternion();

    const headBase = cloneQ(headBone);
    const neckBase = cloneQ(neckBone);
    const spineBase = cloneQ(spineBone);
    const chestBase = cloneQ(chestBone);
    const upperChestBase = cloneQ(upperChestBone);
    const hipsBase = cloneQ(hipsBone);
    const rightBase = cloneQ(rightArmBone);
    const leftBase = cloneQ(leftArmBone);
    const rightLowerBase = cloneQ(rightLowerArm);
    const leftLowerBase = cloneQ(leftLowerArm);

    const rotateBone = createBoneRotator(THREE);

    const IDLE_ARM_Z = 1.22;
    const IDLE_ARM_X = 0.08;
    const IDLE_LOWER = 0.35;

    const head = proxyGroup(THREE, 'head');
    const torso = proxyGroup(THREE, 'torso');
    const armR = proxyGroup(THREE, 'armR');
    const armL = proxyGroup(THREE, 'armL');
    const jaw = hiddenJaw(THREE);

    let talking = false;
    let dealT = 0;
    let elapsed = 0;
    let lookX = 0;
    let lookZ = 1;
    let targetPitch = -0.06;
    let disposed = false;
    let tickle = 0;
    let chestPlay = 0;
    let chestSide = 0;
    let hold: DealerInteractKind | null = null;
    let springAcc = 0;
    let exprFrame = 0;

    const exprCache: Record<string, number> = {};
    const setExprCached = (name: string, value: number) => {
      const v = Math.round(Math.min(1, Math.max(0, value)) * 32) / 32;
      if (exprCache[name] === v) return;
      exprCache[name] = v;
      vrm.expressionManager?.setValue(name, v);
    };

    return {
      kind: 'vrm',
      root,
      head,
      torso,
      armR,
      armL,
      jaw,
      hitTargets,
      setTalking(v) {
        talking = v;
      },
      setDealPulse() {
        dealT = 0.7;
      },
      poke(kind, strength = 1) {
        const s = Math.min(1.2, Math.max(0.35, strength));
        if (kind === 'chest') {
          chestPlay = Math.min(1.15, Math.max(chestPlay, 0.85 * s));
        } else {
          tickle = Math.min(1.15, Math.max(tickle, 0.9 * s));
        }
      },
      setInteractHold(kind) {
        hold = kind;
      },
      classifyHit(worldPoint) {
        void worldPoint;
        return 'tickle';
      },
      lookAtSeat(x, z) {
        lookX = x;
        lookZ = z + 2.5;
      },
      faceCamera(camX, camY, camZ) {
        lookX = camX;
        lookZ = camZ + 2.5;
        targetPitch = Math.min(0.1, Math.max(-0.15, (camY - 1.2) * 0.035));
      },
      update(_t, dt) {
        if (disposed) return;
        const h = Math.min(0.05, Math.max(0, dt));
        elapsed += h;

        if (hold === 'tickle') tickle = Math.max(tickle, 0.72);
        else if (hold === 'chest') chestPlay = Math.max(chestPlay, 0.82);

        tickle = Math.max(0, tickle - h * 1.55);
        chestPlay = Math.max(0, chestPlay - h * 1.15);
        chestSide *= Math.max(0, 1 - h * 3);

        const breath = Math.sin(elapsed * 2.35);
        const sway = Math.sin(elapsed * 1.1);
        const bounce = Math.sin(elapsed * 3.2);
        const tk = tickle;
        const cp = chestPlay;
        // Daha düşük frekans → daha az skinning maliyeti
        const jiggle = Math.sin(elapsed * 14) * tk;
        const jiggle2 = Math.sin(elapsed * 18) * tk;
        const boob = Math.sin(elapsed * 8) * cp;
        const boob2 = Math.sin(elapsed * 11) * cp;

        if (hipsBone) {
          rotateBone(
            hipsBone,
            hipsBase,
            breath * 0.01 + jiggle * 0.025,
            sway * 0.02 + jiggle2 * 0.04,
            jiggle * 0.03,
          );
        }
        if (spineBone) {
          rotateBone(
            spineBone,
            spineBase,
            breath * 0.02 + jiggle * 0.05,
            sway * 0.025 + jiggle2 * 0.06,
            Math.sin(elapsed * 0.9) * 0.015 + jiggle * 0.05,
          );
        }

        if (chestBone) {
          rotateBone(
            chestBone,
            chestBase,
            breath * 0.04 + bounce * 0.03 + boob * 0.12 + jiggle * 0.03,
            sway * 0.035 + chestSide * 0.07 * cp + jiggle2 * 0.04,
            bounce * 0.04 + boob2 * 0.15,
          );
        }
        if (upperChestBone) {
          rotateBone(
            upperChestBone,
            upperChestBase,
            breath * 0.05 + bounce * 0.04 + boob * 0.16 + jiggle * 0.025,
            sway * 0.03 + chestSide * 0.1 * cp,
            -bounce * 0.04 - boob2 * 0.18,
          );
        }

        const yaw = Math.min(
          0.42,
          Math.max(-0.42, Math.atan2(lookX, Math.max(0.4, lookZ)) * 0.4),
        );
        if (neckBone) {
          rotateBone(
            neckBone,
            neckBase,
            targetPitch * 0.4 + jiggle * 0.04,
            yaw * 0.35 + jiggle2 * 0.08,
            0,
          );
        }
        if (headBone) {
          rotateBone(
            headBone,
            headBase,
            targetPitch + Math.sin(elapsed) * 0.012 + jiggle * 0.06,
            yaw * 0.65 + jiggle2 * 0.1,
            jiggle * 0.05,
          );
        }

        // İfade: 2 karede bir (morph target pahalı)
        exprFrame++;
        if (exprFrame % 2 === 0 || tk > 0.05 || cp > 0.05 || talking) {
          const blinkPhase = elapsed % 4.1;
          const blink =
            blinkPhase > 3.85
              ? Math.sin(((blinkPhase - 3.85) / 0.25) * Math.PI)
              : 0;
          setExprCached('blink', Math.max(0, blink, tk * 0.3));
          const mouth = talking
            ? 0.25 + Math.abs(Math.sin(elapsed * 13)) * 0.55
            : tk * (0.18 + Math.abs(Math.sin(elapsed * 14)) * 0.35);
          setExprCached('aa', mouth);
          setExprCached('oh', talking ? mouth * 0.4 : cp * 0.3 + tk * 0.15);
          setExprCached('happy', talking ? 0.15 : 0.08 + tk * 0.45 + cp * 0.2);
          setExprCached('surprised', Math.min(1, cp * 0.35 + tk * 0.2));
        }

        let deal = 0;
        if (dealT > 0) {
          dealT = Math.max(0, dealT - h);
          deal = Math.sin((1 - dealT / 0.7) * Math.PI);
        }

        if (leftArmBone) {
          rotateBone(
            leftArmBone,
            leftBase,
            IDLE_ARM_X + Math.sin(elapsed * 0.9) * 0.03 - jiggle * 0.28,
            jiggle2 * 0.15,
            IDLE_ARM_Z + Math.sin(elapsed * 1.1) * 0.04 + jiggle * 0.12,
          );
        }
        if (rightArmBone) {
          rotateBone(
            rightArmBone,
            rightBase,
            IDLE_ARM_X - deal * 0.85 + Math.sin(elapsed * 0.85) * 0.03 - jiggle * 0.25,
            deal * 0.25 - jiggle2 * 0.12,
            -IDLE_ARM_Z - deal * 0.15 - jiggle * 0.1,
          );
        }
        if (leftLowerArm) {
          rotateBone(leftLowerArm, leftLowerBase, IDLE_LOWER + jiggle * 0.3, 0, 0);
        }
        if (rightLowerArm) {
          rotateBone(
            rightLowerArm,
            rightLowerBase,
            IDLE_LOWER + deal * 0.5 + jiggle * 0.28,
            0,
            0,
          );
        }

        // Spring bone: idle’da ~30fps, etkileşimde tam
        springAcc += h;
        const active = tk > 0.04 || cp > 0.04 || talking || dealT > 0;
        if (active || springAcc >= 1 / 30) {
          vrm.update(springAcc);
          springAcc = 0;
        }
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const h of hitTargets) {
          root.remove(h);
          h.geometry.dispose();
        }
        root.remove(vrm.scene);
        VRMUtils.deepDispose(vrm.scene);
        jaw.geometry.dispose();
        (jaw.material as { dispose: () => void }).dispose();
      },
    };
  } catch (err) {
    console.warn('[dealer] VRM yüklenemedi, prosedürel kurpiyer kullanılacak', err);
    return null;
  }
}
