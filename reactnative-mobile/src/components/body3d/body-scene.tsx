import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { BODY_MODEL } from "./model";
import { makeBody, makePaint, makePrePass } from "./materials";
import { resolveModelSource, useFrame, useGLTF, useThree } from "./r3f";
import { PAINT } from "./regions";

export type ViewState = {
  /** Góc xoay hiện tại quanh trục đứng (rad), 0 = mặt trước. */
  angle: number;
  /** Góc đích (kéo tay đặt thẳng cả hai). */
  target: number;
};

type Props = {
  paint: Record<string, { color: string; R: number; core: number }>;
  view: MutableRefObject<ViewState>;
  light: boolean;
  background: string;
  onReady: () => void;
  onFps?: (fps: number) => void;
  /** Phóng to (1 = cả người); dùng cho ảnh cận đầu khi kiểm tra. */
  zoom?: { factor: number; y: number };
};

const ATTRS = ["_geo0", "_geo1", "_geo2", "_geo3"] as const;
const GET = ["getX", "getY", "getZ", "getW"] as const;

export function BodyScene({ paint, view, light, background, onReady, onFps, zoom }: Props) {
  const gltf = useGLTF(resolveModelSource(BODY_MODEL.glb) as string, false, false, (loader) => {
    (loader as unknown as { setMeshoptDecoder: (d: unknown) => void }).setMeshoptDecoder(MeshoptDecoder);
  }) as unknown as { scene: THREE.Group };
  const { camera } = useThree();
  const meta = BODY_MODEL.meta;

  const built = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.updateMatrixWorld(true);
    let mesh: THREE.Mesh | null = null;
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !mesh) mesh = o as THREE.Mesh;
    });
    if (!mesh) throw new Error("model has no mesh");
    const m = mesh as THREE.Mesh;
    const geo = m.geometry as THREE.BufferGeometry;
    const box = new THREE.Box3().setFromObject(root);
    const C = box.getCenter(new THREE.Vector3());
    const H = box.max.y - box.min.y;

    const names = Object.entries(meta.regions)
      .sort((a, b) => a[1].slot * 4 + a[1].ch - (b[1].slot * 4 + b[1].ch))
      .map(([n]) => n);
    const on = names.map((n) => (paint[n] ? 1 : 0));
    const R = names.map((n) => (paint[n] ? (paint[n]!.R * H) / meta.DMAX : 1));
    const core = names.map((n) => paint[n]?.core ?? PAINT.core);
    const colors = names.map((n) => new THREE.Color(paint[n]?.color ?? "#000000"));
    const input = { names, on, R, core, colors, spine: { ...meta.spine, end: PAINT.spineEnd * H }, maskIndex: meta.mask.slot * 4 + meta.mask.ch };

    m.material = makePrePass();
    const body = new THREE.Mesh(geo, makeBody(BODY_MODEL.face, light));
    body.renderOrder = 1;
    const occ = new THREE.Mesh(geo, makePaint(input, true));
    occ.renderOrder = 2;
    const vis = new THREE.Mesh(geo, makePaint(input, false));
    vis.renderOrder = 3;
    m.add(body, occ, vis);

    return { root, C, H };
  }, [gltf, paint, light, meta]);

  useEffect(() => {
    onReady();
  }, [built, onReady]);

  const last = useRef({ frames: 0, fpsT: 0 });
  useFrame((state, dt) => {
    const vs = view.current;
    // Chỉ bản dev: ảnh kiểm tra cận đầu đặt globalThis.__BODY3D_DEV__ = { zoom, y, angle }.
    const dev = __DEV__ ? (globalThis as { __BODY3D_DEV__?: { zoom: number; y: number; angle: number } }).__BODY3D_DEV__ : undefined;
    if (dev) vs.angle = vs.target = dev.angle;
    // Xoay mượt tới góc đích (kéo tay đặt cả hai giá trị).
    const diff = vs.target - vs.angle;
    vs.angle = Math.abs(diff) < 1e-3 ? vs.target : vs.angle + diff * Math.min(1, dt * 8);
    const cam = camera as THREE.PerspectiveCamera;
    const zz = dev ? { factor: dev.zoom, y: dev.y } : zoom;
    const z = zz?.factor ?? 1;
    const dist = built.H / (0.85 * 2 * Math.tan(THREE.MathUtils.degToRad(14))) / z;
    const cy = zz ? built.C.y + zz.y * built.H : built.C.y;
    cam.position.set(built.C.x + Math.sin(vs.angle) * dist, cy, built.C.z + Math.cos(vs.angle) * dist);
    cam.lookAt(built.C.x, cy, built.C.z);

    const now = state.clock.elapsedTime;
    const L = last.current;
    if (onFps) {
      L.frames++;
      if (now - L.fpsT >= 1) {
        onFps(Math.round(L.frames / (now - L.fpsT)));
        L.frames = 0;
        L.fpsT = now;
      }
    }
  });

  return (
    <>
      <color attach="background" args={[background]} />
      <primitive object={built.root} />
    </>
  );
}
