import { TONE_SOLID, type Tone } from "@/components/ui/tone";
import { BODY_REGION_LABELS } from "@/lib/domain/labels";
import type { BodyRegion } from "@/lib/domain/types";
import { clamp, cn } from "@/lib/utils";

/** Any semantic tone; injury highlights take theirs from INJURY_STATUS_META. */
export type BodyMapTone = Tone;

export interface BodyMapHighlight {
    region: BodyRegion;
    tone: BodyMapTone;
    /** What is happening in this region, e.g. "Muscle strain · recovering". Repeated in the legend. */
    label: string;
}

export interface BodyMapProps {
    highlights: BodyMapHighlight[];
    size?: "sm" | "md" | "lg";
    /** Hide the text legend only when the same information is listed right next to the figure. */
    showLegend?: boolean;
    className?: string;
}

/**
 * Hotspot centre per region on the front-view figure (viewBox 200×430). The athlete faces
 * the viewer, so the athlete's right side is on the viewer's left.
 */
const HOTSPOTS: Record<BodyRegion, { x: number; y: number; posterior?: boolean }> = {
    head: { x: 100, y: 30 },
    neck: { x: 100, y: 68 },
    right_shoulder: { x: 64, y: 96 },
    left_shoulder: { x: 136, y: 96 },
    right_elbow: { x: 48, y: 160 },
    left_elbow: { x: 152, y: 160 },
    right_hand: { x: 37, y: 238 },
    left_hand: { x: 163, y: 238 },
    chest: { x: 100, y: 110 },
    ribs: { x: 100, y: 160 },
    lower_back: { x: 100, y: 214, posterior: true },
    right_hip: { x: 80, y: 244 },
    left_hip: { x: 120, y: 244 },
    right_hamstring: { x: 83, y: 284, posterior: true },
    left_hamstring: { x: 117, y: 284, posterior: true },
    right_knee: { x: 81, y: 322 },
    left_knee: { x: 119, y: 322 },
    right_shin: { x: 81, y: 362 },
    left_shin: { x: 119, y: 362 },
    right_ankle: { x: 81, y: 398 },
    left_ankle: { x: 119, y: 398 },
};

const REGIONS = Object.keys(HOTSPOTS) as BodyRegion[];

/** Marker halo, dot and number colours. Numbers on the light warning fill are dark, like TONE_SOLID. */
const MARKER_CLASS: Record<BodyMapTone, { halo: string; dot: string; number: string }> = {
    neutral: { halo: "fill-neutral-soft stroke-neutral-solid", dot: "fill-neutral-solid", number: "fill-white" },
    primary: { halo: "fill-primary-soft stroke-primary", dot: "fill-primary", number: "fill-primary-fg" },
    danger: { halo: "fill-danger-soft stroke-danger-solid", dot: "fill-danger-solid", number: "fill-white" },
    warning: { halo: "fill-warning-soft stroke-warning-solid", dot: "fill-warning-solid", number: "fill-warning-solid-fg" },
    info: { halo: "fill-info-soft stroke-info-solid", dot: "fill-info-solid", number: "fill-white" },
    success: { halo: "fill-success-soft stroke-success-solid", dot: "fill-success-solid", number: "fill-white" },
    ai: { halo: "fill-ai-soft stroke-ai-solid", dot: "fill-ai-solid", number: "fill-white" },
};

const SIZE_CLASS: Record<NonNullable<BodyMapProps["size"]>, string> = {
    sm: "w-28",
    md: "w-40",
    lg: "w-52",
};

/** Limb segments drawn as round-capped strokes: [x1, y1, x2, y2, width]. */
const LIMBS: [number, number, number, number, number][] = [
    [100, 52, 100, 80, 15],
    [62, 94, 48, 160, 17],
    [48, 160, 40, 222, 14],
    [138, 94, 152, 160, 17],
    [152, 160, 160, 222, 14],
    [84, 246, 81, 322, 26],
    [81, 322, 81, 398, 18],
    [116, 246, 119, 322, 26],
    [119, 322, 119, 398, 18],
];

/** Head, hands and feet as ellipses: [cx, cy, rx, ry]. */
const ELLIPSES: [number, number, number, number][] = [
    [100, 34, 18, 22],
    [37, 238, 8, 12],
    [163, 238, 8, 12],
    [76, 410, 13, 6],
    [124, 410, 13, 6],
];

const TORSO =
    "M66 84C84 78 116 78 134 84C141 87 144 95 142 106L135 160C132 186 129 204 130 222L134 248C122 258 78 258 66 248L70 222C71 204 68 186 65 160L58 106C56 95 59 87 66 84Z";

const OUTLINE_WIDTH = 3;

