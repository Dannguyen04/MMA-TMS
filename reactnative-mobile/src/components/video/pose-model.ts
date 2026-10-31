/**
 * Worker result (GET /jobs/:id/result) — only the fields the phone draws.
 * Shape follows python-worker/process_video.py and the web parser
 * (nextjs-frontend/src/lib/api/worker-result.ts). Parsing is lenient: a bad
 * row is dropped instead of failing the whole result.
 */

export type Keypoint = { x: number; y: number; conf: number };
export type PoseFrame = { timeMs: number; keypoints: Keypoint[] };

export type ResultFinding = {
  id: string;
  actionId: string | null;
  title: string;
  description: string;
  severity: "positive" | "info" | "warning" | "critical";
  confidence: number;
  timeMs: number;
  recommendation: string;
};

export type ResultStrike = {
  /** `actions[].id` when the worker persisted actions; reviews need it. */
  actionId: string | null;
  family: "punch" | "kick" | "other";
  technique: string;
  side: "left" | "right" | "unknown";
  startMs: number;
  impactMs: number | null;
  endMs: number;
  score: number | null;
  confidence: number | null;
  peakSpeed: number | null;
  angle: number | null;
  guardKept: boolean | null;
};

export type EvidenceWindow = { id: string; startMs: number; endMs: number; sampleCount: number };

export type MovementEvidence = {
  status: "review_ready" | "limited" | "recapture";
  usableFrames: number;
  totalFrames: number;
  guidance: { code: string; message: string }[];
  windows: EvidenceWindow[];
};

export type WorkerResult = {
  fps: number;
  durationMs: number;
  width: number | null;
  height: number | null;
  frames: PoseFrame[];
  strikes: ResultStrike[];
  findings: ResultFinding[];
  movementEvidence: MovementEvidence | null;
  avgScore: number | null;
};

/** COCO-17 keypoint indices (YOLOv8-pose). */
export const KP = {
  nose: 0,
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
  leftKnee: 13,
  rightKnee: 14,
  leftAnkle: 15,
  rightAnkle: 16,
} as const;
export const KEYPOINT_COUNT = 17;
export const MIN_CONFIDENCE = 0.25;
/** A pose further than this from the playhead is not drawn. */
export const MAX_FRAME_GAP_MS = 120;

export const SKELETON_EDGES: readonly (readonly [number, number])[] = [
  [KP.leftShoulder, KP.rightShoulder],
  [KP.leftShoulder, KP.leftHip],
  [KP.rightShoulder, KP.rightHip],
  [KP.leftHip, KP.rightHip],
  [KP.leftShoulder, KP.leftElbow],
  [KP.leftElbow, KP.leftWrist],
  [KP.rightShoulder, KP.rightElbow],
  [KP.rightElbow, KP.rightWrist],
  [KP.leftHip, KP.leftKnee],
  [KP.leftKnee, KP.leftAnkle],
  [KP.rightHip, KP.rightKnee],
  [KP.rightKnee, KP.rightAnkle],
];

export type Limb = "left_arm" | "right_arm" | "left_leg" | "right_leg";
export const LIMB_CHAIN: Record<Limb, [number, number, number]> = {
  left_arm: [KP.leftShoulder, KP.leftElbow, KP.leftWrist],
  right_arm: [KP.rightShoulder, KP.rightElbow, KP.rightWrist],
  left_leg: [KP.leftHip, KP.leftKnee, KP.leftAnkle],
  right_leg: [KP.rightHip, KP.rightKnee, KP.rightAnkle],
};

