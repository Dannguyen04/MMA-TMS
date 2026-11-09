"use client";

import { Camera, CameraOff, CircleStop, FlaskConical, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { preconnect } from "react-dom";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useT } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Spinner } from "@/components/ui/spinner";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

/* ─── MediaPipe Pose (loaded on demand from the CDN) ──────────────────────── */

interface Landmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
}

interface PoseResults {
    poseLandmarks?: Landmark[];
}

interface PoseSolution {
    setOptions(options: { modelComplexity: 0 | 1 | 2; smoothLandmarks: boolean; enableSegmentation: boolean; minDetectionConfidence: number; minTrackingConfidence: number }): void;
    onResults(listener: (results: PoseResults) => void): void;
    send(input: { image: HTMLVideoElement }): Promise<void>;
    close(): Promise<void>;
}

declare global {
    interface Window {
        Pose?: new (config: { locateFile: (file: string) => string }) => PoseSolution;
        POSE_CONNECTIONS?: [number, number][];
    }
}

/** Pinned so the script and its model files always match. */
const POSE_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404";

/** Warms up the CDN connection as soon as the user shows intent to start the camera. */
function preconnectPoseCdn() {
    preconnect(new URL(POSE_CDN).origin, { crossOrigin: "anonymous" });
}

function loadPoseScript(downloadFailed: string): Promise<void> {
    if (window.Pose) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const src = `${POSE_CDN}/pose.js`;
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
        const script = existing ?? document.createElement("script");
        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener("error", () => reject(new Error(downloadFailed)), { once: true });
        if (!existing) {
            script.src = src;
            script.crossOrigin = "anonymous";
            document.body.appendChild(script);
        }
    });
}

/* ─── Kick state machine ──────────────────────────────────────────────────── */

type KickPhase = "guard" | "chambering" | "extending" | "recovering";
type KickingLeg = "right" | "left";

const LEG_OPTIONS: { value: KickingLeg; label: MessageKey }[] = [
    { value: "right", label: "screens.video.live.rightLeg" as MessageKey },
    { value: "left", label: "screens.video.live.leftLeg" as MessageKey },
];

/** Overlay colours from design tokens. Read once per theme instead of on every pose frame. */
interface OverlayPalette {
    bone: string;
    limb: string;
}

function readOverlayPalette(element: Element): OverlayPalette {
    const styles = getComputedStyle(element);
    return { bone: styles.getPropertyValue("--nav-fg-active").trim(), limb: styles.getPropertyValue("--chart-4").trim() };
}


/** MediaPipe landmark indices: hip, knee, ankle. */
const LEG_LANDMARKS: Record<KickingLeg, [number, number, number]> = { right: [24, 26, 28], left: [23, 25, 27] };

interface KickResult {
    id: number;
    score: number;
    grade: Grade;
    chamberDeg: number;
    extensionDeg: number;
    fast: boolean;
}

function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    const angle = Math.abs((radians * 180) / Math.PI);
    return angle > 180 ? 360 - angle : angle;
}

type Grade = "excellent" | "good" | "fair" | "needsWork";

function grade(score: number): Grade {
    if (score >= 90) return "excellent";
    if (score >= 75) return "good";
    if (score >= 55) return "fair";
    return "needsWork";
}

function gradeLabel(t: Translator, value: Grade): string {
    return t(`screens.video.live.grade.${value}`);
}

type CameraState =
    | { status: "idle" }
    | { status: "starting"; message: string }
    | { status: "running" }
    | { status: "error"; title: string; message: string };

/**
 * Real-time kick form check in the browser: MediaPipe Pose on the webcam feed with a knee-angle HUD
 * and a scored kick history. Beta — runs entirely on the device; nothing is recorded or uploaded.
 */
