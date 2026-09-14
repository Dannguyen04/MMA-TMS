import type { PoseKeypoint, StrikeType } from "@/lib/domain/types";
import { isVisible, KEYPOINT, SKELETON_EDGES } from "@/lib/video/skeleton";

/**
 * Canvas drawing for the pose stage. Colours are read from design tokens at runtime so the
 * overlay follows the theme; the stage itself uses the always-dark "cage" navigation tokens.
 */

export interface StagePalette {
    font: string;
    mat: string;
    matRaised: string;
    matLine: string;
    bone: string;
    joint: string;
    muted: string;
    warning: string;
    strike: Record<StrikeType, string>;
}

const TOKEN_FALLBACK = "currentColor";

export function readStagePalette(element: Element): StagePalette {
    const styles = getComputedStyle(element);
    const token = (name: string) => styles.getPropertyValue(name).trim() || TOKEN_FALLBACK;
    return {
        font: styles.fontFamily || "sans-serif",
        mat: token("--nav-bg"),
        matRaised: token("--nav-surface"),
        matLine: token("--nav-border"),
        bone: token("--nav-fg-active"),
        joint: token("--nav-accent"),
        muted: token("--nav-fg"),
        warning: token("--warning-solid"),
        strike: { jab: token("--chart-1"), cross: token("--chart-2"), hook: token("--chart-3"), kick: token("--chart-4") },
    };
}

/** Where normalised keypoints land on the canvas (the letterboxed video area). */
export interface StageRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function project(point: Pick<PoseKeypoint, "x" | "y">, rect: StageRect): { x: number; y: number } {
    return { x: rect.x + point.x * rect.width, y: rect.y + point.y * rect.height };
}

/** Dark mat with subtle octagon floor lines for pose reconstruction mode. */
export function drawMat(ctx: CanvasRenderingContext2D, width: number, height: number, palette: StagePalette): void {
    ctx.fillStyle = palette.mat;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.47, height * 0.62, height * 0.05, width * 0.47, height * 0.62, height * 0.75);
    glow.addColorStop(0, palette.matRaised);
    glow.addColorStop(1, palette.mat);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.47;
    const cy = height * 0.84;
    const octagon = (rx: number, ry: number) => {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = Math.PI / 8 + (i * Math.PI) / 4;
            const x = cx + Math.cos(angle) * rx;
            const y = cy + Math.sin(angle) * ry;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
    };

    ctx.save();
    ctx.lineWidth = Math.max(1, height * 0.004);
    ctx.strokeStyle = palette.matLine;
    ctx.globalAlpha = 0.9;
    octagon(width * 0.46, height * 0.15);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    octagon(width * 0.25, height * 0.08);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 8; i++) {
        const angle = Math.PI / 8 + (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * width * 0.25, cy + Math.sin(angle) * height * 0.08);
        ctx.lineTo(cx + Math.cos(angle) * width * 0.46, cy + Math.sin(angle) * height * 0.15);
        ctx.stroke();
    }
    ctx.restore();
}

export interface SkeletonStyle {
    palette: StagePalette;
    /** Indices [root, joint, end] of the striking limb. */
    activeChain: readonly number[] | null;
    activeColor: string | null;
    /** Low-confidence strike: dashed warning colour on the active limb. */
    activeLowConfidence: boolean;
    /** Tracking lost: the whole figure is faded and dashed. */
    faded: boolean;
    /** Soft ground shadow (reconstruction mode only). */
    shadow: boolean;
}

