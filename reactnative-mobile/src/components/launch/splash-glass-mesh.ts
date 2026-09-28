export type MeshPt = { x: number; y: number };

export type MeshEdge = {
  id: string;
  d: string;
  length: number;
  /** Unused for growClock (all veins share 0→1). Kept 0. */
  delay: number;
  /** Unused for growClock (span is the shared clock). Kept 1. */
  grow: number;
  width: number;
  stroke: string;
  strokeOpacity: number;
  /** True if this polyline lies on the screen rect (do not stroke). */
  onPerimeter?: boolean;
  /**
   * Only a tiny set uses Reanimated jsProps dashoffset during grow.
   * Everyone else stays a static hidden Path until the shared snap at crackGrowMs.
   */
  growLive?: boolean;
};

export type MeshFace = {
  id: string;
  points: string;
  cx: number;
  cy: number;
  /** Unused for fillClock (lockstep). Kept 0 so hosts do not stagger ice-in. */
  delay: number;
  fill: string;
  /** Specular strength 0–1.4; higher near punch (frost). */
  specBoost: number;
  /** Static SVG fillOpacity — never jsProps. Always 1 (opaque; no video leak). */
  fillOpacity: number;
};

/** Small opaque chips at the punch. Drawn inside the 24 hosts — never extra fly hosts. */
export type CrushTri = {
  id: string;
  points: string;
  fill: string;
};

/**
 * Frosted / milky glass stops (near punch glare → rim). Bright opaque ice —
 * not dark clear glass, not cool see-through grey. Not assigned by face index % 6.
 */
export const FACE_FILLS = [
  "#e4ebe7",
  "#e9f0ec",
  "#dee6e2",
  "#e7eeea",
  "#edf3f0",
  "#f2f6f4",
] as const;
export const FACE_FILLS_UNUSED = false;
export const COLOR_RADIAL_PUNCH = true;
export const COLOR_RANDOM_INDEX = false;
/** Phone-screen punch shatter: small chips at impact, large tiles at the bezel. */
export const PHONE_GLASS_MESH = true;
export const SHARD_SIZE_BY_PUNCH_DIST = true;
export const FROST_EPICENTER = true;
/** Dark 3D dent blob (RadialGradient bowl) — OFF. Crush is white chips + thick rays. */
export const DENT_EPICENTER = false;
/** Opaque white / light-grey triangular crush at punch (not a dark dent). */
export const CRUSH_WHITE = true;
/** Inner ~6–10% of min(W,H) — crush triangles + thicker rays. */
export const DENT_RADIUS_RATIO = 0.08;
export const CRUSH_RADIUS_RATIO = DENT_RADIUS_RATIO;
/**
 * Concentric rings are NOT the main crack look (straight radials from punch).
 * Keep 0 — extra Paths at clock-1 snap only if this is raised later.
 */
export const CONCENTRIC_RINGS = 0;
/** All 24 face fills use fillOpacity 1 — frost is milky hex, never see-through alpha. */
export const FACE_FILL_OPAQUE = true;
export const SEE_THROUGH = false;
export const STRAIGHT_RADIALS = true;

/** Overlap inner/outer polygons (~2px) so TextureView cannot read a seam. */
const FACE_SEAM_OVERLAP = 2;

/** Bright ice hairline — glare flash, not a dark fracture diagram. */
const CRACK_VEIN = "#f7fcfa";
const CRACK_OUTER = "#eef6f2";
const CRACK_BRANCH = "#e4ece8";

/**
 * Hairline mains. Old plate / highlight gate was **3.4** — do not restore.
 * Logged as `strokeMain`.
 */
export const CRACK_STROKE_MAIN = 0.7;
/**
 * Hairline branches / twigs. Old plate was **2.4** — do not restore.
 * Logged as `strokeBranch`.
 */
export const CRACK_STROKE_BRANCH = 0.26;
/** Face mesh stays extraPerEdge=2 → 12 sectors → 24 fly hosts. Do not bump (changes fly count). */
const FACE_EXTRA_PER_EDGE = 2;
/**
 * Extra veins: uniform **angle** around punch (not rect-perimeter samples).
 * Perimeter sampling piled most long rays left of punchScreenX≈80%.
 * Modest bump vs previous extraPerEdge=5 → 24 rim pts.
 * Extra veins still draw at the shared-clock snap. Grow-time jsProps is only
 * `GROW_JS_PROPS_MAX` origin rays — 100+ Fabric dashoffset commits per frame
 * stalled withTiming to ~18s.
 */
