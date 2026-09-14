"use client";

import {
    ChevronLeft,
    ChevronRight,
    Keyboard,
    Pause,
    PersonStanding,
    Play,
    Ruler,
    ScanLine,
    StepBack,
    StepForward,
    Tag,
    TriangleAlert,
    UserCheck,
    Video as VideoIcon,
    Waypoints,
    type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { TECHNIQUE_COLOR } from "@/components/charts/colors";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tooltip } from "@/components/ui/tooltip";
import { isNeedsReview } from "@/lib/domain/ai-review";
import type { AIAnalysis, CameraAngle, PoseFrame, PoseKeypoint, Stance } from "@/lib/domain/types";
import { formatConfidence, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { byStart, detectionAt, eventsAt, nextDetection, previousDetection, reviewedStrikeLabel, strikeObservation } from "@/lib/video/analysis-nav";
import { indexAtOrBefore, jointAngleDeg, LIMB_CHAIN, nearestFrame } from "@/lib/video/skeleton";
import { createSyntheticPoseSampler } from "@/lib/video/synthetic-pose";
import { PLAYBACK_RATES, usePlayback, usePlaybackStore } from "./playback-store";
import { drawJointAngle, drawMat, drawSkeleton, drawTrail, readStagePalette, type StagePalette, type StageRect } from "./pose-canvas";

type OverlayKey = "skeleton" | "trail" | "angle" | "label";

const OVERLAYS: { key: OverlayKey; label: string; icon: LucideIcon }[] = [
    { key: "skeleton", label: "Skeleton", icon: PersonStanding },
    { key: "trail", label: "Trail", icon: Waypoints },
    { key: "angle", label: "Joint angle", icon: Ruler },
    { key: "label", label: "Strike label", icon: Tag },
];

const TRAIL_MS = 600;
const TRAIL_SAMPLES = 14;

const RATE_OPTIONS = PLAYBACK_RATES.map((rate) => ({ value: `${rate}` as const, label: `${rate}×` }));

export interface PosePlayerProps {
    analysis: AIAnalysis;
    stance: Stance;
    cameraAngle: CameraAngle;
    /** Stored footage (API mode). Without it the player shows the pose reconstruction. */
    sourceUrl: string | null;
    title: string;
    className?: string;
}

type PoseDataState = { status: "none" } | { status: "loading" } | { status: "ready"; frames: PoseFrame[] } | { status: "unavailable" };

/**
 * Video stage with a pose overlay: original footage when stored, otherwise an animated pose
 * reconstruction built from the analysis. Transport controls and shortcuts drive the shared playhead.
 */
export function PosePlayer({ analysis, stance, cameraAngle, sourceUrl, title, className }: PosePlayerProps) {
    const store = usePlaybackStore();
    const stageRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const dirtyRef = useRef(true);
    const paletteRef = useRef<StagePalette | null>(null);
    const [overlays, setOverlays] = useState<Record<OverlayKey, boolean>>({ skeleton: true, trail: true, angle: true, label: true });
    const overlaysRef = useRef(overlays);
    const [poseData, setPoseData] = useState<PoseDataState>(() => (sourceUrl && analysis.resultUrl ? { status: "loading" } : { status: "none" }));

    const { detections: analysisDetections, movementEvents, durationMs } = analysis;
    const detections = useMemo(() => byStart(analysisDetections), [analysisDetections]);
    const reconstruction = sourceUrl === null;
    // Only the reconstruction needs the synthetic fighter; review updates to findings keep the same sampler.
    const sampler = useMemo(
        () => (reconstruction ? createSyntheticPoseSampler({ detections: analysisDetections, movementEvents, durationMs }, stance, { cameraAngle }) : null),
        [reconstruction, analysisDetections, movementEvents, durationMs, stance, cameraAngle],
    );
    const frameMs = 1000 / (analysis.fps || 30);

    useEffect(() => {
        overlaysRef.current = overlays;
        dirtyRef.current = true;
    }, [overlays]);

    // Real pipeline: load the worker's pose frames for the overlay. The result parser (and its schema
    // library) is only downloaded here, so the mock reconstruction never loads it.
    useEffect(() => {
        const resultUrl = analysis.resultUrl;
        if (!sourceUrl || !resultUrl) return;
        let cancelled = false;
        const download = fetch(resultUrl).then((response): Promise<unknown> => (response.ok ? response.json() : Promise.resolve(null)));
        Promise.all([import("@/lib/api/worker-result"), download])
            .then(([{ parseWorkerResult, posesFromWorkerFrames }, json]) => {
                if (cancelled) return;
                const result = json ? parseWorkerResult(json) : null;
                setPoseData(result ? { status: "ready", frames: posesFromWorkerFrames(result.frames) } : { status: "unavailable" });
                dirtyRef.current = true;
            })
            .catch(() => {
                if (!cancelled) setPoseData({ status: "unavailable" });
            });
        return () => {
            cancelled = true;
        };
    }, [sourceUrl, analysis.resultUrl]);

    const poseFramesRef = useRef<PoseFrame[] | null>(null);
    useEffect(() => {
        poseFramesRef.current = poseData.status === "ready" ? poseData.frames : null;
        dirtyRef.current = true;
    }, [poseData]);

    // Keep a <video> element in step with the playhead.
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const unsubscribeSeek = store.subscribeSeek((timeMs) => {
            video.currentTime = timeMs / 1000;
        });
        let previous = store.getSnapshot();
        video.currentTime = previous.timeMs / 1000;
        const unsubscribe = store.subscribe(() => {
            const next = store.getSnapshot();
            if (next.playing !== previous.playing) {
                if (next.playing) video.play().catch(() => store.pause());
                else video.pause();
            }
            if (next.rate !== previous.rate) video.playbackRate = next.rate;
            previous = next;
        });
        return () => {
            unsubscribe();
            unsubscribeSeek();
        };
    }, [store]);

    // Canvas size, theme changes and playhead changes mark the frame for redraw.
    useEffect(() => {
        const stage = stageRef.current;
        const canvas = canvasRef.current;
        if (!stage || !canvas) return;
        const resize = () => {
            const ratio = window.devicePixelRatio || 1;
            canvas.width = Math.round(stage.clientWidth * ratio);
            canvas.height = Math.round(stage.clientHeight * ratio);
            dirtyRef.current = true;
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(stage);
        const themeObserver = new MutationObserver(() => {
            paletteRef.current = null;
            dirtyRef.current = true;
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        const unsubscribe = store.subscribe(() => {
            dirtyRef.current = true;
        });
        return () => {
            observer.disconnect();
            themeObserver.disconnect();
            unsubscribe();
        };
    }, [store]);

    // Animation loop: advances the clock while playing and redraws when something changed.
    useEffect(() => {
        let frame = 0;
        let last = performance.now();
        /** Striking-limb path, oldest point first. Reused across frames. */
        const trail: { x: number; y: number }[] = [];
        dirtyRef.current = true;
        const loop = (now: number) => {
            const elapsed = now - last;
            last = now;
            const snapshot = store.getSnapshot();
            const video = videoRef.current;
            if (snapshot.playing) {
                if (video) store.tick(video.currentTime * 1000);
                else store.tick(snapshot.timeMs + elapsed * snapshot.rate);
            }
            if (dirtyRef.current) {
                dirtyRef.current = false;
                draw(store.getSnapshot().timeMs);
            }
            frame = requestAnimationFrame(loop);
        };

        const draw = (timeMs: number) => {
            const canvas = canvasRef.current;
            const stage = stageRef.current;
            const ctx = canvas?.getContext("2d");
            if (!canvas || !stage || !ctx) return;
            const palette = (paletteRef.current ??= readStagePalette(stage));
            const width = canvas.width;
            const height = canvas.height;
            const shown = overlaysRef.current;
            const video = videoRef.current;

            ctx.clearRect(0, 0, width, height);
            let rect: StageRect = { x: 0, y: 0, width, height };
            if (video && video.videoWidth > 0) {
                const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
                rect = { width: video.videoWidth * scale, height: video.videoHeight * scale, x: (width - video.videoWidth * scale) / 2, y: (height - video.videoHeight * scale) / 2 };
            }
            if (sampler) drawMat(ctx, width, height, palette);

            const detection = detectionAt(detections, timeMs);
            const chain = detection ? LIMB_CHAIN[detection.limb] : null;
            const color = detection ? palette.strike[detection.type] : null;
            const lowConfidence = detection ? isNeedsReview(detection) : false;

            let keypoints: PoseKeypoint[] | null = null;
            let trackingLost = false;
            let angle: number | null = null;
            trail.length = 0;

            if (sampler) {
                const pose = sampler(timeMs);
                keypoints = pose.keypoints;
                trackingLost = pose.trackingLost;
                angle = pose.activeJoint?.angleDeg ?? null;
                if (detection && chain && shown.trail) {
                    for (let i = TRAIL_SAMPLES; i >= 0; i--) {
                        const t = timeMs - (TRAIL_MS * i) / TRAIL_SAMPLES;
                        if (t >= detection.startMs - 60) trail.push(sampler(t).keypoints[chain.end]);
                    }
                }
            } else {
                const frames = poseFramesRef.current;
                const current = frames ? nearestFrame(frames, timeMs) : null;
                keypoints = current && Math.abs(current.timeMs - timeMs) < 120 ? current.keypoints : null;
                if (keypoints && chain && keypoints.length > chain.end) {
                    angle = jointAngleDeg(keypoints[chain.root], keypoints[chain.joint], keypoints[chain.end], rect.width / rect.height);
                    if (frames && shown.trail) {
                        // Walk back from the playhead instead of scanning every frame of the clip.
                        const since = Math.max(timeMs - TRAIL_MS, (detection?.startMs ?? 0) - 60);
                        for (let i = indexAtOrBefore(frames, timeMs); i >= 0 && frames[i].timeMs >= since; i--) {
                            if (frames[i].keypoints.length > chain.end) trail.push(frames[i].keypoints[chain.end]);
                        }
                        trail.reverse();
                    }
                }
            }

            if (!keypoints || !shown.skeleton) return;
            if (color && shown.trail && trail.length > 1) drawTrail(ctx, trail, rect, lowConfidence ? palette.warning : color);
            drawSkeleton(ctx, keypoints, rect, {
                palette,
                activeChain: chain ? [chain.root, chain.joint, chain.end] : null,
                activeColor: color,
                activeLowConfidence: lowConfidence,
                faded: trackingLost,
                shadow: sampler !== null,
            });
            if (chain && color && shown.angle && angle !== null && keypoints.length > chain.end && !trackingLost) {
                drawJointAngle(ctx, keypoints[chain.joint], keypoints[chain.root], keypoints[chain.end], angle, rect, lowConfidence ? palette.warning : color, palette);
            }
        };

        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
    }, [store, sampler, detections]);

    const seekToDetection = (direction: "previous" | "next") => {
        const { timeMs } = store.getSnapshot();
        const target = direction === "next" ? nextDetection(detections, timeMs) : previousDetection(detections, timeMs);
        if (target) {
            store.pause();
            store.seek(target.peakMs);
        }
    };

    const step = (ms: number) => {
        store.pause();
        store.seek(store.getSnapshot().timeMs + ms);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        const target = event.target as HTMLElement;
        const nativeControl = target.closest("button, input, select, textarea, a");
        if (event.key === " " && !nativeControl) {
            event.preventDefault();
            store.toggle();
        } else if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && !(target instanceof HTMLInputElement)) {
            event.preventDefault();
            const amount = event.shiftKey ? 1000 : frameMs;
            step(event.key === "ArrowRight" ? amount : -amount);
        } else if (event.key === "]") {
            event.preventDefault();
            seekToDetection("next");
        } else if (event.key === "[") {
            event.preventDefault();
            seekToDetection("previous");
        }
    };

    const hintId = `${analysis.id}-player-keys`;

    return (
        <section aria-label={`Player: ${title}`} onKeyDown={onKeyDown} className={cn("overflow-hidden rounded-xl border border-border bg-surface shadow-card", className)}>
            <div
                ref={stageRef}
                tabIndex={0}
                role="application"
                aria-roledescription="video player"
                aria-label={reconstruction ? "Pose reconstruction stage" : "Training footage with pose overlay"}
                aria-describedby={hintId}
                className="relative aspect-video w-full bg-nav-bg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                onClick={() => {
                    stageRef.current?.focus();
                    store.toggle();
                }}
            >
                {sourceUrl && <video ref={videoRef} src={sourceUrl} playsInline muted preload="metadata" className="absolute inset-0 size-full object-contain" />}
                <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />
                <StageChips analysis={analysis} showLabel={overlays.label} detections={detections} />
                <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-nav-surface/85 px-2 py-1 text-[11px] font-medium text-nav-fg ring-1 ring-nav-border">
                    {reconstruction ? <ScanLine aria-hidden className="size-3.5" /> : <VideoIcon aria-hidden className="size-3.5" />}
                    <span className="max-sm:sr-only">{reconstruction ? "Pose reconstruction" : "Original footage"}</span>
                </span>
                {reconstruction && (
                    <p className="absolute bottom-2.5 left-3 max-w-[80%] text-[11px] leading-snug text-nav-fg/80 max-sm:hidden">
                        Pose reconstruction · original footage not stored in this demo
                    </p>
                )}
                {poseData.status === "unavailable" && (
                    <p role="status" className="absolute bottom-2.5 left-3 rounded-md bg-nav-surface/85 px-2 py-1 text-[11px] text-nav-fg">
                        Pose data couldn&apos;t be loaded — showing footage without the overlay.
                    </p>
                )}
            </div>
            {reconstruction && (
                <p className="border-t border-border bg-surface-muted/60 px-3 py-1.5 text-[11px] text-fg-muted sm:hidden">Pose reconstruction · original footage not stored in this demo</p>
            )}
            <p id={hintId} className="sr-only">
                Keyboard: Space plays or pauses, left and right arrows step one frame, Shift with an arrow steps one second, left and right square brackets jump to the previous or next detection.
            </p>
            <Transport
                onStep={step}
                onDetection={seekToDetection}
                frameMs={frameMs}
                overlays={overlays}
                onToggleOverlay={(key) => setOverlays((current) => ({ ...current, [key]: !current[key] }))}
                onFocusStage={() => stageRef.current?.focus()}
            />
        </section>
    );
}

