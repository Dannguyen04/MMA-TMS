"use client";
/* eslint-disable react-hooks/immutability -- three.js camera/uniforms are mutated per frame; canvas colour is measured from the DOM once on mount */
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { makeBody, makePaint, makePrePass } from "./materials";
import { BODY_MODEL } from "./model";
import { EXTRA_REGIONS, PAINT } from "./regions";
import type { ViewState } from "./types";

type Paint = Record<string, { color: string; R: number; core: number }>;

/** Port của mobile body-scene.tsx: useGLTF(drei) → useLoader(GLTFLoader) + MeshoptDecoder; thêm nhịp đập vùng tô. */
export function BodyScene({ paint, view, light, background, pulse, onReady }: { paint: Paint; view: RefObject<ViewState>; light: boolean; background: string; pulse: boolean; onReady: () => void }) {
  const gltf = useLoader(GLTFLoader, BODY_MODEL.url, (l) => { (l as GLTFLoader).setMeshoptDecoder(MeshoptDecoder); });
  const { camera, gl, scene } = useThree();
  const clear = useMemo(() => new THREE.Color("#f2f4f8"), []);
  const painted = useRef("");
  useLayoutEffect(() => {
    painted.current = "";
  }, [background, light]);
  useFrame(() => {
    const hex = background || (light ? "#f2f4f8" : "#18263f");
    if (painted.current === hex) return;
    painted.current = hex;
    clear.set(hex);
    scene.background = clear;
    gl.setClearColor(clear, 1);
  });
  const meta = BODY_MODEL.meta;

  const built = useMemo(() => {
    const root = gltf.scene.clone(true);
    root.updateMatrixWorld(true);
    let mesh: THREE.Mesh | null = null;
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh && !mesh) mesh = o as THREE.Mesh; });
    if (!mesh) throw new Error("model has no mesh");
    const m = mesh as THREE.Mesh;
    const geo = m.geometry as THREE.BufferGeometry;
    const box = new THREE.Box3().setFromObject(root);
    const C = box.getCenter(new THREE.Vector3());
    const H = box.max.y - box.min.y;
    const names = Object.entries(meta.regions).sort((a, b) => a[1].slot * 4 + a[1].ch - (b[1].slot * 4 + b[1].ch)).map(([n]) => n);
    const input = {
      names,
      on: names.map((n) => (paint[n] ? 1 : 0)),
      R: names.map((n) => (paint[n] ? (paint[n]!.R * H) / meta.DMAX : 1)),
      core: names.map((n) => paint[n]?.core ?? PAINT.core),
      colors: names.map((n) => new THREE.Color(paint[n]?.color ?? "#000000")),
      spine: { ...meta.spine, end: PAINT.spineEnd * H },
      maskIndex: meta.mask.slot * 4 + meta.mask.ch,
      extra: (() => {
        const xs = Object.values(EXTRA_REGIONS);
        const v = (c: readonly number[]) => new THREE.Vector3(c[0], c[1], c[2]);
        return {
          on: xs.map((x) => (paint[x.region] ? 1 : 0)),
          a: xs.map((x) => v(x.centres[0]!)),
          b: xs.map((x) => v(x.centres[1] ?? x.centres[0]!)),
          R: xs.map((x) => (paint[x.region] ? paint[x.region]!.R : x.R)),
          colors: xs.map((x) => new THREE.Color(paint[x.region]?.color ?? "#000000")),
          core: xs.map((x) => paint[x.region]?.core ?? PAINT.core),
        };
      })(),
    };
    m.material = makePrePass();
    const body = new THREE.Mesh(geo, makeBody(BODY_MODEL.face, light)); body.renderOrder = 1;
    const occM = makePaint(input, true), visM = makePaint(input, false);
    const occ = new THREE.Mesh(geo, occM); occ.renderOrder = 2;
    const vis = new THREE.Mesh(geo, visM); vis.renderOrder = 3;
    m.add(body, occ, vis);
    return { root, C, H, paints: [occM, visM] };
  }, [gltf, paint, light, meta]);

  useEffect(() => { onReady(); }, [built, onReady]);
  const t0 = useRef(0);
  useFrame((state, dt) => {
    const vs = view.current!;
    const spin = (globalThis as { __BODY3D_SPIN__?: number }).__BODY3D_SPIN__;
    if (spin) vs.target = vs.angle = vs.angle + dt * spin;
    const diff = vs.target - vs.angle;
    vs.angle = Math.abs(diff) < 1e-3 ? vs.target : vs.angle + diff * Math.min(1, dt * 8);
    const cam = camera as THREE.PerspectiveCamera;
    const dist = built.H / (0.85 * 2 * Math.tan(THREE.MathUtils.degToRad(14)));
    cam.position.set(built.C.x + Math.sin(vs.angle) * dist, built.C.y, built.C.z + Math.cos(vs.angle) * dist);
    cam.lookAt(built.C.x, built.C.y, built.C.z);
    t0.current += dt;
    const k = pulse ? 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t0.current * 3.2)) : 1;
    for (const p of built.paints) (p.uniforms.uPk as { value: number }).value = PAINT.peak * k * 1.15;
    void state;
  });

  return (
    <>
      <primitive object={built.root} />
    </>
  );
}
