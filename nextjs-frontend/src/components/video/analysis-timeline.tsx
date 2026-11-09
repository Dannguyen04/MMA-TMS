"use client";

import { Activity, Sparkles } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

import { TECHNIQUE_COLOR } from "@/components/charts/colors";
import { useT } from "@/components/i18n/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { isNeedsReview } from "@/lib/domain/ai-review";
import { techniqueLabel } from "@/lib/domain/labels";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/domain/rules";
import type { AIAnalysis, AIFinding, Combination, Detection, MovementEvent, StrikeType } from "@/lib/domain/types";
import { formatClock, formatTimestamp } from "@/lib/format";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { clamp, cn } from "@/lib/utils";
import { byStart, detectionAt } from "@/lib/video/analysis-nav";
import { usePlayback, usePlaybackStore } from "./playback-store";
import { combinationLabel, confidencePhrase, eventDetail, movementEventLabel } from "./video-copy";

export interface TimelineObservation {
    id: string;
    label: string;
    timestampsMs: number[];
}

export interface AnalysisTimelineProps {
    analysis: AIAnalysis;
    /** Findings with any optimistic review state applied. */
    findings: AIFinding[];
    /** AI movement observations — pass only for sports doctors. */
    observations?: TimelineObservation[];
    onSelectFinding?: (findingId: string) => void;
    className?: string;
}

type ZoomId = "auto" | "fit" | "2x" | "4x";
type Ticks = { major: number[]; minor: number[] };

const ZOOMS: { value: Exclude<ZoomId, "auto">; label: string; factor: number }[] = [
    { value: "fit", label: "screens.video.timeline.fit", factor: 1 },
    { value: "2x", label: "2×", factor: 2 },
    { value: "4x", label: "4×", factor: 4 },
];

const STRIKE_LANES: StrikeType[] = ["jab", "cross", "hook", "kick", "punch"];
/** Height of one strike lane: every marker keeps a 24px hit area without overlapping the next lane. */
const LANE_PX = 24;
const HEAD_MOVEMENT = new Set<MovementEvent["type"]>(["slip", "roll"]);
const HATCH = "repeating-linear-gradient(135deg, var(--neutral-border) 0 3px, transparent 3px 7px)";
/** A marker is a 24px hit area around a 12px glyph. */
const MARKER = "absolute flex size-6 -translate-x-1/2 items-center justify-center rounded-md hover:z-10 focus-visible:z-20";

/**
 * Multi-track timeline of everything the AI detected: strikes, combinations, movement, guard
 * drops and findings, with a playhead synced to the player. The ruler is a seek slider.
 */
