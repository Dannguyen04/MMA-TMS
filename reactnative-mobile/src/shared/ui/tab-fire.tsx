/**
 * The round being entered burns (owner 2026-11-18): its frame is on fire. Real-looking flames run along the tab's
 * cut-corner outline, licking high off the top edge, shorter off the sides and as a thin line along the bottom,
 * while the inside stays clear so the label reads. Embers drift up off the top.
 *
 * Selecting a round ignites it: a white-hot blast throws fire out all round the frame, a shock ring runs out and
 * sparks fly, then the flames settle onto the edge. Leaving it, the fire evaporates: it drifts up off the frame,
 * thins and cools to a haze and is gone, then `onOut` fires.
 *
 * The flames are a small fragment shader (expo-gl, already used by the launch intro) on one canvas per row of
 * tabs (`RowFire`), made once, so switching rounds never builds a GL context. The distance to the tab's
 * outline (the same shape ArenaSurface draws) is eaten into by domain-warped fbm noise scrolling upward, coloured
 * deep red → orange → yellow → white-hot on a transparent canvas. Because the fire is measured from the outline
 * itself, it sits exactly on the frame. Decorative only: the label, check mark and selected state are still written
 * and announced. Reduced motion shows one still frame, lit or out at once.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from "react-native-reanimated";

import { devLog } from "@/utils/dev-log";

/** Points the flames climb above the tab's top edge. Callers leave this much room above the row. */
export const FIRE_TOP = 22;
/** Points of canvas past each side and below the tab, for the side flames and the bottom line. */
const SIDE = 26;
const BELOW = 20;
/** Canvas above the tab: room for the tongues, and for the ignition burst to throw fire past them. */
const ABOVE = 34;
/** Same inset and corner cut as ArenaSurface, so the fire sits on the drawn edge. */
const INSET = 1.5;
const cutFor = (w: number, h: number) => Math.min(17, h / 4, w / 6);
/** Ignite and put-out timings (ms). */
const IGNITE_MS = 700;
const BURST_MS = 420;
const RING_MS = 520;
const OUT_MS = 650;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Fire strength over the ignition: shoots up past full (a flare) and settles at 1. */
export function ignitePower(ms: number): number {
  const x = clamp01(ms / IGNITE_MS);
  return 1 - (1 - x) ** 3 + Math.sin(x * Math.PI) * 0.5;
}
/** The ignition blast (owner 2026-11-18, "bùng nổ hơn"): fire thrown out all round the frame, white-hot, fading fast. */
export function igniteBurst(ms: number): number {
  const x = ms / BURST_MS;
  return x >= 1 || x < 0 ? 0 : (1 - x) ** 1.5;
}
/** The shock ring running out from the frame on ignition: 0 → 1, then gone (-1). */
export function igniteRing(ms: number): number {
  const x = ms / RING_MS;
  return x >= 1 || x < 0 ? -1 : x;
}
/** Going out (owner 2026-11-18): the fire evaporates. Its strength thins from where it was to nothing… */
export function outPower(ms: number, from: number): number {
  const x = clamp01(ms / OUT_MS);
  return from * (1 - x) ** 1.4;
}
/** …while the whole fire drifts up off the frame and spreads thin like vapour: 0 → 1. */
export function outLift(ms: number): number {
  const x = clamp01(ms / OUT_MS);
  return 1 - (1 - x) ** 2;
}

const VERT = `
attribute vec2 pos;
varying vec2 uv;
void main() { uv = pos * 0.5 + 0.5; gl_Position = vec4(pos, 0.0, 1.0); }`;

