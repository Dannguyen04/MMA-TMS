import { lazy, Suspense, useMemo, useRef } from "react";
import { PanResponder, View } from "react-native";

import { dragAngle, GlBoundary, useBodyMode } from "@/components/body3d/gl-mode";
import { useReducedMotion } from "@/components/body3d/reduced-motion";
import { EXTRA_REGIONS, JOINT_REGIONS, PAINT } from "@/components/body3d/regions";
import type { ViewState } from "@/components/body3d/body-scene";
import { useThemePreference } from "@/theme";
import { bodyA11y, BodyFigure, MARK_COLOR } from "./body-map";
import type { BodyMarks } from "./health-model";

// Load three / R3F only when the 3D view is shown; require keeps Jest able to mock it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BodyCanvas = lazy(() => Promise.resolve().then(() => require("@/components/body3d/body-canvas") as typeof import("@/components/body3d/body-canvas")));


/** Body marks → model regions: injured joints red, joints to avoid orange, the head after a KO / TKO. */
export function paintFor(marks: BodyMarks): Record<string, { color: string; R: number; core: number }> {
  const out: Record<string, { color: string; R: number; core: number }> = {};
  const put = (joint: string, color: string) => {
    const cfg = JOINT_REGIONS[joint];
    if (cfg) out[cfg.region] = { color, R: cfg.R, core: cfg.core ?? PAINT.core };
  };
  marks.avoid.forEach(j => put(j, MARK_COLOR.avoid));
  marks.hurt.forEach(j => put(j, MARK_COLOR.hurt));
  if (marks.head) out[EXTRA_REGIONS.HEAD.region] = { color: MARK_COLOR.hurt, R: EXTRA_REGIONS.HEAD.R, core: PAINT.core };
  return out;
}

/**
 * The Cơ thể body map in 3D (owner 2026-11-12): the approved anatomy model (components/body3d) with the fighter's
 * marks painted on, drag sideways to turn it. Reduced motion, a GL error or no frame in 5 s fall back to the flat figure.
 */
export function BodyModel({ marks, width = 148, height = 240 }: { marks: BodyMarks; width?: number; height?: number }) {
  const { colors: c, resolvedScheme } = useThemePreference();
  const reduced = useReducedMotion();
  const body = useBodyMode(!!reduced);
  const paint = useMemo(() => paintFor(marks), [marks]);
  const view = useRef<ViewState>({ angle: 0, target: 0 });
  const lastDx = useRef(0);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: () => { lastDx.current = 0; },
    onPanResponderMove: (_e, g) => {
      const a = dragAngle(view.current.angle, g.dx - lastDx.current);
      lastDx.current = g.dx;
      view.current.angle = a;
      view.current.target = a;
    },
    onPanResponderTerminationRequest: () => false,
  }), []);

  if (body.mode === "fallback") return <View style={{ width, height, alignItems: "center", justifyContent: "center" }}><BodyFigure marks={marks}/></View>;
  return <View {...pan.panHandlers} testID="body-model" accessible accessibilityRole="image" accessibilityLabel={bodyA11y(marks)} accessibilityHint="Kéo ngang để xoay"
    style={{ width, height }}>
    <GlBoundary onError={body.fail}>
      <Suspense fallback={null}>
        <BodyCanvas paint={paint} view={view} light={resolvedScheme === "light"} background={c.bg} onReady={body.onReady}/>
      </Suspense>
    </GlBoundary>
  </View>;
}
