import { Suspense, type MutableRefObject } from "react";

import { BodyScene, type ViewState } from "./body-scene";
import { Canvas } from "./r3f";

export type BodyCanvasProps = {
  paint: Record<string, { color: string; R: number; core: number }>;
  view: MutableRefObject<ViewState>;
  light: boolean;
  background: string;
  onReady: () => void;
  onFps?: (fps: number) => void;
  zoom?: { factor: number; y: number };
};

/** Khung GL (expo-gl trên máy, WebGL trên web). Lỗi tải/biên dịch ném ra để ErrorBoundary chuyển sang SVG. */
export default function BodyCanvas(props: BodyCanvasProps) {
  return (
    <Canvas camera={{ fov: 28, near: 0.0001, far: 10 }} gl={{ antialias: true }} style={{ flex: 1 }}>
      <Suspense fallback={null}>
        <BodyScene {...props} />
      </Suspense>
    </Canvas>
  );
}