function StageChips({ analysis, detections, showLabel }: { analysis: AIAnalysis; detections: AIAnalysis["detections"]; showLabel: boolean }) {
    const detectionId = usePlayback((s) => detectionAt(detections, s.timeMs)?.id ?? null);
    const eventKey = usePlayback((s) =>
        eventsAt(analysis.movementEvents, s.timeMs)
            .map((e) => e.type)
            .filter((type) => type === "guard_drop" || type === "tracking_lost")
            .sort()
            .join(","),
    );
    const detection = detectionId ? detections.find((d) => d.id === detectionId) : null;
    const low = detection ? isNeedsReview(detection) : false;

    return (
        <div className="pointer-events-none absolute top-3 left-3 flex max-w-[65%] flex-col items-start gap-1.5" aria-hidden>
            {showLabel && detection && (
                <span
                    className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ring-1",
                        low ? "bg-warning-soft text-warning-fg ring-warning-border" : "bg-nav-surface/90 text-nav-fg-active ring-nav-border",
                    )}
                >
                    {low ? (
                        <TriangleAlert className="size-3.5" />
                    ) : (
                        <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: TECHNIQUE_COLOR[detection.type] }} />
                    )}
                    {strikeObservation(detection.type)} · {formatConfidence(detection.confidence)}
                    {low && <span className="font-medium">· needs review</span>}
                    {detection.review && detection.review.decision !== "rejected" && (
                        <span className="inline-flex items-center gap-1 font-medium text-nav-fg">
                            <UserCheck className="size-3.5" />
                            {reviewedStrikeLabel(detection)}
                        </span>
                    )}
                </span>
            )}
            {eventKey.includes("guard_drop") && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-xs font-medium text-warning-fg ring-1 ring-warning-border">
                    <TriangleAlert className="size-3.5" />
                    Guard appears to drop
                </span>
            )}
            {eventKey.includes("tracking_lost") && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-nav-surface/90 px-2 py-1 text-xs font-medium text-nav-fg ring-1 ring-nav-border">
                    Tracking lost — keypoints unreliable
                </span>
            )}
        </div>
    );
}