export function drawSkeleton(ctx: CanvasRenderingContext2D, keypoints: PoseKeypoint[], rect: StageRect, style: SkeletonStyle): void {
    if (keypoints.length === 0) return;
    const { palette } = style;
    const unit = rect.height;
    const bone = Math.max(2, unit * 0.011);
    const px = (index: number) => project(keypoints[index], rect);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (style.faded) {
        ctx.globalAlpha = 0.28;
        ctx.setLineDash([bone * 1.5, bone * 1.5]);
    }

    if (style.shadow && isVisible(keypoints[KEYPOINT.leftAnkle]) && isVisible(keypoints[KEYPOINT.rightAnkle])) {
        const left = px(KEYPOINT.leftAnkle);
        const right = px(KEYPOINT.rightAnkle);
        ctx.save();
        ctx.globalAlpha = style.faded ? 0.1 : 0.35;
        ctx.fillStyle = palette.matLine;
        ctx.beginPath();
        ctx.ellipse((left.x + right.x) / 2, Math.max(left.y, right.y) + unit * 0.012, Math.abs(left.x - right.x) / 2 + unit * 0.08, unit * 0.022, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    const active = new Set(style.activeChain ?? []);
    for (const [a, b] of SKELETON_EDGES) {
        if (!isVisible(keypoints[a]) || !isVisible(keypoints[b])) continue;
        const isActive = active.has(a) && active.has(b) && style.activeColor !== null;
        const from = px(a);
        const to = px(b);
        ctx.save();
        if (isActive) {
            ctx.strokeStyle = style.activeLowConfidence ? palette.warning : (style.activeColor ?? palette.bone);
            ctx.lineWidth = bone * 1.7;
            if (style.activeLowConfidence) ctx.setLineDash([bone * 1.6, bone * 1.2]);
        } else {
            ctx.strokeStyle = palette.bone;
            ctx.globalAlpha *= 0.88;
            ctx.lineWidth = bone;
        }
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();
    }

    // Head: a ring around the face keypoints.
    const face = [KEYPOINT.nose, KEYPOINT.leftEye, KEYPOINT.rightEye, KEYPOINT.leftEar, KEYPOINT.rightEar].filter((i) => isVisible(keypoints[i]));
    if (face.length > 0) {
        const points = face.map(px);
        const hx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
        const hy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
        const headRadius = unit * 0.042;
        ctx.strokeStyle = palette.bone;
        ctx.lineWidth = bone;
        if (isVisible(keypoints[KEYPOINT.leftShoulder]) && isVisible(keypoints[KEYPOINT.rightShoulder])) {
            const left = px(KEYPOINT.leftShoulder);
            const right = px(KEYPOINT.rightShoulder);
            const neck = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
            const distance = Math.hypot(hx - neck.x, hy - neck.y);
            if (distance > headRadius) {
                ctx.beginPath();
                ctx.moveTo(neck.x, neck.y);
                ctx.lineTo(hx - ((hx - neck.x) / distance) * headRadius, hy - ((hy - neck.y) / distance) * headRadius);
                ctx.stroke();
            }
        }
        ctx.beginPath();
        ctx.arc(hx, hy, headRadius, 0, Math.PI * 2);
        ctx.stroke();
    }

    const radius = Math.max(2.5, unit * 0.0085);
    for (let i = KEYPOINT.leftShoulder; i < keypoints.length; i++) {
        if (!isVisible(keypoints[i])) continue;
        const point = px(i);
        ctx.beginPath();
        ctx.arc(point.x, point.y, active.has(i) ? radius * 1.35 : radius, 0, Math.PI * 2);
        ctx.fillStyle = active.has(i) && style.activeColor ? (style.activeLowConfidence ? palette.warning : style.activeColor) : palette.joint;
        ctx.fill();
        ctx.lineWidth = Math.max(1, radius * 0.45);
        ctx.strokeStyle = palette.mat;
        ctx.setLineDash([]);
        ctx.stroke();
    }
    ctx.restore();
}

/** Fading path of the striking wrist or ankle. Oldest point first. */
export function drawTrail(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], rect: StageRect, color: string): void {
    if (points.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    for (let i = 1; i < points.length; i++) {
        const from = project(points[i - 1], rect);
        const to = project(points[i], rect);
        ctx.globalAlpha = (i / points.length) * 0.85;
        ctx.lineWidth = Math.max(1.5, rect.height * 0.004 + (i / points.length) * rect.height * 0.008);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    }
    ctx.restore();
}

/** Arc between the two bones meeting at a joint, with the angle in degrees. */
export function drawJointAngle(
    ctx: CanvasRenderingContext2D,
    joint: PoseKeypoint,
    root: PoseKeypoint,
    end: PoseKeypoint,
    angleDeg: number,
    rect: StageRect,
    color: string,
    palette: StagePalette,
): void {
    const j = project(joint, rect);
    const r = project(root, rect);
    const e = project(end, rect);
    const a1 = Math.atan2(r.y - j.y, r.x - j.x);
    const a2 = Math.atan2(e.y - j.y, e.x - j.x);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const radius = rect.height * 0.05;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(j.x, j.y);
    ctx.arc(j.x, j.y, radius, a1, a1 + delta, delta < 0);
    ctx.closePath();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(j.x, j.y, radius, a1, a1 + delta, delta < 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, rect.height * 0.005);
    ctx.stroke();

    const mid = a1 + delta / 2;
    const label = `${Math.round(angleDeg)}°`;
    const fontSize = Math.max(11, Math.round(rect.height * 0.034));
    ctx.font = `600 ${fontSize}px ${palette.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tx = j.x - Math.cos(mid) * radius * 1.9;
    const ty = j.y - Math.sin(mid) * radius * 1.9;
    ctx.lineWidth = Math.max(3, fontSize * 0.3);
    ctx.strokeStyle = palette.mat;
    ctx.strokeText(label, tx, ty);
    ctx.fillStyle = palette.bone;
    ctx.fillText(label, tx, ty);
    ctx.restore();
}