export function limbOf(strike: ResultStrike): Limb | null {
  if (strike.side === "unknown") return null;
  return `${strike.side}_${strike.family === "kick" ? "leg" : "arm"}` as Limb;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const side = (v: unknown): ResultStrike["side"] => (v === "left" || v === "right" ? v : "unknown");

function parseFrames(raw: unknown[]): PoseFrame[] {
  const out: PoseFrame[] = [];
  for (const row of raw) {
    const f = obj(row);
    const timeMs = num(f?.timeMs);
    if (!f || timeMs == null) continue;
    const usable =
      f.isDiscontinuous !== true &&
      f.diagnosticOnly !== true &&
      (f.observationKind === undefined || f.observationKind === "fresh_detection");
    const points = arr(f.landmarks)
      .map((p) => {
        const o = obj(p);
        const x = num(o?.x);
        const y = num(o?.y);
        return x == null || y == null ? null : { x, y, conf: num(o?.conf) ?? 0 };
      })
      .filter((p): p is Keypoint => p !== null);
    out.push({ timeMs, keypoints: usable && points.length === KEYPOINT_COUNT ? points : [] });
  }
  return out.sort((a, b) => a.timeMs - b.timeMs);
}

function parseFinding(row: unknown): ResultFinding | null {
  const f = obj(row);
  const id = str(f?.id);
  const timeMs = num(f?.timeMs);
  if (!f || !id || timeMs == null) return null;
  const severity = f.severity === "positive" || f.severity === "warning" || f.severity === "critical" ? f.severity : "info";
  return {
    id,
    actionId: str(f.actionId),
    title: str(f.title) ?? "",
    description: str(f.description) ?? "",
    severity,
    confidence: num(f.confidence) ?? 0,
    timeMs,
    recommendation: str(f.recommendation) ?? "",
  };
}

function strikesFromActions(actions: unknown[]): ResultStrike[] {
  const out: ResultStrike[] = [];
  for (const row of actions) {
    const a = obj(row);
    const phases = obj(a?.phases);
    const start = num(phases?.startTimeMs);
    const end = num(phases?.endTimeMs);
    if (!a || start == null || end == null) continue;
    if (a.family === "non_strike") continue;
    const conf = obj(a.confidence);
    const metrics = obj(a.metrics);
    const metric = (key: string) => num(obj(metrics?.[key])?.value);
    out.push({
      actionId: str(a.id),
      family: a.family === "punch" ? "punch" : a.family === "kick" ? "kick" : "other",
      technique: str(a.technique) ?? "",
      side: side(a.attackingSide),
      startMs: start,
      impactMs: num(phases?.impactTimeMs) ?? num(phases?.peakTimeMs),
      endMs: end,
      score: num(obj(a.assessment)?.score),
      confidence: num(conf?.classification) ?? num(conf?.detection) ?? num(conf?.assessment),
      peakSpeed: metric("peakSpeed"),
      angle: metric("maxElbowAngle") ?? metric("maxExtensionAngle"),
      guardKept: null,
    });
  }
  return out;
}

function strikesFromLegacy(punches: unknown[], kicks: unknown[]): ResultStrike[] {
  const out: ResultStrike[] = [];
  for (const row of punches) {
    const p = obj(row);
    const start = num(p?.startTimeMs);
    const end = num(p?.endTimeMs);
    if (!p || start == null || end == null) continue;
    out.push({
      actionId: null,
      family: "punch",
      technique: (str(p.punchType) ?? "").toLowerCase(),
      side: side(p.arm),
      startMs: start,
      impactMs: num(p.impactTimeMs),
      endMs: end,
      score: num(p.score),
      confidence: null,
      peakSpeed: num(p.peakSpeed),
      angle: num(p.maxElbowAngle),
      guardKept: typeof p.guardPreserved === "boolean" ? p.guardPreserved : null,
    });
  }
  for (const row of kicks) {
    const k = obj(row);
    const start = num(k?.startTimeMs);
    const end = num(k?.endTimeMs);
    if (!k || start == null || end == null) continue;
    out.push({
      actionId: null,
      family: "kick",
      technique: "kick",
      side: "unknown",
      startMs: start,
      impactMs: null,
      endMs: end,
      score: num(k.score),
      confidence: null,
      peakSpeed: num(k.peakSpeed),
      angle: num(k.maxExtensionAngle),
      guardKept: null,
    });
  }
  return out;
}

function parseEvidence(raw: unknown): MovementEvidence | null {
  const m = obj(raw);
  if (!m) return null;
  const status = m.status === "review_ready" || m.status === "limited" || m.status === "recapture" ? m.status : null;
  if (!status) return null;
  const coverage = obj(m.coverage);
  return {
    status,
    usableFrames: num(coverage?.usableFrames) ?? 0,
    totalFrames: num(coverage?.totalFrames) ?? 0,
    guidance: arr(m.recordingGuidance)
      .map((g) => {
        const o = obj(g);
        const code = str(o?.code);
        const message = str(o?.message);
        return code && message ? { code, message } : null;
      })
      .filter((g): g is { code: string; message: string } => g !== null),
    windows: arr(m.windows)
      .map((w) => {
        const o = obj(w);
        const id = str(o?.id);
        const startMs = num(o?.startMs);
        const endMs = num(o?.endMs);
        return id && startMs != null && endMs != null ? { id, startMs, endMs, sampleCount: num(o?.sampleCount) ?? 0 } : null;
      })
      .filter((w): w is EvidenceWindow => w !== null),
  };
}

/** Returns null when the payload is not a worker result at all. */
export function parseWorkerResult(raw: unknown): WorkerResult | null {
  const root = obj(raw);
  const meta = obj(root?.meta);
  const durationMs = num(meta?.durationMs);
  if (!root || !meta || durationMs == null || !Array.isArray(root.frames)) return null;
  const actions = arr(root.actions);
  const strikes = actions.length > 0 ? strikesFromActions(actions) : strikesFromLegacy(arr(root.punches), arr(root.kicks));
  const nested = arr(root.punches).flatMap((p) => arr(obj(p)?.findings));
  const seen = new Set<string>();
  const findings = [...arr(root.findings), ...nested]
    .map(parseFinding)
    .filter((f): f is ResultFinding => {
      if (!f || seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    })
    .sort((a, b) => a.timeMs - b.timeMs);
  return {
    fps: num(meta.fps) ?? 30,
    durationMs,
    width: num(meta.imgWidth),
    height: num(meta.imgHeight),
    frames: parseFrames(root.frames),
    strikes: strikes.sort((a, b) => a.startMs - b.startMs),
    findings,
    movementEvidence: parseEvidence(root.movementEvidence),
    avgScore: num(obj(root.summary)?.avgScore),
  };
}

/** Last index with timeMs <= t, or -1. */
export function indexAtOrBefore(frames: { timeMs: number }[], t: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid]!.timeMs <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** Index of the pose to draw at `t`, or -1 when none is close enough. */
export function frameIndexAt(frames: PoseFrame[], t: number): number {
  if (frames.length === 0) return -1;
  const i = indexAtOrBefore(frames, t);
  if (i < 0) return frames[0]!.timeMs - t <= MAX_FRAME_GAP_MS ? 0 : -1;
  const next = Math.min(i + 1, frames.length - 1);
  const best = Math.abs(frames[i]!.timeMs - t) <= Math.abs(frames[next]!.timeMs - t) ? i : next;
  return Math.abs(frames[best]!.timeMs - t) < MAX_FRAME_GAP_MS ? best : -1;
}

export function strikeAt(strikes: ResultStrike[], t: number): ResultStrike | null {
  return strikes.find((s) => t >= s.startMs && t <= s.endMs) ?? null;
}

export function visible(p: Keypoint | undefined): p is Keypoint {
  return !!p && p.conf >= MIN_CONFIDENCE;
}

/** Angle at b in degrees; `aspect` = drawn width / height (x and y are normalised separately). */
export function jointAngle(a: Keypoint, b: Keypoint, c: Keypoint, aspect: number): number {
  const abx = (a.x - b.x) * aspect;
  const aby = a.y - b.y;
  const cbx = (c.x - b.x) * aspect;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

/** Letterboxed rect of a `contain`-fitted source inside a box. */
export function containRect(boxW: number, boxH: number, srcW: number | null, srcH: number | null) {
  if (!srcW || !srcH || boxW <= 0 || boxH <= 0) return { x: 0, y: 0, width: boxW, height: boxH };
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const width = srcW * scale;
  const height = srcH * scale;
  return { x: (boxW - width) / 2, y: (boxH - height) / 2, width, height };
}