export function AnalysisTimeline({ analysis, findings, observations, onSelectFinding, className }: AnalysisTimelineProps) {
    const store = usePlaybackStore();
    const t = useT();
    const zoomOptions = useMemo(() => ZOOMS.map((zoom) => (zoom.value === "fit" ? { ...zoom, label: t(zoom.label as MessageKey) } : zoom)), [t]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState<ZoomId>("auto");
    const [viewportWidth, setViewportWidth] = useState<number | null>(null);
    const durationMs = analysis.durationMs;

    const detections = useMemo(() => byStart(analysis.detections), [analysis.detections]);
    const { movement, guardDrops, trackingLost } = useMemo(
        () => ({
            movement: byStart(analysis.movementEvents.filter((e) => e.type !== "guard_drop")),
            guardDrops: analysis.movementEvents.filter((e) => e.type === "guard_drop"),
            trackingLost: analysis.movementEvents.filter((e) => e.type === "tracking_lost"),
        }),
        [analysis.movementEvents],
    );

    const factor = zoom === "auto" ? (viewportWidth !== null && viewportWidth < 520 ? 4 : 1) : (ZOOMS.find((z) => z.value === zoom)?.factor ?? 1);
    const activeZoom = zoom === "auto" ? (factor === 4 ? "4x" : "fit") : zoom;
    const innerWidth = viewportWidth === null ? null : viewportWidth * factor;
    const pct = useCallback((ms: number) => `${(clamp(ms, 0, durationMs) / durationMs) * 100}%`, [durationMs]);
    const seek = useCallback(
        (ms: number) => {
            store.pause();
            store.seek(ms);
        },
        [store],
    );

    // Playhead and follow-scroll outside React. Geometry is cached from resize and scroll events, so a
    // playback tick only writes a transform — and scrollLeft when the playhead leaves the visible window.
    useEffect(() => {
        const scroller = scrollRef.current;
        const inner = innerRef.current;
        const playhead = playheadRef.current;
        if (!scroller || !inner || !playhead) return;
        const geometry = { innerWidth: 0, viewWidth: 0, scrollLeft: scroller.scrollLeft };

        const update = (follow: boolean) => {
            const { timeMs, playing } = store.getSnapshot();
            const x = durationMs > 0 ? (timeMs / durationMs) * geometry.innerWidth : 0;
            playhead.style.transform = `translateX(${x}px)`;
            if (!follow && !playing) return;
            const { scrollLeft, viewWidth } = geometry;
            if (x >= scrollLeft + 24 && x <= scrollLeft + viewWidth - 24) return;
            const next = clamp(x - viewWidth * 0.3, 0, Math.max(0, geometry.innerWidth - viewWidth));
            if (next === scrollLeft) return;
            geometry.scrollLeft = next;
            scroller.scrollLeft = next;
        };

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === inner) geometry.innerWidth = entry.contentRect.width;
                else {
                    geometry.viewWidth = entry.contentRect.width;
                    setViewportWidth(Math.round(entry.contentRect.width));
                }
            }
            update(true);
        });
        observer.observe(scroller);
        observer.observe(inner);
        const onScroll = () => {
            geometry.scrollLeft = scroller.scrollLeft;
        };
        scroller.addEventListener("scroll", onScroll, { passive: true });
        const unsubscribe = store.subscribe(() => update(false));
        const unsubscribeSeek = store.subscribeSeek(() => update(true));
        return () => {
            observer.disconnect();
            scroller.removeEventListener("scroll", onScroll);
            unsubscribe();
            unsubscribeSeek();
        };
    }, [store, durationMs]);

    const ticks = useMemo<Ticks>(() => {
        if (innerWidth === null) return { major: [], minor: [] };
        const seconds = durationMs / 1000;
        const pxPerSecond = innerWidth / Math.max(1, seconds);
        const step = [1, 2, 5, 10, 15, 30, 60, 120, 300].find((s) => s * pxPerSecond >= 72) ?? 600;
        const major = Array.from({ length: Math.floor(seconds / step) + 1 }, (_, i) => i * step);
        const minorStep = step / 5;
        const minor = minorStep * pxPerSecond >= 10 ? Array.from({ length: Math.floor(seconds / minorStep) + 1 }, (_, i) => i * minorStep).filter((s) => s % step !== 0) : [];
        return { major, minor };
    }, [innerWidth, durationMs]);

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader
                title={t("screens.video.timeline.title")}
                description={t("screens.video.timeline.description")}
                action={<SegmentedControl label={t("screens.video.timeline.zoom")} options={zoomOptions} value={activeZoom} onChange={setZoom} />}
            />
            <div className="px-5 pb-4">
                <div className="flex">
                    <div aria-hidden className="w-[76px] shrink-0 pr-2 text-xs font-medium text-fg-muted sm:w-[104px]">
                        <div className="h-8" />
                        <TrackLabel className="h-30">{t("screens.video.timeline.strikes")}</TrackLabel>
                        <TrackLabel className="h-8">{t("screens.video.timeline.combos")}</TrackLabel>
                        <TrackLabel className="h-8">{t("screens.video.timeline.movement")}</TrackLabel>
                        <TrackLabel className="h-7">{t("screens.video.timeline.guard")}</TrackLabel>
                        <TrackLabel className="h-8">{t("screens.video.timeline.findings")}</TrackLabel>
                        {observations && <TrackLabel className="h-8">{t("screens.video.timeline.observations")}</TrackLabel>}
                    </div>
                    <div ref={scrollRef} className="scrollbar-thin relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-lg bg-surface-muted/60">
                        <div ref={innerRef} className="relative" style={{ width: `${factor * 100}%` }}>
                            <Ruler durationMs={durationMs} ticks={ticks} onSeek={seek} label={t("screens.video.timeline.seek")} />
                            <div className="relative">
                                {trackingLost.map((event) => (
                                    <span
                                        key={event.id}
                                        aria-hidden
                                        className="pointer-events-none absolute inset-y-0 opacity-70"
                                        style={{ left: pct(event.startMs), width: pct(event.endMs - event.startMs), backgroundImage: HATCH }}
                                    />
                                ))}
                                <StrikesTrack detections={detections} pct={pct} onSeek={seek} t={t} />
                                <CombinationTrack combinations={analysis.combinations} pct={pct} onSeek={seek} t={t} pxPerMs={innerWidth === null ? 0 : innerWidth / durationMs} />
                                <MovementTrack events={movement} pct={pct} onSeek={seek} t={t} />
                                <GuardTrack events={guardDrops} pct={pct} onSeek={seek} t={t} />
                                <FindingsTrack findings={findings} pct={pct} onSeek={seek} t={t} onSelect={onSelectFinding} />
                                {observations && <ObservationsTrack observations={observations} pct={pct} onSeek={seek} t={t} />}
                            </div>
                            <div ref={playheadRef} aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-30 w-0 -translate-x-px border-l-2 border-primary will-change-transform">
                                <span className="absolute -top-px -left-[6px] size-2.5 rotate-45 rounded-[2px] bg-primary" />
                            </div>
                        </div>
                    </div>
                </div>
                <Legend t={t} />
            </div>
        </Card>
    );
}

