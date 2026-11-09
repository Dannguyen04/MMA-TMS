"use client";
import { Canvas } from "@react-three/fiber";
import { Suspense, type RefObject } from "react";
import { BodyScene } from "./body-scene";
import type { ViewState } from "./types";

export default function BodyCanvas(props: { paint: Record<string, { color: string; R: number; core: number }>; view: RefObject<ViewState>; light: boolean; background: string; pulse: boolean; onReady: () => void }) {
  return (
    <Canvas camera={{ fov: 28, near: 0.0001, far: 10 }} gl={{ antialias: true, preserveDrawingBuffer: true }} dpr={[1, 2]} style={{ display: "block", width: "100%", height: "100%", background: props.background || "transparent" }}>
      <Suspense fallback={null}>
        <BodyScene {...props} />
      </Suspense>
    </Canvas>
  );
}
