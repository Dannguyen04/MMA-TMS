"use client";
/* eslint-disable react-hooks/set-state-in-effect -- three.js camera/uniforms are mutated per frame; canvas colour is measured from the DOM once on mount */
import { RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { BodyMap, type BodyMapHighlight } from "@/components/domain/body-map";
import type { BodyRegion } from "@/lib/domain/types";
import { BODY_MODEL_CREDIT } from "./model";
import { EXCLUDED_COLOR, STATUS_COLOR, STATUS_TEXT, buildJointRows, paintExcluded, paintRegions, type PaintStatus } from "./regions";
import type { ViewState } from "./types";

const BodyCanvas = dynamic(() => import("./body-canvas"), { ssr: false });
const LOAD_TIMEOUT_MS = 5000; // như mobile
const DRAG_RAD_PER_PX = 0.01; // như mobile DRAG_RAD_PER_DP

class GlBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

const hasWebGL = () => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; } };
const TO_2D = (j: string): BodyRegion | null => {
  const m: Record<string, BodyRegion> = { SPINE_CORE: "lower_back", HEAD: "head", NECK: "neck", CHEST: "chest", RIBS: "ribs", LEFT_WRIST: "left_hand", RIGHT_WRIST: "right_hand" };
  return m[j] ?? ((j.toLowerCase() as BodyRegion) || null);
};
const TONE: Record<PaintStatus, BodyMapHighlight["tone"]> = { injury: "danger", recovering: "info", healed: "success" };

export type BodyInjury = { affectedJoint: string; status: string; injuryType: string; severity: string };

export function BodyModel({ injuries, excludedJoints = [], height = 460 }: { injuries: readonly BodyInjury[]; excludedJoints?: readonly string[]; height?: number }) {
  const rows = useMemo(() => buildJointRows(injuries, [], (s) => s, (s) => s), [injuries]);
  const paint = useMemo(() => paintExcluded(paintRegions(rows), excludedJoints), [rows, excludedJoints]);
  const [mode, setMode] = useState<"pending" | "3d" | "fallback">("pending");
  const [ready, setReady] = useState(false);
  const [bg, setBg] = useState("#0a1230");
  const [light, setLight] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const view = useRef<ViewState>({ angle: 0, target: 0 });
  const drag = useRef<number | null>(null);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMode(reduced || !hasWebGL() ? "fallback" : "3d");
  }, []);
  // The frame's colour decides the look (dark hologram or light outline); measured again whenever the theme changes.
  useEffect(() => {
    const measure = () => {
      if (!frame.current) return;
      const c = getComputedStyle(frame.current).backgroundColor;
      setBg(c);
      const n = c.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
      setLight(0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2] > 140);
    };
    measure();
    const media = matchMedia("(prefers-color-scheme: dark)");
    const theme = new MutationObserver(() => requestAnimationFrame(measure));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    media.addEventListener("change", measure);
    return () => {
      theme.disconnect();
      media.removeEventListener("change", measure);
    };
  }, [mode]);
  useEffect(() => {
    if (mode !== "3d" || ready) return;
    const t = setTimeout(() => setMode("fallback"), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [mode, ready]);
  const onReady = useCallback(() => { setReady(true); (globalThis as { __BODY3D_READY__?: number }).__BODY3D_READY__ = performance.now(); }, []);
  const fail = useCallback(() => setMode("fallback"), []);

  const legend = (
    <ul className="b3-legend">
      {(Object.keys(STATUS_COLOR) as PaintStatus[]).map((s) => <li key={s}><i style={{ background: STATUS_COLOR[s] }} />{STATUS_TEXT[s]}</li>)}
      <li><i style={{ background: EXCLUDED_COLOR }} />Loại trừ khi tập</li>
    </ul>
  );

  if (mode === "fallback") {
    const hl: BodyMapHighlight[] = [
      ...rows.filter((r) => r.mapped && r.status).map((r) => ({ region: TO_2D(r.joint)!, tone: TONE[r.status!], label: `${r.label} · ${r.statusText}${r.detail ? ` · ${r.detail}` : ""}` })),
      ...excludedJoints.filter((j) => !rows.some((r) => r.joint === j)).map((j) => ({ region: TO_2D(j)!, tone: "warning" as const, label: "Loại trừ khi tập" })),
    ];
    return <div className="b3-fallback" data-mode="fallback"><BodyMap highlights={hl} size="md" /></div>;
  }

  return (
    <div className="b3">
      <div
        ref={frame}
        className="b3-frame"
        style={{ height }}
        role="img"
        aria-label={`Mô hình cơ thể 3D. Kéo ngang để xoay. ${rows.map((r) => `${r.label}: ${r.statusText}`).join("; ")}`}
        data-ready={ready}
        onPointerDown={(e) => { drag.current = e.clientX; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => { if (drag.current === null) return; const a = view.current.angle - (e.clientX - drag.current) * DRAG_RAD_PER_PX; drag.current = e.clientX; view.current.angle = view.current.target = a; }}
        onPointerUp={() => { drag.current = null; }}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") view.current.target += 0.35; if (e.key === "ArrowRight") view.current.target -= 0.35; }}
        tabIndex={0}
      >
        {mode === "3d" && (
          <GlBoundary onError={fail}>
            <BodyCanvas paint={paint} view={view} light={light} background={bg} pulse onReady={onReady} />
          </GlBoundary>
        )}
        {!ready && <span className="b3-skel" aria-hidden />}
        {paint.SPINE && (
          <button type="button" className="b3-turn" onClick={() => { view.current.target = view.current.angle + Math.PI; }}>
            <RotateCcw aria-hidden /> Có vùng phía sau · xoay
          </button>
        )}
      </div>
      {legend}
      <p className="b3-credit">Mô hình “{BODY_MODEL_CREDIT.title}” · {BODY_MODEL_CREDIT.author} · {BODY_MODEL_CREDIT.license}</p>
    </div>
  );
}