function TrackLabel({ className, children }: { className: string; children: ReactNode }) {
    return <div className={cn("flex items-center truncate border-t border-transparent", className)}>{children}</div>;
}

/* ─── Ruler (seek slider) ─────────────────────────────────────────────────── */

const Ruler = memo(function Ruler({ durationMs, ticks, onSeek, label }: { durationMs: number; ticks: Ticks; onSeek: (ms: number) => void; label: string }) {
    const store = usePlaybackStore();
    const sliderRef = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);
    const [initialMs] = useState(() => Math.round(store.getSnapshot().timeMs / 100) * 100);

    // The slider value follows playback through the DOM, so the ruler and its ticks never re-render while playing.
    useEffect(() => {
        const slider = sliderRef.current;
        if (!slider) return;
        let shownMs = -1;
        const sync = () => {
            const ms = Math.round(store.getSnapshot().timeMs / 100) * 100;
            if (ms === shownMs) return;
            shownMs = ms;
            slider.setAttribute("aria-valuenow", String(ms));
            slider.setAttribute("aria-valuetext", formatTimestamp(ms));
        };
        sync();
        const unsubscribe = store.subscribe(sync);
        return () => {
            unsubscribe();
        };
    }, [store]);

    const msFromPointer = (event: PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return ((event.clientX - rect.left) / rect.width) * durationMs;
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const timeMs = store.getSnapshot().timeMs;
        const big = event.shiftKey ? 5000 : 1000;
        const moves: Record<string, number> = { ArrowRight: timeMs + big, ArrowLeft: timeMs - big, PageUp: timeMs + 10_000, PageDown: timeMs - 10_000, Home: 0, End: durationMs };
        if (!(event.key in moves)) return;
        event.preventDefault();
        onSeek(moves[event.key]);
    };

    return (
        <div
            ref={sliderRef}
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={Math.round(durationMs)}
            aria-valuenow={initialMs}
            aria-valuetext={formatTimestamp(initialMs)}
            onKeyDown={onKeyDown}
            onPointerDown={(event) => {
                dragging.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                onSeek(msFromPointer(event));
            }}
            onPointerMove={(event) => {
                if (dragging.current) onSeek(msFromPointer(event));
            }}
            onPointerUp={() => (dragging.current = false)}
            onPointerCancel={() => (dragging.current = false)}
            className="relative h-8 cursor-ew-resize touch-none border-b border-border select-none focus-visible:outline-offset-[-2px]"
        >
            {ticks.minor.map((second) => (
                <span key={`m${second}`} aria-hidden className="absolute bottom-0 h-1.5 w-px bg-border-strong" style={{ left: `${((second * 1000) / durationMs) * 100}%` }} />
            ))}
            {ticks.major.map((second) => (
                <span key={second} aria-hidden className="absolute bottom-0 flex h-full flex-col items-start" style={{ left: `${((second * 1000) / durationMs) * 100}%` }}>
                    <span className="mt-1 pl-1 text-[10px] text-fg-subtle tabular-nums">{formatClock(second)}</span>
                    <span className="mt-auto h-2.5 w-px bg-fg-subtle" />
                </span>
            ))}
        </div>
    );
});

/* ─── Roving focus (one tab stop per track) ───────────────────────────────── */