/** Front-view body figure with numbered markers per highlighted region and a text legend. */
export function BodyMap({ highlights, size = "md", showLegend = true, className }: BodyMapProps) {
    const markers = placeMarkers(highlights);
    const hasPosterior = highlights.some((h) => HOTSPOTS[h.region].posterior);
    const summary =
        highlights.length === 0
            ? "Body map, front view. No highlighted areas."
            : `Body map, front view. ${highlights.length} highlighted ${highlights.length === 1 ? "area" : "areas"}: ${highlights
                  .map((h, i) => `${i + 1}, ${BODY_REGION_LABELS[h.region]}: ${h.label}`)
                  .join("; ")}.`;

    return (
        <div className={cn("flex flex-col items-center gap-3", className)}>
            <div className={cn("flex flex-col gap-1", SIZE_CLASS[size])}>
                <div aria-hidden className="flex justify-between text-[10px] font-medium tracking-wide text-fg-subtle uppercase">
                    <span>Athlete&apos;s right</span>
                    <span>Athlete&apos;s left</span>
                </div>
                <svg viewBox="0 0 200 430" role="img" aria-label={summary} className="h-auto w-full overflow-visible">
                    <g aria-hidden>
                        <g className="fill-border-strong stroke-border-strong" strokeLinecap="round" strokeLinejoin="round">
                            {LIMBS.map(([x1, y1, x2, y2, width], i) => (
                                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={width + OUTLINE_WIDTH} />
                            ))}
                            {ELLIPSES.map(([cx, cy, rx, ry], i) => (
                                <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} strokeWidth={OUTLINE_WIDTH} />
                            ))}
                            <path d={TORSO} strokeWidth={OUTLINE_WIDTH} />
                        </g>
                        <g className="fill-surface-muted stroke-surface-muted" strokeLinecap="round" strokeLinejoin="round">
                            {LIMBS.map(([x1, y1, x2, y2, width], i) => (
                                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={width} />
                            ))}
                            {ELLIPSES.map(([cx, cy, rx, ry], i) => (
                                <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} strokeWidth={0} />
                            ))}
                            <path d={TORSO} strokeWidth={0} />
                        </g>
                        {REGIONS.map((region) => (
                            <circle key={region} cx={HOTSPOTS[region].x} cy={HOTSPOTS[region].y} r={2.5} className="fill-fg-subtle/40" />
                        ))}
                        {markers.map((marker) => (
                            <g key={marker.number}>
                                <circle
                                    cx={marker.x}
                                    cy={marker.y}
                                    r={13}
                                    strokeWidth={1.5}
                                    strokeDasharray={marker.posterior ? "3 2" : undefined}
                                    className={MARKER_CLASS[marker.tone].halo}
                                />
                                <circle cx={marker.x} cy={marker.y} r={9} className={MARKER_CLASS[marker.tone].dot} />
                                <text
                                    x={marker.x}
                                    y={marker.y}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    className={cn("text-[10px] font-semibold", MARKER_CLASS[marker.tone].number)}
                                >
                                    {marker.number}
                                </text>
                            </g>
                        ))}
                    </g>
                </svg>
            </div>

            {showLegend && highlights.length > 0 && (
                <div className="w-full">
                    <ol className="flex flex-col gap-1.5" aria-label="Highlighted body areas">
                        {highlights.map((highlight, i) => (
                            <li key={`${highlight.region}-${i}`} className="flex items-start gap-2 text-[13px]">
                                <span
                                    aria-hidden
                                    className={cn(
                                        "mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                                        TONE_SOLID[highlight.tone],
                                    )}
                                >
                                    {i + 1}
                                </span>
                                <span className="min-w-0">
                                    <span className="font-medium text-fg">{BODY_REGION_LABELS[highlight.region]}</span>
                                    <span className="text-fg-muted"> — {highlight.label}</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                    {hasPosterior && <p className="mt-2 text-xs text-fg-subtle">Dashed rings mark areas on the back of the body.</p>}
                </div>
            )}
        </div>
    );
}

interface PlacedMarker {
    number: number;
    x: number;
    y: number;
    tone: BodyMapTone;
    posterior: boolean;
}

/** Numbers markers in highlight order and fans out repeats of the same region so none overlap. */
function placeMarkers(highlights: BodyMapHighlight[]): PlacedMarker[] {
    const seen = new Map<BodyRegion, number>();
    return highlights.map((highlight, i) => {
        const spot = HOTSPOTS[highlight.region];
        const repeat = seen.get(highlight.region) ?? 0;
        seen.set(highlight.region, repeat + 1);
        const outward = spot.x < 100 ? -1 : 1;
        return {
            number: i + 1,
            x: clamp(spot.x + outward * repeat * 22, 14, 186),
            y: spot.y,
            tone: highlight.tone,
            posterior: Boolean(spot.posterior),
        };
    });
}
