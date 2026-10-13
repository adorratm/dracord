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
  /** Dünya noktasına göre gıdık / göğüs */
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

function rotateBoneLocal(
  THREE: Three,
  bone: Object3D,
  base: Quaternion,
  x: number,
  y: number,
  z: number,
) {
  const euler = new THREE.Euler(x, y, z, 'XYZ');
  const q = new THREE.Quaternion().setFromEuler(euler);
  bone.quaternion.copy(base).multiply(q);
}

function setExpr(vrm: VRM, name: string, value: number) {
  vrm.expressionManager?.setValue(name, Math.min(1, Math.max(0, value)));
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
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      root.add(scene);
      root.scale.setScalar(DEALER_VRM_SCALE);
      root.rotation.y = 0;
      let talking = false;
      let dealT = 0;
      let lookX = 0;
      let lookZ = 1;
      let tickle = 0;
      let chestPlay = 0;
      const head = proxyGroup(THREE, 'head');
      const torso = proxyGroup(THREE, 'torso');
      const armR = proxyGroup(THREE, 'armR');
      const armL = proxyGroup(THREE, 'armL');
      const jaw = hiddenJaw(THREE);
      const tmp = new THREE.Vector3();
      return {
        kind: 'vrm',
        root,
        head,
        torso,
        armR,
        armL,
        jaw,
        setTalking(v) {
          talking = v;
        },
        setDealPulse() {
          dealT = 0.65;
        },
        poke(kind, strength = 1) {
          const s = Math.min(1.4, Math.max(0.35, strength));
          if (kind === 'chest') chestPlay = Math.min(1.25, chestPlay + 0.8 * s);
          else tickle = Math.min(1.25, tickle + 0.9 * s);
        },
        classifyHit(worldPoint) {
          root.getWorldPosition(tmp);
          // Yaklaşık göğüs bandı (dünya Y)
          const localY = worldPoint.y - tmp.y;
          return localY > 0.55 && localY < 1.85 ? 'chest' : 'tickle';
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
          tickle = Math.max(0, tickle - dt * 1.3);
          chestPlay = Math.max(0, chestPlay - dt * 0.9);
          const yaw = Math.atan2(lookX, Math.max(0.4, lookZ)) * 0.2;
          root.rotation.y = yaw;
          scene.rotation.z =
            Math.sin(t * 2.4) * 0.03 +
            Math.sin(t * 18) * 0.07 * tickle +
            Math.sin(t * 10) * 0.06 * chestPlay;
          scene.rotation.x =
            Math.sin(t * 1.7) * 0.02 +
            Math.sin(t * 22) * 0.05 * tickle +
            Math.sin(t * 14) * 0.08 * chestPlay;
          if (dealT > 0) dealT = Math.max(0, dealT - dt);
          void talking;
        },
        dispose() {
          root.remove(scene);
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

    vrm.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });

    root.scale.setScalar(DEALER_VRM_SCALE);
    root.rotation.y = 0;

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

    // T-pose → kollar yanda (idle A-pose). VRM normalized: Z ekseni
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
    let chestSide = 0; // -1 sol / +1 sağ

    const chestWorld = new THREE.Vector3();
    const headWorld = new THREE.Vector3();

    return {
      kind: 'vrm',
      root,
      head,
      torso,
      armR,
      armL,
      jaw,
      setTalking(v) {
        talking = v;
      },
      setDealPulse() {
        dealT = 0.7;
      },
      poke(kind, strength = 1) {
        const s = Math.min(1.5, Math.max(0.3, strength));
        if (kind === 'chest') {
          chestPlay = Math.min(1.35, chestPlay + 0.85 * s);
        } else {
          tickle = Math.min(1.35, tickle + 0.95 * s);
        }
      },
      classifyHit(worldPoint) {
        const anchor = upperChestBone || chestBone;
        if (anchor) {
          anchor.getWorldPosition(chestWorld);
          const dy = worldPoint.y - chestWorld.y;
          const dx = worldPoint.x - chestWorld.x;
          const dz = worldPoint.z - chestWorld.z;
          const distXZ = Math.hypot(dx, dz);
          // Göğüs bölgesi: göğüs kemiği civarı
          if (dy > -0.55 && dy < 0.4 && distXZ < 0.7) {
            chestSide = Math.max(-1, Math.min(1, dx * 2.2));
            return 'chest';
          }
        }
        if (headBone) {
          headBone.getWorldPosition(headWorld);
          // Baş / omuz → gıdık
          if (worldPoint.y > headWorld.y - 0.35) return 'tickle';
        }
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
        tickle = Math.max(0, tickle - h * 1.25);
        chestPlay = Math.max(0, chestPlay - h * 0.85);
        chestSide *= Math.max(0, 1 - h * 2.5);

        const breath = Math.sin(elapsed * 2.35);
        const sway = Math.sin(elapsed * 1.1);
        const bounce = Math.sin(elapsed * 3.6);
        const tk = tickle;
        const cp = chestPlay;
        // Gıdıklanınca hızlı titreme
        const jiggle = Math.sin(elapsed * 26) * tk;
        const jiggle2 = Math.sin(elapsed * 33) * tk;
        // Göğüs oynatma — güçlü salınım
        const boob = Math.sin(elapsed * 11) * cp;
        const boob2 = Math.sin(elapsed * 15.5) * cp;

        if (hipsBone) {
          rotateBoneLocal(
            THREE,
            hipsBone,
            hipsBase,
            breath * 0.01 + jiggle * 0.03,
            sway * 0.02 + jiggle2 * 0.05,
            jiggle * 0.04,
          );
        }
        if (spineBone) {
          rotateBoneLocal(
            THREE,
            spineBone,
            spineBase,
            breath * 0.02 + jiggle * 0.06,
            sway * 0.025 + jiggle2 * 0.08,
            Math.sin(elapsed * 0.9) * 0.015 + jiggle * 0.07,
          );
        }

        // Göğüs / üst göğüs — idle + dokunma
        if (chestBone) {
          rotateBoneLocal(
            THREE,
            chestBone,
            chestBase,
            breath * 0.045 + bounce * 0.035 + boob * 0.14 + jiggle * 0.04,
            sway * 0.04 + chestSide * 0.08 * cp + jiggle2 * 0.05,
            bounce * 0.05 + boob2 * 0.18,
          );
        }
        if (upperChestBone) {
          rotateBoneLocal(
            THREE,
            upperChestBone,
            upperChestBase,
            breath * 0.055 + bounce * 0.05 + boob * 0.2 + jiggle * 0.03,
            sway * 0.035 + chestSide * 0.12 * cp,
            -bounce * 0.045 - boob2 * 0.22,
          );
        }

        const yaw = Math.min(
          0.42,
          Math.max(-0.42, Math.atan2(lookX, Math.max(0.4, lookZ)) * 0.4),
        );
        if (neckBone) {
          rotateBoneLocal(
            THREE,
            neckBone,
            neckBase,
            targetPitch * 0.4 + jiggle * 0.05,
            yaw * 0.35 + jiggle2 * 0.1,
            0,
          );
        }
        if (headBone) {
          rotateBoneLocal(
            THREE,
            headBone,
            headBase,
            targetPitch + Math.sin(elapsed) * 0.012 + jiggle * 0.08,
            yaw * 0.65 + jiggle2 * 0.14,
            jiggle * 0.06,
          );
        }

        const blinkPhase = elapsed % 4.1;
        const blink =
          blinkPhase > 3.85 ? Math.sin(((blinkPhase - 3.85) / 0.25) * Math.PI) : 0;
        setExpr(vrm, 'blink', Math.max(0, blink, tk * 0.35));

        const mouth = talking
          ? 0.25 + Math.abs(Math.sin(elapsed * 13)) * 0.55
          : tk * (0.2 + Math.abs(Math.sin(elapsed * 18)) * 0.45);
        setExpr(vrm, 'aa', mouth);
        setExpr(vrm, 'oh', talking ? mouth * 0.4 : cp * 0.35 + tk * 0.2);
        setExpr(vrm, 'happy', talking ? 0.15 : 0.08 + tk * 0.55 + cp * 0.25);
        setExpr(vrm, 'surprised', Math.min(1, cp * 0.4 + tk * 0.25));

        let deal = 0;
        if (dealT > 0) {
          dealT = Math.max(0, dealT - h);
          deal = Math.sin((1 - dealT / 0.7) * Math.PI);
        }

        if (leftArmBone) {
          rotateBoneLocal(
            THREE,
            leftArmBone,
            leftBase,
            IDLE_ARM_X + Math.sin(elapsed * 0.9) * 0.03 - jiggle * 0.35,
            jiggle2 * 0.2,
            IDLE_ARM_Z + Math.sin(elapsed * 1.1) * 0.04 + jiggle * 0.15,
          );
        }
        if (rightArmBone) {
          rotateBoneLocal(
            THREE,
            rightArmBone,
            rightBase,
            IDLE_ARM_X - deal * 0.85 + Math.sin(elapsed * 0.85) * 0.03 - jiggle * 0.3,
            deal * 0.25 - jiggle2 * 0.15,
            -IDLE_ARM_Z - deal * 0.15 - jiggle * 0.12,
          );
        }
        if (leftLowerArm) {
          rotateBoneLocal(
            THREE,
            leftLowerArm,
            leftLowerBase,
            IDLE_LOWER + jiggle * 0.4,
            0,
            0,
          );
        }
        if (rightLowerArm) {
          rotateBoneLocal(
            THREE,
            rightLowerArm,
            rightLowerBase,
            IDLE_LOWER + deal * 0.5 + jiggle * 0.35,
            0,
            0,
          );
        }

        vrm.update(h);
      },
      dispose() {
        if (disposed) return;
        disposed = true;
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