function Transport({
    onStep,
    onDetection,
    frameMs,
    overlays,
    onToggleOverlay,
    onFocusStage,
}: {
    onStep: (ms: number) => void;
    onDetection: (direction: "previous" | "next") => void;
    frameMs: number;
    overlays: Record<OverlayKey, boolean>;
    onToggleOverlay: (key: OverlayKey) => void;
    onFocusStage: () => void;
}) {
    const store = usePlaybackStore();
    const playing = usePlayback((s) => s.playing);
    const rate = usePlayback((s) => s.rate);

    return (
        <div className="flex flex-col gap-3 border-t border-border px-3 py-3 sm:px-4">
            <Scrubber />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex items-center gap-1">
                    <Button size="icon" onClick={() => store.toggle()} aria-label={playing ? "Pause" : "Play"} aria-keyshortcuts="Space">
                        {playing ? <Pause /> : <Play />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onStep(-frameMs)} aria-label="Previous frame" aria-keyshortcuts="ArrowLeft">
                        <StepBack />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onStep(frameMs)} aria-label="Next frame" aria-keyshortcuts="ArrowRight">
                        <StepForward />
                    </Button>
                    <span aria-hidden className="mx-1 h-5 w-px bg-border" />
                    <Button variant="ghost" size="icon" onClick={() => onDetection("previous")} aria-label="Previous detection" aria-keyshortcuts="[">
                        <ChevronLeft />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDetection("next")} aria-label="Next detection" aria-keyshortcuts="]">
                        <ChevronRight />
                    </Button>
                </div>
                <TimeReadout />
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <SegmentedControl
                        label="Playback speed"
                        options={RATE_OPTIONS}
                        value={`${rate}`}
                        onChange={(value) => {
                            const next = PLAYBACK_RATES.find((option) => `${option}` === value);
                            if (next) store.setRate(next);
                        }}
                    />
                    <div role="group" aria-label="Overlays" className="flex items-center gap-1">
                        {OVERLAYS.map(({ key, label, icon: Icon }) => (
                            <Button
                                key={key}
                                variant="ghost"
                                size="sm"
                                aria-pressed={overlays[key]}
                                onClick={() => onToggleOverlay(key)}
                                className={cn("px-2", overlays[key] ? "bg-primary-soft text-primary-soft-fg hover:bg-primary-soft hover:text-primary-soft-fg" : "")}
                            >
                                <Icon aria-hidden />
                                <span className="max-md:sr-only">{label}</span>
                            </Button>
                        ))}
                        <Tooltip content="Space play/pause · ←/→ frame · Shift+←/→ 1 s · [ ] detections">
                            <Button variant="ghost" size="icon-sm" onClick={onFocusStage} aria-label="Keyboard shortcuts: focus the player">
                                <Keyboard aria-hidden />
                            </Button>
                        </Tooltip>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Scrubber() {
    const store = usePlaybackStore();
    const tenth = usePlayback((s) => Math.round(s.timeMs / 100));
    const durationMs = usePlayback((s) => s.durationMs);
    const timeMs = tenth * 100;
    return (
        <input
            type="range"
            min={0}
            max={durationMs}
            step={100}
            value={Math.min(timeMs, durationMs)}
            onChange={(event) => store.seek(Number(event.target.value))}
            aria-label="Seek"
            aria-valuetext={`${formatTimestamp(timeMs)} of ${formatTimestamp(durationMs)}`}
            className="h-6 w-full cursor-pointer accent-[var(--primary)]"
        />
    );
}

function TimeReadout() {
    const tenth = usePlayback((s) => Math.round(s.timeMs / 100));
    const durationMs = usePlayback((s) => s.durationMs);
    return (
        <p className="text-sm text-fg-muted tabular-nums">
            <span className="font-semibold text-fg">{formatTimestamp(tenth * 100)}</span>
            <span aria-hidden> / </span>
            <span className="sr-only"> of </span>
            {formatTimestamp(durationMs)}
        </p>
    );
}
