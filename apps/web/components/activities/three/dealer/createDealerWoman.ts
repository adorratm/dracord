/**
 * VRM / GLB anime kurpiyer — DealerRig API uyumlu.
 * Model: public/models/dealer/anime-dealer.vrm (yoksa null döner → prosedürel fallback).
 */

import type { Group, Mesh, Object3D, Quaternion } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import type { AssetBag, DealerRig } from '../gameAssets';

type Three = typeof import('three');

export const DEALER_VRM_URL = '/models/dealer/anime-dealer.vrm';
export const DEALER_GLB_URL = '/models/dealer/anime-dealer.glb';

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
    // Bazı sunucular HEAD desteklemez
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
 * VRM anime dealer yükler. Dosya yoksa / yükleme hatasında null.
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

    // Saf GLB (VRM değil) — sahneyi ekle ama humanoid yoksa basit dönen kök
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
      // Tipik insan boyu ~1.6 — masaya sığdır
      root.scale.setScalar(1.05);
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
          lookZ = camZ + 2.75;
        },
        update(t, dt) {
          const yaw = Math.atan2(lookX, Math.max(0.4, lookZ)) * 0.25;
          root.rotation.y = yaw;
          root.position.y = 0.02 + Math.sin(t * 2.1) * 0.008;
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

    // Masaya göre ölçek / yön (kalibre edilebilir)
    root.scale.setScalar(1.08);
    // Oyuncuya bakacak şekilde (masa +Z tarafı)
    root.rotation.y = Math.PI;

    const humanoid = vrm.humanoid;
    const headBone = humanoid.getNormalizedBoneNode('head');
    const spineBone = humanoid.getNormalizedBoneNode('spine');
    const rightArmBone = humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftArmBone = humanoid.getNormalizedBoneNode('leftUpperArm');

    if (!headBone || !spineBone || !rightArmBone || !leftArmBone) {
      console.warn('[dealer] VRM humanoid kemikleri eksik — model yine de gösterilecek');
    }

    const headBase = headBone?.quaternion.clone() ?? new THREE.Quaternion();
    const spineBase = spineBone?.quaternion.clone() ?? new THREE.Quaternion();
    const rightBase = rightArmBone?.quaternion.clone() ?? new THREE.Quaternion();
    const leftBase = leftArmBone?.quaternion.clone() ?? new THREE.Quaternion();

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
    let targetPitch = -0.08;
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
        dealT = 0.65;
      },
      lookAtSeat(x, z) {
        // Karakter Math.PI dönük; koltuklar +Z'de
        lookX = x;
        lookZ = z + 2.75;
      },
      faceCamera(camX, camY, camZ) {
        lookX = camX;
        lookZ = camZ + 2.75;
        targetPitch = Math.min(0.12, Math.max(-0.18, (camY - 1.5) * 0.04));
      },
      update(_t, dt) {
        if (disposed) return;
        const h = Math.min(0.05, Math.max(0, dt));
        elapsed += h;

        const breath = Math.sin(elapsed * 2.1);
        const sway = Math.sin(elapsed * 0.65);

        if (spineBone) {
          rotateBoneLocal(
            THREE,
            spineBone,
            spineBase,
            breath * 0.012,
            sway * 0.018,
            Math.sin(elapsed * 0.8) * 0.008,
          );
        }

        const yaw = Math.min(
          0.38,
          Math.max(-0.38, Math.atan2(lookX, Math.max(0.45, lookZ)) * 0.38),
        );
        if (headBone) {
          rotateBoneLocal(
            THREE,
            headBone,
            headBase,
            targetPitch + Math.sin(elapsed) * 0.01,
            yaw,
            0,
          );
        }

        // Göz kırpma ~4s
        const blinkPhase = elapsed % 4.2;
        const blink =
          blinkPhase > 3.9 ? Math.sin(((blinkPhase - 3.9) / 0.3) * Math.PI) : 0;
        setExpr(vrm, 'blink', Math.max(0, blink));

        const mouth = talking ? 0.22 + Math.abs(Math.sin(elapsed * 12)) * 0.55 : 0;
        setExpr(vrm, 'aa', mouth);
        setExpr(vrm, 'oh', talking ? mouth * 0.35 : 0);

        let deal = 0;
        if (dealT > 0) {
          dealT = Math.max(0, dealT - h);
          deal = Math.sin((1 - dealT / 0.65) * Math.PI);
        }
        if (rightArmBone) {
          rotateBoneLocal(THREE, rightArmBone, rightBase, -deal * 0.7, 0, -deal * 0.2);
        }
        if (leftArmBone) {
          rotateBoneLocal(
            THREE,
            leftArmBone,
            leftBase,
            Math.sin(elapsed * 0.9) * 0.02,
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