// All lengths in points; y grows upward (GL). One canvas covers the whole row of tabs and burns up to two of them:
// slot A is the open round, slot B the one going out. rect = tab outline (x0, y0, x1, y1), st = (power, burst,
// ring, lift); a slot with rect.z <= rect.x is empty. cut = chamfer at top-right and bottom-left.
const FRAG = `
// highp: on Adreno/Mali mediump is 16-bit, which flattens the hash below to 0 and the fire never shows (2026-11-18).
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float t;
uniform vec2 size;
uniform float cut;
uniform vec4 rectA;
uniform vec4 stA;
uniform vec4 rectB;
uniform vec4 stB;
varying vec2 uv;
// Sine-free hash (Dave Hoskins): stays well spread at low precision and for large coordinates.
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
float fbm4(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v * 1.07;
}
vec4 fire(vec2 p, vec4 rect, vec4 st) {
  float power = st.x, burst = st.y, ring = st.z, lift = st.w;
  // Evaporating: the top edge's flames rise off the frame (read the fire from below the pixel); the sides and the
  // bottom line only stir up a little and fade where they are, never travelling up through the tab.
  float up = smoothstep(rect.w - 6.0, rect.w + 2.0, p.y);
  p.y -= lift * mix(3.0, 22.0, up);
  vec2 c = (rect.xy + rect.zw) * 0.5;
  vec2 b = (rect.zw - rect.xy) * 0.5;
  vec2 q = p - c;
  vec2 dq = abs(q) - b;
  float box = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0);
  float tr = (q.x + q.y - (b.x + b.y - cut)) * 0.7071;
  float bl = (-q.x - q.y - (b.x + b.y - cut)) * 0.7071;
  float d = max(box, max(tr, bl));
  float e = abs(d);
  // How far a flame may reach from the edge here. Tongues rise only straight up off the straight part of the top
  // edge; everywhere else (sides, corners, bottom, inside) the fire is a tight band hugging the outline, so it
  // never spreads sideways off the frame (owner 2026-11-18). Strength scales the reach, so igniting grows it out
  // of the edge.
  float overTop = smoothstep(rect.x + 3.0, rect.x + 10.0, p.x) * smoothstep(rect.z - cut - 2.0, rect.z - cut - 9.0, p.x);
  float above = smoothstep(rect.w - 1.0, rect.w + 3.0, p.y) * overTop;
  float reach = d > 0.0 ? mix(4.0, ${FIRE_TOP - 6}.0, above) : 2.5;
  if (p.y < rect.y) reach = 3.0;
  reach *= max(power, 0.05);
  // Ignition blast: for a moment the fire is thrown out all round the frame.
  if (d > 0.0) reach += burst * 20.0;
  // Evaporating, it spreads thin as it rises.
  reach += lift * 7.0;
  // Most of the canvas is far from any edge: skip the noise there (the row is one canvas, keep it cheap).
  if (e > max(reach, ring >= 0.0 ? 34.0 : 0.0) + 1.0) return vec4(0.0);
  // Narrow, vertically stretched noise with little sideways warp: upright tongues, no horizontal streaks.
  vec2 s = vec2(p.x / 6.0, p.y / 18.0 - t * 1.8);
  vec2 warp = vec2(fbm3(s * 0.8 + vec2(0.0, t * 0.35)), fbm3(s * 0.8 + vec2(5.2, t * 0.45)));
  float n = fbm4(s + vec2(warp.x * 0.35, warp.y * 1.4));
  float f = n * 1.3 + (1.0 - e / reach) - 1.0 - (1.0 - min(power, 1.0)) * 0.45 + burst * 0.4;
  // Shock ring: a band of fire running out from the frame, thinning as it goes.
  float rv = 0.0;
  if (ring >= 0.0 && d > 0.0) { float r = ring * 26.0; rv = exp(-(e - r) * (e - r) / 7.0) * (1.0 - ring) * (0.55 + n * 0.8); }
  f = max(f, rv);
  f = clamp(f * 1.7, 0.0, 1.0);
  vec3 col = mix(vec3(0.35, 0.02, 0.0), vec3(0.92, 0.22, 0.02), smoothstep(0.0, 0.3, f));
  col = mix(col, vec3(1.0, 0.55, 0.08), smoothstep(0.3, 0.6, f));
  col = mix(col, vec3(1.0, 0.86, 0.35), smoothstep(0.6, 0.85, f));
  col = mix(col, vec3(1.0, 0.97, 0.82), smoothstep(0.92, 1.0, f));
  // Going out, what is left cools to dull embers.
  col *= mix(0.45, 1.0, clamp(power, 0.0, 1.0));
  col = mix(col, vec3(1.0, 0.95, 0.8), clamp(burst, 0.0, 1.0) * 0.45);
  // Rising away, it cools to a thin orange-grey haze.
  col = mix(col, vec3(0.55, 0.36, 0.3) * 0.8, lift * 0.65);
  // Hard limit: nothing burns past its reach, whatever the noise does.
  float a = smoothstep(0.05, 0.35, f) * 0.85 * max(1.0 - smoothstep(reach * 0.8, reach, e), rv) * (1.0 - lift * 0.7);
  return vec4(col * a, a);
}
void main() {
  vec2 p = uv * size;
  vec4 a = rectA.z > rectA.x ? fire(p, rectA, stA) : vec4(0.0);
  vec4 b = rectB.z > rectB.x ? fire(p, rectB, stB) : vec4(0.0);
  gl_FragColor = a + b * (1.0 - a.a);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

/** A tab's box inside the row (points, from the row's top-left). */
export type TabBox = { x: number; y: number; w: number; h: number };
type Slot = { n: number; phase: "in" | "out"; since: number; from: number; power: number; burst: number; ring: number; lift: number };

/** One step of a slot's fire at `now`: igniting, burning, or evaporating. */
function stepSlot(s: Slot, now: number, still: boolean) {
  const ms = now - s.since;
  if (s.phase === "in") { s.power = still ? 1 : ignitePower(ms); s.burst = still ? 0 : igniteBurst(ms); s.ring = still ? -1 : igniteRing(ms); s.lift = 0; }
  else { s.power = still ? 0 : outPower(ms, Math.max(s.from, 0.0001)); s.burst = 0; s.ring = -1; s.lift = still ? 1 : outLift(ms); }
}

/**
 * The flames for a whole row of round tabs, on ONE GL canvas made once when the row mounts (owner 2026-11-18: a
 * new GL context per switch stalled the switch on Android). Switching rounds only moves which tab burns: the open
 * one ignites, the one left evaporates, both drawn in the same pass. Place it over the row (absolute, the row's
 * size); it burns past the row's edges, so nothing above it may clip.
 */
export function RowFire({ lit, boxes, rev }: { lit: number; boxes: { current: ReadonlyMap<number, TabBox> }; rev: number }) {
  const still = !!useReducedMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const w = Math.round(size.w), h = Math.round(size.h);
  const litRef = useRef(lit);
  const sizeRef = useRef(size);
  sizeRef.current = { w, h };
  const kick = useRef<(() => void) | null>(null);
  useEffect(() => { litRef.current = lit; kick.current?.(); }, [lit]);
  // A tab moved or the row resized: redraw (needed when still; harmless while burning).
  useEffect(() => { kick.current?.(); }, [rev, w, h]);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    try {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = (name: string) => gl.getUniformLocation(prog, name);
      const uT = u("t"), uSize = u("size"), uCut = u("cut"), uRectA = u("rectA"), uStA = u("stA"), uRectB = u("rectB"), uStB = u("stB");
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const start = Date.now();
      let slots: Slot[] = [];
      let running = false;
      // A slot's tab in GL coordinates (y up) on the canvas, inset onto the drawn edge.
      const setSlot = (uRect: WebGLUniformLocation | null, uSt: WebGLUniformLocation | null, s: Slot | undefined, canvasH: number) => {
        const box = s ? boxes.current.get(s.n) : undefined;
        if (!s || !box) { gl.uniform4f(uRect, 0, 0, 0, 0); return; }
        const top = canvasH - (ABOVE + box.y);
        gl.uniform4f(uRect, SIDE + box.x + INSET, top - box.h + INSET, SIDE + box.x + box.w - INSET, top - INSET);
        gl.uniform4f(uSt, s.power, s.burst, s.ring, s.lift);
      };
      const draw = (now: number) => {
        const { w: rw, h: rh } = sizeRef.current;
        const cw = rw + SIDE * 2, ch = rh + ABOVE + BELOW;
        // The canvas may get its real size after creation (web): map the whole of it every frame.
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(uT, still ? 1.3 : (now - start) / 1000);
        gl.uniform2f(uSize, cw, ch);
        const open = slots.find(s => s.phase === "in");
        const going = slots.find(s => s.phase === "out");
        const box = open ? boxes.current.get(open.n) : going ? boxes.current.get(going.n) : undefined;
        gl.uniform1f(uCut, box ? cutFor(box.w, box.h) : 12);
        setSlot(uRectA, uStA, open, ch);
        setSlot(uRectB, uStB, going, ch);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.flush();
        gl.endFrameEXP();
      };
      const frame = () => {
        if (!alive.current) { running = false; return; }
        const now = Date.now();
        const want = litRef.current;
        if (!slots.some(s => s.n === want && s.phase === "in")) {
          // The open round changed: the old one starts going out from the strength it had, the new one ignites.
          for (const s of slots) if (s.phase === "in") { s.phase = "out"; s.since = now; s.from = s.power; }
          slots = [...slots.filter(s => s.n !== want), { n: want, phase: "in", since: now, from: 0, power: 0, burst: 0, ring: -1, lift: 0 }];
        }
        for (const s of slots) stepSlot(s, now, still);
        // Gone: out and spent. At most the open round and the newest one going out are drawn.
        slots = slots.filter(s => s.phase === "in" || s.power > 0.001);
        const outs = slots.filter(s => s.phase === "out");
        if (outs.length > 1) slots = slots.filter(s => s.phase === "in" || s === outs[outs.length - 1]);
        draw(now);
        if (still) { running = false; return; }
        requestAnimationFrame(frame);
      };
      kick.current = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
      running = true;
      frame();
    } catch (e) {
      devLog("[tab-fire] GL failed", e);
    }
  }, [still, boxes]);
  return <View pointerEvents="none" aria-hidden={true} importantForAccessibility="no-hide-descendants" testID="row-fire"
    onLayout={e => { const { width, height } = e.nativeEvent.layout; setSize(o => o.w === width && o.h === height ? o : { w: width, h: height }); }}
    style={[StyleSheet.absoluteFill, { overflow: "visible" }]}>
    {w > 0 && h > 0 ? <View style={{ position: "absolute", left: -SIDE, top: -ABOVE, width: w + SIDE * 2, height: h + ABOVE + BELOW }}>
      <GLView pointerEvents="none" style={StyleSheet.absoluteFill} onContextCreate={onContextCreate}/>
    </View> : null}
  </View>;
}

function Ember({ left, rise, ms, still }: { left: number; rise: number; ms: number; still: boolean }) {
  const t = useSharedValue(still ? 0.5 : 0);
  useEffect(() => {
    if (still) return;
    t.value = withRepeat(withSequence(withTiming(1, { duration: ms, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })), -1, false);
  }, [ms, still, t]);
  const style = useAnimatedStyle(() => emberStyle(t, rise));
  return <Animated.View style={[{ position: "absolute", top: 0, left, width: 3, height: 3, borderRadius: 2, backgroundColor: "#FFE08A" }, style]}/>;
}
function emberStyle(t: SharedValue<number>, rise: number) {
  "worklet";
  return { opacity: t.value < 0.12 ? t.value / 0.12 : 1 - (t.value - 0.12) / 0.88, transform: [{ translateY: -t.value * rise }, { translateX: Math.sin(t.value * 7) * 3 }] };
}
const EMBERS = [{ x: 0.2, ms: 1300 }, { x: 0.45, ms: 1700 }, { x: 0.68, ms: 1150 }, { x: 0.85, ms: 1500 }] as const;

/**
 * The embers and sparks of a burning tab (the flames themselves are the row's one `RowFire` canvas). Fills its
 * parent (absolute) and flies past its edges: the parent must not clip. Keep it mounted after `lit` turns false
 * until `onOut` (when the fire has evaporated), so the last embers can puff away.
 */
export function TabFire({ lit = true, onOut }: { lit?: boolean; onOut?: () => void }) {
  const still = !!useReducedMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const w = Math.round(size.w), h = Math.round(size.h);
  const outRef = useRef(onOut);
  outRef.current = onOut;
  useEffect(() => {
    if (lit) return;
    const id = setTimeout(() => outRef.current?.(), still ? 0 : OUT_MS + 50);
    return () => clearTimeout(id);
  }, [lit, still]);
  return <View pointerEvents="none" aria-hidden={true} importantForAccessibility="no-hide-descendants" testID="tab-fire"
    onLayout={e => { const { width, height } = e.nativeEvent.layout; setSize(o => o.w === width && o.h === height ? o : { w: width, h: height }); }}
    style={[StyleSheet.absoluteFill, { overflow: "visible" }]}>
    {w > 0 && h > 0 ? <>
      {lit ? EMBERS.map((e, n) => <Ember key={n} left={e.x * w} rise={FIRE_TOP + 8} ms={e.ms} still={still}/>) : null}
      {still ? null : <Sparks key={lit ? "burst" : "puff"} mode={lit ? "burst" : "puff"} w={w} h={h}/>}
    </> : null}
  </View>;
}

/** Sparks thrown off on ignition (all round, outward) and on going out (a puff up off the top). */
const SPARK_MS = 700;
function sparkPlan(mode: "burst" | "puff", w: number, h: number) {
  const out: { x: number; y: number; dx: number; dy: number; size: number; ms: number }[] = [];
  const rnd = (i: number) => { const v = Math.sin(i * 12.9898 + (mode === "burst" ? 1 : 7)) * 43758.5453; return v - Math.floor(v); };
  if (mode === "burst") {
    const per = 2 * (w + h);
    for (let i = 0; i < 18; i++) {
      // A point on the outline, thrown out along its normal and a little upward.
      const at = ((i + rnd(i)) / 18) * per;
      let x: number, y: number, nx: number, ny: number;
      if (at < w) { x = at; y = 0; nx = 0; ny = -1; }
      else if (at < w + h) { x = w; y = at - w; nx = 1; ny = 0; }
      else if (at < 2 * w + h) { x = w - (at - w - h); y = h; nx = 0; ny = 1; }
      else { x = 0; y = h - (at - 2 * w - h); nx = -1; ny = 0; }
      const speed = 22 + rnd(i + 40) * 26;
      out.push({ x, y, dx: nx * speed + (rnd(i + 80) - 0.5) * 16, dy: ny * speed - 10 - rnd(i + 120) * 14, size: 2 + rnd(i + 160) * 2.5, ms: SPARK_MS * (0.7 + rnd(i + 200) * 0.5) });
    }
  } else {
    for (let i = 0; i < 6; i++) {
      // Faint embers drifting up with the vapour, not thrown.
      out.push({ x: w * (0.1 + 0.8 * rnd(i)), y: 0, dx: (rnd(i + 40) - 0.5) * 12, dy: -(18 + rnd(i + 80) * 16), size: 1.5 + rnd(i + 120) * 1.5, ms: SPARK_MS * (0.9 + rnd(i + 160) * 0.4) });
    }
  }
  return out;
}
function Spark({ x, y, dx, dy, size, ms }: { x: number; y: number; dx: number; dy: number; size: number; ms: number }) {
  const t = useSharedValue(0);
  useEffect(() => { t.value = withTiming(1, { duration: ms, easing: Easing.out(Easing.quad) }); }, [ms, t]);
  const style = useAnimatedStyle(() => sparkStyle(t, dx, dy));
  return <Animated.View style={[{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size, backgroundColor: "#FFE7A0" }, style]}/>;
}
function sparkStyle(t: SharedValue<number>, dx: number, dy: number) {
  "worklet";
  const p = t.value;
  // Thrown out, slowed, pulled down a little at the end; it cools and shrinks as it flies.
  return { opacity: p < 0.08 ? p / 0.08 : 1 - p, transform: [{ translateX: dx * p }, { translateY: dy * p + 18 * p * p }, { scale: 1 - p * 0.6 }] };
}
function Sparks({ mode, w, h }: { mode: "burst" | "puff"; w: number; h: number }) {
  const [done, setDone] = useState(false);
  useEffect(() => { const id = setTimeout(() => setDone(true), SPARK_MS * 1.3); return () => clearTimeout(id); }, []);
  if (done) return null;
  return <>{sparkPlan(mode, w, h).map((sp, i) => <Spark key={i} {...sp}/>)}</>;
}