function useRovingFocus(count: number) {
    const [active, setActive] = useState(0);
    const current = Math.min(active, Math.max(0, count - 1));

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const map: Record<string, number> = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: count - 1 };
        if (!(event.key in map)) return;
        event.preventDefault();
        const next = Math.min(Math.max(map[event.key], 0), count - 1);
        setActive(next);
        event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-roving]")[next]?.focus();
    };

    /** Props for the item at `index`. Memoised items take `current` and the stable `setActive` instead. */
    const itemProps = (index: number) => ({ "data-roving": "", tabIndex: index === current ? 0 : -1, onFocus: () => setActive(index) });

    return { current, setActive, onKeyDown, itemProps };
}

interface TrackProps {
    pct: (ms: number) => string;
    onSeek: (ms: number) => void;
    t: Translator;
}

function Track({ label, className, onKeyDown, children }: { label: string; className: string; onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void; children: ReactNode }) {
    return (
        <div role="group" aria-label={label} onKeyDown={onKeyDown} className={cn("relative border-t border-border/70", className)}>
            {children}
        </div>
    );
}

function StrikesTrack({ detections, pct, onSeek, t }: TrackProps & { detections: Detection[] }) {
    const roving = useRovingFocus(detections.length);
    const activeId = usePlayback((s) => detectionAt(detections, s.timeMs)?.id ?? null);
    return (
        <Track label={t("screens.video.timeline.strikesTrack", { n: detections.length })} className="h-30" onKeyDown={roving.onKeyDown}>
            {detections.map((detection, index) => (
                <StrikeMarker
                    key={detection.id}
                    detection={detection}
                    index={index}
                    left={pct(detection.peakMs)}
                    active={detection.id === activeId}
                    tabbable={index === roving.current}
                    onSeek={onSeek}
                    onFocusIndex={roving.setActive}
                    t={t}
                />
            ))}
        </Track>
    );
}

/** One strike on its lane. Memoised: during playback only the markers whose `active` flag flips re-render. */
const StrikeMarker = memo(function StrikeMarker({
    detection,
    index,
    left,
    active,
    tabbable,
    onSeek,
    onFocusIndex,
    t,
}: {
    detection: Detection;
    index: number;
    left: string;
    active: boolean;
    tabbable: boolean;
    onSeek: (ms: number) => void;
    onFocusIndex: (index: number) => void;
    t: Translator;
}) {
    const needsReview = isNeedsReview(detection);
    const strike = techniqueLabel(t, detection.type);
    const time = formatTimestamp(detection.peakMs);
    const confidenceText = confidencePhrase(t, detection);
    const ariaLabel = detection.review
        ? t("screens.video.timeline.strikeAriaReviewed", {
              strike,
              time,
              confidence: confidenceText,
              decision: t(`screens.video.decisionLower.${detection.review.decision}`),
              name: detection.review.reviewerName,
          })
        : t(needsReview ? "screens.video.timeline.strikeAriaNeedsReview" : "screens.video.timeline.strikeAria", { strike, time, confidence: confidenceText });
    return (
        <button
            type="button"
            data-roving=""
            tabIndex={tabbable ? 0 : -1}
            onFocus={() => onFocusIndex(index)}
            onClick={() => onSeek(detection.peakMs)}
            aria-label={ariaLabel}
            title={`${strike} · ${time} · ${confidenceText}`}
            className={cn("group", MARKER, active && "z-10", detection.review?.decision === "rejected" && "opacity-35")}
            style={{ left, top: `${STRIKE_LANES.indexOf(detection.type) * LANE_PX}px` }}
        >
            <StrikeShape type={detection.type} hollow={needsReview} className={cn("transition-transform group-hover:scale-150", active && "scale-150")} />
        </button>
    );
});

/** Strike glyph: shape by type (never colour alone), hollow when it still needs review. */
export function StrikeShape({ type, hollow, className }: { type: StrikeType; hollow: boolean; className?: string }) {
    const paint = hollow
        ? { fill: "var(--chart-surface)", stroke: "var(--warning-solid)", strokeWidth: 2 }
        : { fill: TECHNIQUE_COLOR[type], strokeWidth: 1.2, className: "stroke-fg/40" };
    return (
        <svg viewBox="0 0 14 14" aria-hidden className={cn("size-3", className)}>
            {type === "jab" && <circle cx="7" cy="7" r="5.5" {...paint} />}
            {type === "cross" && <rect x="1.75" y="1.75" width="10.5" height="10.5" rx="1.5" {...paint} />}
            {type === "hook" && <path d="M7 1.2 12.9 12.2H1.1Z" strokeLinejoin="round" {...paint} />}
            {type === "kick" && <path d="M7 .8 13.2 7 7 13.2.8 7Z" strokeLinejoin="round" {...paint} />}
            {type === "punch" && <rect x="1" y="4" width="12" height="6" rx="3" {...paint} />}
        </svg>
    );
}