export function LiveFormCheck() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const poseRef = useRef<PoseSolution | null>(null);
    const frameRef = useRef(0);
    const legRef = useRef<KickingLeg>("right");
    const machineRef = useRef({ phase: "guard" as KickPhase, minChamber: 180, maxExtension: 0, lastAnkle: null as Landmark | null, lastTime: 0, peakSpeed: 0, recoverTimer: 0 });
    const smoothRef = useRef<Record<number, Landmark>>({});
    const kickCounter = useRef(0);
    const paletteRef = useRef<OverlayPalette | null>(null);
    /** Updated on every pose frame; the HUD repaints from it at most ten times a second. */
    const kneeAngleRef = useRef<number | null>(null);
    const t = useT();
    const legOptions = LEG_OPTIONS.map((option) => ({ ...option, label: t(option.label) }));

    const [camera, setCamera] = useState<CameraState>({ status: "idle" });
    const [leg, setLeg] = useState<KickingLeg>("right");
    const [phase, setPhase] = useState<KickPhase>("guard");
    const [feedback, setFeedback] = useState(() => t("screens.video.live.intro"));
    const [history, setHistory] = useState<KickResult[]>([]);

    const stop = () => {
        cancelAnimationFrame(frameRef.current);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        poseRef.current?.close().catch(() => undefined);
        poseRef.current = null;
        window.clearTimeout(machineRef.current.recoverTimer);
    };

    useEffect(() => stop, []);

    useEffect(() => {
        const themeObserver = new MutationObserver(() => {
            paletteRef.current = null;
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        return () => themeObserver.disconnect();
    }, []);

    useEffect(() => {
        legRef.current = leg;
        smoothRef.current = {};
    }, [leg]);

    const smooth = (point: Landmark, index: number): Landmark => {
        const previous = smoothRef.current[index];
        const alpha = 0.35;
        const next = previous
            ? { x: alpha * point.x + (1 - alpha) * previous.x, y: alpha * point.y + (1 - alpha) * previous.y, z: alpha * point.z + (1 - alpha) * previous.z }
            : { x: point.x, y: point.y, z: point.z };
        smoothRef.current[index] = next;
        return next;
    };

    const evaluate = (angle: number, ankle: Landmark) => {
        const machine = machineRef.current;
        const now = performance.now();
        let speed = 0;
        if (machine.lastAnkle) {
            const dt = now - machine.lastTime || 1;
            speed = (Math.hypot(ankle.x - machine.lastAnkle.x, ankle.y - machine.lastAnkle.y) / dt) * 1000;
        }
        machine.lastAnkle = ankle;
        machine.lastTime = now;
        machine.peakSpeed = Math.max(machine.peakSpeed, speed);

        if (machine.phase === "guard" && angle < 120) {
            Object.assign(machine, { phase: "chambering", minChamber: angle, maxExtension: 0, peakSpeed: 0 });
            setPhase("chambering");
            setFeedback(t("screens.video.live.kneeUp"));
        }
        if (machine.phase === "chambering") {
            machine.minChamber = Math.min(machine.minChamber, angle);
            if (angle > machine.minChamber + 15 && speed > 0.4) {
                machine.phase = "extending";
                setPhase("extending");
                setFeedback(t("screens.video.live.extending"));
            } else if (angle > 165) {
                machine.phase = "guard";
                setPhase("guard");
            }
        }
        if (machine.phase === "extending") {
            machine.maxExtension = Math.max(machine.maxExtension, angle);
            if (angle < machine.maxExtension - 15) {
                machine.phase = "recovering";
                setPhase("recovering");
                let score = 100;
                const notes: string[] = [];
                if (machine.minChamber > 75) {
                    score -= 25;
                    notes.push(t("screens.video.live.noteChamber", { deg: Math.round(machine.minChamber) }));
                }
                if (machine.maxExtension < 140) {
                    score -= 30;
                    notes.push(t("screens.video.live.noteExtend", { deg: Math.round(machine.maxExtension) }));
                }
                const fast = machine.peakSpeed >= 0.8;
                if (!fast) {
                    score -= 20;
                    notes.push(t("screens.video.live.noteFaster"));
                }
                score = Math.max(0, score);
                kickCounter.current += 1;
                setHistory((items) =>
                    [{ id: kickCounter.current, score, grade: grade(score), chamberDeg: Math.round(machine.minChamber), extensionDeg: Math.round(machine.maxExtension), fast }, ...items].slice(0, 5),
                );
                const kick = { grade: gradeLabel(t, grade(score)), score };
                setFeedback(notes.length === 0 ? t("screens.video.live.kickPerfect", kick) : t("screens.video.live.kickNotes", { ...kick, notes: notes.join(", ") }));
            }
        }
        if (machine.phase === "recovering" && (angle > 155 || angle < 60)) {
            window.clearTimeout(machine.recoverTimer);
            machine.recoverTimer = window.setTimeout(() => {
                if (machineRef.current.phase === "recovering") {
                    machineRef.current.phase = "guard";
                    setPhase("guard");
                }
            }, 1200);
        }
    };

    const draw = (results: PoseResults) => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !video || !ctx) return;
        const palette = (paletteRef.current ??= readOverlayPalette(canvas));
        // Assigning a canvas dimension clears and reallocates it, so only do it when the feed size changes.
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const landmarks = results.poseLandmarks;
        if (!landmarks) return;

        const px = (point: Landmark) => ({ x: point.x * canvas.width, y: point.y * canvas.height });
        ctx.lineCap = "round";
        ctx.strokeStyle = palette.bone;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = Math.max(2, canvas.height * 0.006);
        for (const [a, b] of window.POSE_CONNECTIONS ?? []) {
            if (a < 11 || b < 11) continue;
            const from = px(landmarks[a]);
            const to = px(landmarks[b]);
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        const [hipIndex, kneeIndex, ankleIndex] = LEG_LANDMARKS[legRef.current];
        const hip = smooth(landmarks[hipIndex], hipIndex);
        const knee = smooth(landmarks[kneeIndex], kneeIndex);
        const ankle = smooth(landmarks[ankleIndex], ankleIndex);
        const angle = angleDeg(hip, knee, ankle);
        kneeAngleRef.current = Math.round(angle);
        evaluate(angle, ankle);

        const k = px(knee);
        ctx.strokeStyle = palette.limb;
        ctx.lineWidth = Math.max(3, canvas.height * 0.008);
        [px(hip), k, px(ankle)].reduce((from, to) => {
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            return to;
        });
        ctx.beginPath();
        ctx.arc(k.x, k.y, canvas.height * 0.05, 0, (angle * Math.PI) / 180);
        ctx.stroke();
    };

    const start = async () => {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
            setCamera({ status: "error", title: t("screens.video.live.noCameraTitle"), message: t("screens.video.live.noCameraDesc") });
            return;
        }
        try {
            setCamera({ status: "starting", message: t("screens.video.live.askingPermission") });
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false });
            streamRef.current = stream;
            const video = videoRef.current;
            if (!video) return;
            video.srcObject = stream;
            await video.play();

            setCamera({ status: "starting", message: t("screens.video.live.loadingModel") });
            await loadPoseScript(t("screens.video.live.poseDownloadFailed"));
            if (!window.Pose) throw new Error(t("screens.video.live.poseStartFailed"));
            const pose = new window.Pose({ locateFile: (file) => `${POSE_CDN}/${file}` });
            pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
            pose.onResults(draw);
            poseRef.current = pose;

            let busy = false;
            const loop = async () => {
                if (!poseRef.current || !streamRef.current) return;
                if (!busy && video.readyState >= 2) {
                    busy = true;
                    await poseRef.current.send({ image: video }).catch(() => undefined);
                    busy = false;
                }
                frameRef.current = requestAnimationFrame(loop);
            };
            frameRef.current = requestAnimationFrame(loop);
            setCamera({ status: "running" });
        } catch (error) {
            stop();
            const name = error instanceof DOMException ? error.name : "";
            if (name === "NotAllowedError") {
                setCamera({ status: "error", title: t("screens.video.live.blockedTitle"), message: t("screens.video.live.blockedDesc") });
            } else if (name === "NotFoundError" || name === "OverconstrainedError") {
                setCamera({ status: "error", title: t("screens.video.live.notFoundTitle"), message: t("screens.video.live.notFoundDesc") });
            } else if (name === "NotReadableError") {
                setCamera({ status: "error", title: t("screens.video.live.busyTitle"), message: t("screens.video.live.busyDesc") });
            } else {
                setCamera({ status: "error", title: t("screens.video.live.failedTitle"), message: error instanceof Error ? error.message : t("screens.video.live.failedDesc") });
            }
        }
    };

    const stopCamera = () => {
        stop();
        setCamera({ status: "idle" });
        setPhase("guard");
        kneeAngleRef.current = null;
    };

    const running = camera.status === "running";
    const phaseTone = phase === "guard" ? "bg-nav-surface/90 text-nav-fg-active ring-nav-border" : "bg-warning-soft text-warning-fg ring-warning-border";

    return (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section aria-label={t("screens.video.live.camera")} className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-card">
                <div className="relative aspect-video w-full bg-nav-bg">
                    <video ref={videoRef} playsInline muted className="hidden" />
                    <canvas ref={canvasRef} aria-hidden className={cn("absolute inset-0 size-full -scale-x-100 object-contain", !running && "invisible")} />

                    {!running && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
                            {camera.status === "starting" ? (
                                <p role="status" className="flex items-center gap-2 text-sm font-medium text-nav-fg-active">
                                    <Spinner className="size-5" />
                                    {camera.message}
                                </p>
                            ) : camera.status === "error" ? (
                                <div role="alert" className="flex max-w-md flex-col items-center gap-3">
                                    <span aria-hidden className="octagon flex size-12 items-center justify-center bg-danger-soft text-danger-fg">
                                        <CameraOff className="size-5" />
                                    </span>
                                    <p className="text-base font-semibold text-nav-fg-active">{camera.title}</p>
                                    <p className="text-sm text-nav-fg">{camera.message}</p>
                                    <Button onClick={start} onPointerEnter={preconnectPoseCdn} onFocus={preconnectPoseCdn}>
                                        <Camera aria-hidden />
                                        {t("screens.video.tryAgain")}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex max-w-md flex-col items-center gap-3">
                                    <span aria-hidden className="octagon flex size-14 items-center justify-center bg-nav-surface text-nav-fg-active">
                                        <Camera className="size-6" />
                                    </span>
                                    <p className="text-base font-semibold text-nav-fg-active">{t("screens.video.live.checkTitle")}</p>
                                    <p className="text-sm text-nav-fg">{t("screens.video.live.checkDesc")}</p>
                                    <Button size="lg" onClick={start} onPointerEnter={preconnectPoseCdn} onFocus={preconnectPoseCdn}>
                                        <Camera aria-hidden />
                                        {t("screens.video.live.startCamera")}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {running && (
                        <>
                            <span aria-live="polite" className={cn("absolute top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold ring-1", phaseTone)}>
                                <span aria-hidden className="size-2 rounded-full bg-current" />
                                {t(`screens.video.live.phase.${phase}`)}
                            </span>
                            <KneeReadout angleRef={kneeAngleRef} label={t("screens.video.live.knee")} />
                            <p className="absolute inset-x-3 bottom-3 mx-auto w-fit max-w-[92%] rounded-md bg-nav-surface/90 px-3 py-2 text-center text-sm text-nav-fg-active ring-1 ring-nav-border">
                                {feedback}
                            </p>
                        </>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
                    <SegmentedControl label={t("screens.video.live.kickingLeg")} options={legOptions} value={leg} onChange={setLeg} size="md" />
                    <p className="flex items-center gap-1.5 text-[13px] text-fg-muted">
                        <ShieldCheck aria-hidden className="size-4 text-success-fg" />
                        {t("screens.video.live.onDevice")}
                    </p>
                    {running && (
                        <Button variant="secondary" className="ml-auto" onClick={stopCamera}>
                            <CircleStop aria-hidden />
                            {t("screens.video.live.stopCamera")}
                        </Button>
                    )}
                </div>
            </section>

            <div className="flex min-w-0 flex-col gap-4">
                <Card>
                    <CardHeader
                        title={t("screens.video.live.history")}
                        description={t("screens.video.live.historyDesc")}
                        action={
                            <Badge tone="info" icon={FlaskConical} size="sm">
                                {t("screens.video.page.beta")}
                            </Badge>
                        }
                    />
                    <CardContent>
                        {history.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-fg-muted">{t("screens.video.live.historyEmpty")}</p>
                        ) : (
                            <ol className="flex flex-col divide-y divide-border" aria-live="polite">
                                {history.map((kick) => (
                                    <li key={kick.id} className="flex items-center justify-between gap-3 py-2.5">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-fg">
                                                {t("screens.video.live.kick", { id: kick.id, grade: gradeLabel(t, kick.grade) })}
                                            </p>
                                            <p className="text-xs text-fg-muted">
                                                {t("screens.video.live.kickFacts", {
                                                    chamber: kick.chamberDeg,
                                                    extension: kick.extensionDeg,
                                                    speed: kick.fast ? t("screens.video.live.goodSpeed") : t("screens.video.live.slow"),
                                                })}
                                            </p>
                                        </div>
                                        <span className="text-lg font-semibold text-fg tabular-nums">{kick.score}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </CardContent>
                </Card>
                <InlineNote icon={TriangleAlert} tone="warning">
                    {t("screens.video.live.betaNote")}
                </InlineNote>
            </div>
        </div>
    );
}

/** Knee angle HUD. Reads the pose loop's ref ten times a second so camera frames never re-render the page. */
function KneeReadout({ angleRef, label }: { angleRef: RefObject<number | null>; label: string }) {
    const [angle, setAngle] = useState<number | null>(null);

    useEffect(() => {
        const timer = window.setInterval(() => setAngle(angleRef.current), 100);
        return () => window.clearInterval(timer);
    }, [angleRef]);

    return (
        <div className="absolute top-1/2 left-3 -translate-y-1/2 rounded-lg bg-nav-surface/90 px-3 py-2 text-center ring-1 ring-nav-border">
            <p className="text-[11px] font-medium tracking-wide text-nav-fg uppercase">{label}</p>
            <p className="text-2xl font-semibold text-nav-fg-active tabular-nums">{angle === null ? "—" : `${angle}°`}</p>
        </div>
    );
}