const VEIN_ANGULAR_SAMPLES = 16;
/** Extra short inner rays between those samples (full 360°, no left-only set). */
const VEIN_INNER_EXTRA = 8;
/** Animated dashoffset nodes during crackGrowMs. Rest snap at clock 1. */
export const GROW_JS_PROPS_MAX = 8;

function hypot(a: MeshPt, b: MeshPt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function mixHex(a: string, b: string, t: number): string {
  const pa = a.replace("#", "");
  const pb = b.replace("#", "");
  const ar = parseInt(pa.slice(0, 2), 16);
  const ag = parseInt(pa.slice(2, 4), 16);
  const ab = parseInt(pa.slice(4, 6), 16);
  const br = parseInt(pb.slice(0, 2), 16);
  const bg = parseInt(pb.slice(2, 4), 16);
  const bb = parseInt(pb.slice(4, 6), 16);
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  const k = clamp01(t);
  return `#${hex(ar + (br - ar) * k)}${hex(ag + (bg - ag) * k)}${hex(ab + (bb - ab) * k)}`;
}

/**
 * Bright milky crush near punch, frosted mid pane, pale residual at the rim.
 * Radial from punch — never FACE_FILLS[i % 6], never a dark dent blob.
 * fillOpacity always 1 (opaque).
 */
export function iceFillFromPunch(
  cx: number,
  cy: number,
  ox: number,
  oy: number,
  maxR: number,
): { fill: string; specBoost: number; fillOpacity: number } {
  const t = clamp01(Math.hypot(cx - ox, cy - oy) / Math.max(maxR, 1));
  const crush = mixHex("#f8fbf9", FACE_FILLS[5], 0.38);
  const near = FACE_FILLS[5];
  const mid = FACE_FILLS[3];
  const rim = mixHex(FACE_FILLS[4], FACE_FILLS[0], 0.28);
  const fill =
    t < 0.1
      ? mixHex(crush, near, t / 0.1)
      : t < 0.4
        ? mixHex(near, mid, (t - 0.1) / 0.3)
        : mixHex(mid, rim, (t - 0.4) / 0.6);
  const specBoost = 1.28 - t * 0.72;
  return { fill, specBoost, fillOpacity: 1 };
}

export function splashPhoneGlassFlags(): Record<string, boolean | number> {
  return {
    phoneGlassMesh: PHONE_GLASS_MESH,
    concentricRings: CONCENTRIC_RINGS,
    shardSizeByPunchDist: SHARD_SIZE_BY_PUNCH_DIST,
    frostEpicenter: FROST_EPICENTER,
    dentEpicenter: DENT_EPICENTER,
    crushWhite: CRUSH_WHITE,
    dentRadiusRatio: DENT_RADIUS_RATIO,
    colorRandomIndex: COLOR_RANDOM_INDEX,
    colorRadialPunch: COLOR_RADIAL_PUNCH,
    growJsProps: GROW_JS_PROPS_MAX,
    fillOpaque: FACE_FILL_OPAQUE,
    seeThrough: SEE_THROUGH,
    straightRadials: STRAIGHT_RADIALS,
  };
}

function inflateFromCentroid(pts: MeshPt[], px: number): MeshPt[] {
  const c = centroid(pts);
  return pts.map((p) => {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return p;
    return { x: p.x + (dx / len) * px, y: p.y + (dy / len) * px };
  });
}

function lerp(a: MeshPt, b: MeshPt, t: number): MeshPt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function centroid(pts: MeshPt[]): MeshPt {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  const n = Math.max(pts.length, 1);
  return { x: x / n, y: y / n };
}

function polyPoints(pts: MeshPt[]): string {
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

function polylinePath(pts: MeshPt[]): string {
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

function polylineLength(pts: MeshPt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += hypot(pts[i - 1], pts[i]);
  }
  return Math.max(len, 8);
}

function mix(a: number, b: number): number {
  return ((a * 73856093) ^ (b * 19349663) ^ (a * 83492791 + b)) >>> 0;
}

function unit(n: number): number {
  return (n % 1000) / 1000;
}

function reversePoly(pts: MeshPt[]): MeshPt[] {
  const out = pts.slice();
  out.reverse();
  return out;
}

/** Concatenate polylines that share endpoints (drop duplicate joins). */
function chainPolys(parts: MeshPt[][]): MeshPt[] {
  const out: MeshPt[] = [];
  for (const part of parts) {
    if (part.length === 0) continue;
    const start = out.length === 0 ? 0 : 1;
    for (let i = start; i < part.length; i++) {
      out.push(part[i]);
    }
  }
  return out;
}

/**
 * Straight radial: origin → edge. Optional **one** angular jog (never organic wobble).
 * Shared by stroke `d` and face polygons (same vertices, no fill leak).
 */
function radialPolyline(a: MeshPt, b: MeshPt, seed: number, allowJog: boolean): MeshPt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (!allowJog || len < 24 || mix(seed, 11) % 3 !== 0) {
    return [a, b];
  }
  const nx = -dy / len;
  const ny = dx / len;
  const t = 0.38 + unit(mix(seed, 19)) * 0.24;
  const mag = len * (0.012 + unit(mix(seed, 29)) * 0.018);
  const sign = mix(seed, 41) % 2 === 0 ? 1 : -1;
  return [
    a,
    {
      x: a.x + dx * t + nx * mag * sign,
      y: a.y + dy * t + ny * mag * sign,
    },
    b,
  ];
}

/** First hit of a ray from the punch onto the splash rect (full 360°). */
function rayHitRect(ox: number, oy: number, ang: number, w: number, h: number): MeshPt {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  let t = Number.POSITIVE_INFINITY;
  if (dx < -1e-9) {
    const tt = (0 - ox) / dx;
    const y = oy + tt * dy;
    if (tt > 0 && y >= -0.5 && y <= h + 0.5) t = Math.min(t, tt);
  }
  if (dx > 1e-9) {
    const tt = (w - ox) / dx;
    const y = oy + tt * dy;
    if (tt > 0 && y >= -0.5 && y <= h + 0.5) t = Math.min(t, tt);
  }
  if (dy < -1e-9) {
    const tt = (0 - oy) / dy;
    const x = ox + tt * dx;
    if (tt > 0 && x >= -0.5 && x <= w + 0.5) t = Math.min(t, tt);
  }
  if (dy > 1e-9) {
    const tt = (h - oy) / dy;
    const x = ox + tt * dx;
    if (tt > 0 && x >= -0.5 && x <= w + 0.5) t = Math.min(t, tt);
  }
  if (!Number.isFinite(t) || t <= 0) {
    return { x: ox, y: oy };
  }
  return { x: ox + dx * t, y: oy + dy * t };
}

function widthByPunchDist(t: number, nearW: number, farW: number): number {
  return nearW + (farW - nearW) * clamp01(t);
}

/** Perimeter of the splash rect, corners included, winding CCW from top-left. */
function rectBoundary(w: number, h: number, extraPerEdge: number): MeshPt[] {
  const pts: MeshPt[] = [];
  const steps = extraPerEdge + 1;
  for (let i = 0; i <= steps; i++) {
    pts.push({ x: (w * i) / steps, y: 0 });
  }
  for (let i = 1; i <= steps; i++) {
    pts.push({ x: w, y: (h * i) / steps });
  }
  for (let i = 1; i <= steps; i++) {
    pts.push({ x: w - (w * i) / steps, y: h });
  }
  for (let i = 1; i < steps; i++) {
    pts.push({ x: 0, y: h - (h * i) / steps });
  }
  return pts;
}

const CRUSH_FILLS = ["#f8fbf9", "#f2f7f4", "#ebf1ee", "#f5f9f7"] as const;

/** Opaque white/light-grey chips in the crush radius. Polygons only — never Circle r. */
function buildCrushTriangles(ox: number, oy: number, crushR: number): CrushTri[] {
  const n = 10;
  const tris: CrushTri[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const r0 = crushR * (0.38 + unit(mix(i, 3)) * 0.42);
    const r1 = crushR * (0.52 + unit(mix(i, 7)) * 0.46);
    const origin: MeshPt = { x: ox, y: oy };
    const p1: MeshPt = { x: ox + Math.cos(a0) * r0, y: oy + Math.sin(a0) * r0 };
    const p2: MeshPt = { x: ox + Math.cos(a1) * r1, y: oy + Math.sin(a1) * r1 };
    tris.push({
      id: `crush-fan-${i}`,
      points: polyPoints([origin, p1, p2]),
      fill: CRUSH_FILLS[i % CRUSH_FILLS.length],
    });
  }
  for (let k = 0; k < 4; k++) {
    const ang = ((k + 0.37) / 4) * Math.PI * 2;
    const mid = crushR * (0.28 + unit(mix(k, 17)) * 0.38);
    const cx = ox + Math.cos(ang) * mid;
    const cy = oy + Math.sin(ang) * mid;
    const s = crushR * (0.14 + unit(mix(k, 23)) * 0.1);
    const a = ang + 0.4;
    const b = ang + 2.3;
    const c = ang + 4.1;
    tris.push({
      id: `crush-chip-${k}`,
      points: polyPoints([
        { x: cx + Math.cos(a) * s, y: cy + Math.sin(a) * s },
        { x: cx + Math.cos(b) * s * 0.92, y: cy + Math.sin(b) * s * 0.92 },
        { x: cx + Math.cos(c) * s * 1.08, y: cy + Math.sin(c) * s * 1.08 },
      ]),
      fill: CRUSH_FILLS[(k + 1) % CRUSH_FILLS.length],
    });
  }
  return tris;
}

function toEdge(
  id: string,
  pts: MeshPt[],
  _delay: number,
  _grow: number,
  width: number,
  stroke: string,
  strokeOpacity: number,
  onPerimeter = false,
): MeshEdge {
  // Shared growClock: delay 0 / grow 1 for every vein. Call-site stagger is ignored.
  return {
    id,
    d: polylinePath(pts),
    length: polylineLength(pts),
    delay: 0,
    grow: 1,
    width,
    stroke,
    strokeOpacity,
    onPerimeter,
  };
}

/**
 * Planar mesh: origin = punch. Outer ring = screen rect (full cover).
 * Visible strokes = STRAIGHT radials from punch to the bezel (optional one jog).
 * Mesh ring chords exist for 24 faces only — they are not the crack look.
 */
export function buildGlassMesh(
  width: number,
  height: number,
  ox: number,
  oy: number,
): {
  edges: MeshEdge[];
  faces: MeshFace[];
  veinCount: number;
  concentricRings: number;
  crushTriangles: CrushTri[];
} {
  const origin: MeshPt = { x: ox, y: oy };
  const rim = rectBoundary(width, height, FACE_EXTRA_PER_EDGE);
  rim.sort(
    (a, b) => Math.atan2(a.y - oy, a.x - ox) - Math.atan2(b.y - oy, b.x - ox),
  );
  const n = rim.length;
  const minSide = Math.min(width, height);
  const crushR = minSide * CRUSH_RADIUS_RATIO;
  const innerPx = minSide * 0.168;
  const inner: MeshPt[] = rim.map((p) => {
    const ray = hypot(origin, p);
    const t = Math.min(0.4, Math.max(0.1, innerPx / Math.max(ray, 1)));
    return lerp(origin, p, t);
  });

  const radInner: MeshPt[][] = [];
  const radOuter: MeshPt[][] = [];
  const ringInner: MeshPt[][] = [];

  for (let i = 0; i < n; i++) {
    const a0 = inner[i];
    const a1 = inner[(i + 1) % n];
    const b0 = rim[i];
    radInner.push(radialPolyline(origin, a0, mix(i, 101), true));
    radOuter.push(radialPolyline(a0, b0, mix(i, 202), false));
    ringInner.push([a0, a1]);
  }

  const edges: MeshEdge[] = [];
  const faces: MeshFace[] = [];

  for (let i = 0; i < n; i++) {
    const rayLen = Math.max(hypot(origin, rim[i]), 1);
    const innerDist = hypot(origin, inner[i]) / rayLen;
    const innerW = widthByPunchDist(
      innerDist,
      CRACK_STROKE_MAIN * (1.55 + 0.35 * unit(mix(i, 41))),
      CRACK_STROKE_MAIN * (0.72 + 0.18 * unit(mix(i, 47))),
    );
    const outerW = widthByPunchDist(
      0.55 + innerDist * 0.45,
      CRACK_STROKE_MAIN * (0.55 + 0.2 * unit(mix(i, 53))),
      CRACK_STROKE_BRANCH * (0.85 + 0.3 * unit(mix(i, 59))),
    );

    const crushFrac = Math.min(0.1, crushR / rayLen);
    const crushPt = lerp(origin, rim[i], crushFrac);
    edges.push(
      toEdge(
        `crush-ray-${i}`,
        radialPolyline(origin, crushPt, mix(i, 55), false),
        0,
        1,
        CRACK_STROKE_MAIN * (1.45 + 0.35 * unit(mix(i, 61))),
        CRACK_VEIN,
        0.9 + 0.08 * unit(mix(i, 67)),
      ),
    );

    const innerRay = toEdge(
      `ray-in-${i}`,
      radInner[i],
      0,
      1,
      innerW,
      CRACK_VEIN,
      0.78 + 0.14 * unit(mix(i, 71)),
    );
    innerRay.growLive = i < GROW_JS_PROPS_MAX;
    edges.push(innerRay);
    edges.push(
      toEdge(
        `ray-out-${i}`,
        radOuter[i],
        0,
        1,
        outerW,
        CRACK_OUTER,
        0.52 + 0.18 * unit(mix(i, 73)),
      ),
    );

    const innerFace = inflateFromCentroid(
      chainPolys([
        radInner[i],
        ringInner[i],
        reversePoly(radInner[(i + 1) % n]),
      ]),
      FACE_SEAM_OVERLAP,
    );
    const innerC = centroid(innerFace);
    faces.push({
      id: `f0-${i}`,
      points: polyPoints(innerFace),
      cx: innerC.x,
      cy: innerC.y,
      delay: 0,
      fill: FACE_FILLS[2],
      specBoost: 1,
      fillOpacity: 1,
    });

    const b0 = rim[i];
    const b1 = rim[(i + 1) % n];
    const outerFace = inflateFromCentroid(
      chainPolys([
        radOuter[i],
        [b0, b1],
        reversePoly(radOuter[(i + 1) % n]),
        reversePoly(ringInner[i]),
      ]),
      FACE_SEAM_OVERLAP,
    );
    const outerC = centroid(outerFace);
    faces.push({
      id: `f1-${i}`,
      points: polyPoints(outerFace),
      cx: outerC.x,
      cy: outerC.y,
      delay: 0,
      fill: FACE_FILLS[5],
      specBoost: 0.6,
      fillOpacity: 1,
    });
  }

  let maxFaceR = 1;
  for (const face of faces) {
    maxFaceR = Math.max(maxFaceR, Math.hypot(face.cx - ox, face.cy - oy));
  }
  for (const face of faces) {
    const ice = iceFillFromPunch(face.cx, face.cy, ox, oy, maxFaceR);
    face.fill = ice.fill;
    face.specBoost = ice.specBoost;
    face.fillOpacity = 1;
    face.delay = 0;
  }

  // Extra radials: uniform angle (no left pile). SNAP at clock 1 — never growLive.
  const vn = VEIN_ANGULAR_SAMPLES;
  for (let i = 0; i < vn; i++) {
    const ang = (i / vn) * Math.PI * 2;
    const r0 = rayHitRect(ox, oy, ang, width, height);
    const rayLen = Math.max(hypot(origin, r0), 1);
    const a0 = lerp(origin, r0, 0.28);
    const nearW = widthByPunchDist(
      hypot(origin, a0) / rayLen,
      CRACK_STROKE_MAIN * (1.35 + 0.35 * unit(mix(i, 821))),
      CRACK_STROKE_MAIN * (0.55 + 0.2 * unit(mix(i, 823))),
    );
    const farW = widthByPunchDist(
      0.82,
      CRACK_STROKE_BRANCH * (1.1 + 0.35 * unit(mix(i, 827))),
      CRACK_STROKE_BRANCH * (0.7 + 0.35 * unit(mix(i, 829))),
    );
    edges.push(
      toEdge(
        `vein-a-${i}`,
        radialPolyline(origin, a0, mix(i, 801), true),
        0,
        1,
        nearW,
        CRACK_VEIN,
        0.7 + 0.18 * unit(mix(i, 831)),
      ),
    );
    edges.push(
      toEdge(
        `vein-b-${i}`,
        radialPolyline(a0, r0, mix(i, 811), false),
        0,
        1,
        farW,
        CRACK_BRANCH,
        0.38 + 0.2 * unit(mix(i, 833)),
      ),
    );
  }

  for (let j = 0; j < VEIN_INNER_EXTRA; j++) {
    const ang = ((j + 0.5) / VEIN_INNER_EXTRA) * Math.PI * 2;
    const r0 = rayHitRect(ox, oy, ang, width, height);
    const a0 = lerp(origin, r0, 0.22);
    const nearW = CRACK_STROKE_MAIN * (1.15 + 0.35 * unit(mix(j, 91)));
    edges.push(
      toEdge(
        `vein-a-x-${j}`,
        radialPolyline(origin, a0, mix(j, 901), false),
        0,
        1,
        nearW,
        CRACK_VEIN,
        0.62 + 0.2 * unit(mix(j, 93)),
      ),
    );
  }

  const veinCount = edges.filter((e) => !e.onPerimeter).length;
  return {
    edges,
    faces,
    veinCount,
    concentricRings: CONCENTRIC_RINGS,
    crushTriangles: buildCrushTriangles(ox, oy, crushR),
  };
}