function CombinationTrack({ combinations, pct, onSeek, pxPerMs, t }: TrackProps & { combinations: Combination[]; pxPerMs: number }) {
    const roving = useRovingFocus(combinations.length);
    return (
        <Track label={t("screens.video.timeline.combinationsTrack", { n: combinations.length })} className="h-8" onKeyDown={roving.onKeyDown}>
            {combinations.map((combination, index) => (
                <button
                    key={combination.id}
                    type="button"
                    {...roving.itemProps(index)}
                    onClick={() => onSeek(combination.startMs)}
                    aria-label={t("screens.video.timeline.combinationAria", { label: combinationLabel(t, combination.label), from: formatTimestamp(combination.startMs), to: formatTimestamp(combination.endMs) })}
                    title={combinationLabel(t, combination.label)}
                    className="absolute top-2 h-4 min-w-1 overflow-hidden rounded-[3px] border border-chart-5/60 bg-chart-5/20 px-1 text-left text-[10px] leading-[14px] font-medium whitespace-nowrap text-fg hover:bg-chart-5/40"
                    style={{ left: pct(combination.startMs), width: pct(combination.endMs - combination.startMs) }}
                >
                    {(combination.endMs - combination.startMs) * pxPerMs >= 90 && <span aria-hidden>{combinationLabel(t, combination.label)}</span>}
                </button>
            ))}
        </Track>
    );
}

/** Movement glyphs differ by shape as well as colour: head movement is a round dot, footwork and guard drops are bars. */
function MovementGlyph({ type, className }: { type: MovementEvent["type"]; className?: string }) {
    const shape =
        type === "tracking_lost"
            ? "h-2 w-3.5 rounded-sm bg-surface"
            : type === "guard_drop"
              ? "h-2 w-3.5 rounded-sm bg-warning-solid"
              : HEAD_MOVEMENT.has(type)
                ? "size-3 rounded-full bg-chart-8"
                : "h-2 w-3.5 rounded-sm bg-chart-6";
    return <span aria-hidden className={cn("block shrink-0 ring-1 ring-fg/40", shape, className)} style={type === "tracking_lost" ? { backgroundImage: HATCH } : undefined} />;
}

function MovementTrack({ events, pct, onSeek, t }: TrackProps & { events: MovementEvent[] }) {
    const roving = useRovingFocus(events.length);
    return (
        <Track label={t("screens.video.timeline.movementTrack", { n: events.length })} className="h-8" onKeyDown={roving.onKeyDown}>
            {events.map((event, index) => (
                <button
                    key={event.id}
                    type="button"
                    {...roving.itemProps(index)}
                    onClick={() => onSeek(event.startMs)}
                    aria-label={t("screens.video.timeline.eventAria", { label: movementEventLabel(t, event.type), time: formatTimestamp(event.startMs), detail: eventDetail(t, event.detail) })}
                    title={`${movementEventLabel(t, event.type)} · ${eventDetail(t, event.detail)}`}
                    className={cn("group top-1", MARKER)}
                    style={{ left: pct(event.startMs) }}
                >
                    <MovementGlyph type={event.type} className="transition-transform group-hover:scale-125" />
                </button>
            ))}
        </Track>
    );
}

function GuardTrack({ events, pct, onSeek, t }: TrackProps & { events: MovementEvent[] }) {
    const roving = useRovingFocus(events.length);
    return (
        <Track label={t("screens.video.timeline.guardTrack", { n: events.length })} className="h-7" onKeyDown={roving.onKeyDown}>
            {events.map((event, index) => (
                <button
                    key={event.id}
                    type="button"
                    {...roving.itemProps(index)}
                    onClick={() => onSeek(event.startMs)}
                    aria-label={t("screens.video.timeline.guardAria", { time: formatTimestamp(event.startMs), ms: Math.round(event.endMs - event.startMs), detail: eventDetail(t, event.detail) })}
                    title={eventDetail(t, event.detail)}
                    className={cn("group top-0.5", MARKER)}
                    style={{ left: pct(event.startMs) }}
                >
                    <MovementGlyph type="guard_drop" className="transition-transform group-hover:scale-125" />
                </button>
            ))}
        </Track>
    );
}

