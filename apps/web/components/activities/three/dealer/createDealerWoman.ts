/**
 * VRM / GLB anime kurpiyer — DealerRig API uyumlu.
 * Model: public/models/dealer/anime-dealer.vrm
 */

import type { Group, Mesh, Object3D, Quaternion } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import type { AssetBag, DealerRig } from '../gameAssets';

type Three = typeof import('three');

export const DEALER_VRM_URL = '/models/dealer/anime-dealer.vrm';
export const DEALER_GLB_URL = '/models/dealer/anime-dealer.glb';

/** Masa kenarında belden yukarı — ölçek / gömme */
export const DEALER_VRM_SCALE = 2.55;
export const DEALER_VRM_POS = { x: 0, y: -1.35, z: -2.48 };

export type VrmDealerRig = DealerRig & {
  kind: 'vrm';
  dispose: () => void;
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
      // Oyuncuya bak (+Z) — VRM/GLB varsayılanı bu yönde
      root.rotation.y = 0;
      let talking = false;
      let dealT = 0;
      let lookX = 0;
      let lookZ = 1;
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
        setTalking(v) {
          talking = v;
        },
        setDealPulse() {
          dealT = 0.65;
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
          const yaw = Math.atan2(lookX, Math.max(0.4, lookZ)) * 0.2;
          root.rotation.y = yaw;
          // Hafif gövde sallanması (göğüs illüzyonu)
          scene.rotation.z = Math.sin(t * 2.4) * 0.03;
          scene.rotation.x = Math.sin(t * 1.7) * 0.02;
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
    // Oyuncuya bak (+Z) — önceki Math.PI yüzü arkaya çeviriyordu
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

        const breath = Math.sin(elapsed * 2.35);
        const sway = Math.sin(elapsed * 1.1);
        const bounce = Math.sin(elapsed * 3.6);

        // Kalça / bel — hafif nefes
        if (hipsBone) {
          rotateBoneLocal(THREE, hipsBone, hipsBase, breath * 0.01, sway * 0.02, 0);
        }
        if (spineBone) {
          rotateBoneLocal(
            THREE,
            spineBone,
            spineBase,
            breath * 0.02,
            sway * 0.025,
            Math.sin(elapsed * 0.9) * 0.015,
          );
        }

        // Göğüs / üst göğüs — belirgin sallanma + nefes
        if (chestBone) {
          rotateBoneLocal(
            THREE,
            chestBone,
            chestBase,
            breath * 0.045 + bounce * 0.035,
            sway * 0.04,
            bounce * 0.05,
          );
        }
        if (upperChestBone) {
          rotateBoneLocal(
            THREE,
            upperChestBone,
            upperChestBase,
            breath * 0.055 + bounce * 0.05,
            sway * 0.035,
            -bounce * 0.045,
          );
        }

        const yaw = Math.min(
          0.42,
          Math.max(-0.42, Math.atan2(lookX, Math.max(0.4, lookZ)) * 0.4),
        );
        if (neckBone) {
          rotateBoneLocal(THREE, neckBone, neckBase, targetPitch * 0.4, yaw * 0.35, 0);
        }
        if (headBone) {
          rotateBoneLocal(
            THREE,
            headBone,
            headBase,
            targetPitch + Math.sin(elapsed) * 0.012,
            yaw * 0.65,
            0,
          );
        }

        // Göz kırpma
        const blinkPhase = elapsed % 4.1;
        const blink =
          blinkPhase > 3.85 ? Math.sin(((blinkPhase - 3.85) / 0.25) * Math.PI) : 0;
        setExpr(vrm, 'blink', Math.max(0, blink));

        const mouth = talking ? 0.25 + Math.abs(Math.sin(elapsed * 13)) * 0.55 : 0;
        setExpr(vrm, 'aa', mouth);
        setExpr(vrm, 'oh', talking ? mouth * 0.4 : 0);
        setExpr(vrm, 'happy', talking ? 0.15 : 0.08);

        // Kart dağıtma dalgası
        let deal = 0;
        if (dealT > 0) {
          dealT = Math.max(0, dealT - h);
          deal = Math.sin((1 - dealT / 0.7) * Math.PI);
        }

        // Idle: kollar yanda (T-pose değil). Deal: sağ kol öne
        if (leftArmBone) {
          rotateBoneLocal(
            THREE,
            leftArmBone,
            leftBase,
            IDLE_ARM_X + Math.sin(elapsed * 0.9) * 0.03,
            0,
            IDLE_ARM_Z + Math.sin(elapsed * 1.1) * 0.04,
          );
        }
        if (rightArmBone) {
          rotateBoneLocal(
            THREE,
            rightArmBone,
            rightBase,
            IDLE_ARM_X - deal * 0.85 + Math.sin(elapsed * 0.85) * 0.03,
            deal * 0.25,
            -IDLE_ARM_Z - deal * 0.15,
          );
        }
        if (leftLowerArm) {
          rotateBoneLocal(THREE, leftLowerArm, leftLowerBase, IDLE_LOWER, 0, 0);
        }
        if (rightLowerArm) {
          rotateBoneLocal(
            THREE,
            rightLowerArm,
            rightLowerBase,
            IDLE_LOWER + deal * 0.5,
            0,
            0,
          );
        }

        // Spring bone (saç / göğüs fizik) — vrm.update şart
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