function FindingsTrack({ findings, pct, onSeek, onSelect, t }: TrackProps & { findings: AIFinding[]; onSelect?: (findingId: string) => void }) {
    const moments = useMemo(
        () => findings.flatMap((finding) => finding.timestampsMs.map((ms, i) => ({ key: `${finding.id}-${i}`, ms, finding }))).sort((a, b) => a.ms - b.ms),
        [findings],
    );
    const roving = useRovingFocus(moments.length);
    return (
        <Track label={t("screens.video.timeline.findingsTrack", { n: findings.length })} className="h-8" onKeyDown={roving.onKeyDown}>
            {moments.map((moment, index) => (
                <button
                    key={moment.key}
                    type="button"
                    {...roving.itemProps(index)}
                    onClick={() => {
                        onSeek(moment.ms);
                        onSelect?.(moment.finding.id);
                    }}
                    aria-label={t("screens.video.timeline.findingAria", { time: formatTimestamp(moment.ms), title: moment.finding.title })}
                    title={moment.finding.title}
                    className={cn(
                        "absolute top-1 flex size-6 -translate-x-1/2 items-center justify-center rounded-md bg-ai-soft text-ai-fg ring-1 ring-ai-border hover:z-10 hover:bg-ai-solid hover:text-fg-inverse focus-visible:z-20",
                        moment.finding.review?.decision === "rejected" && "opacity-40",
                    )}
                    style={{ left: pct(moment.ms) }}
                >
                    <Sparkles aria-hidden className="size-3" />
                </button>
            ))}
        </Track>
    );
}

function ObservationsTrack({ observations, pct, onSeek, t }: TrackProps & { observations: TimelineObservation[] }) {
    const moments = observations.flatMap((o) => o.timestampsMs.map((ms, i) => ({ key: `${o.id}-${i}`, ms, label: o.label })));
    const roving = useRovingFocus(moments.length);
    return (
        <Track label={t("screens.video.timeline.observationsTrack", { n: observations.length })} className="h-8" onKeyDown={roving.onKeyDown}>
            {moments.map((moment, index) => (
                <button
                    key={moment.key}
                    type="button"
                    {...roving.itemProps(index)}
                    onClick={() => onSeek(moment.ms)}
                    aria-label={t("screens.video.timeline.observationAria", { time: formatTimestamp(moment.ms), label: moment.label })}
                    title={moment.label}
                    className="absolute top-1 flex size-6 -translate-x-1/2 items-center justify-center rounded-md bg-info-soft text-info-fg ring-1 ring-info-border hover:z-10"
                    style={{ left: pct(moment.ms) }}
                >
                    <Activity aria-hidden className="size-3.5" />
                </button>
            ))}
        </Track>
    );
}

function Legend({ t }: { t: Translator }) {
    return (
        <ul aria-label={t("screens.video.legend.label")} className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-muted">
            {STRIKE_LANES.map((type) => (
                <li key={type} className="flex items-center gap-1.5">
                    <StrikeShape type={type} hollow={false} />
                    {techniqueLabel(t, type)}
                </li>
            ))}
            <li className="flex items-center gap-1.5">
                <StrikeShape type="jab" hollow />
                {t("screens.video.legend.needsReview", { pct: Math.round(LOW_CONFIDENCE_THRESHOLD * 100) })}
            </li>
            <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-5 rounded-[3px] border border-chart-5/60 bg-chart-5/20" />
                {t("screens.video.legend.combination")}
            </li>
            <li className="flex items-center gap-1.5">
                <MovementGlyph type="slip" />
                {t("screens.video.legend.headMovement")}
            </li>
            <li className="flex items-center gap-1.5">
                <MovementGlyph type="step_in" />
                {t("screens.video.legend.footwork")}
            </li>
            <li className="flex items-center gap-1.5">
                <MovementGlyph type="guard_drop" />
                {t("screens.video.legend.guardDrop")}
            </li>
            <li className="flex items-center gap-1.5">
                <span aria-hidden className="flex size-4 items-center justify-center rounded bg-ai-soft text-ai-fg ring-1 ring-ai-border">
                    <Sparkles className="size-2.5" />
                </span>
                {t("screens.video.legend.aiFinding")}
            </li>
            <li className="flex items-center gap-1.5">
                <MovementGlyph type="tracking_lost" />
                {t("screens.video.legend.trackingLost")}
            </li>
        </ul>
    );
}
