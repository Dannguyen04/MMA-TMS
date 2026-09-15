"use client";

import { Play } from "lucide-react";
import { useState } from "react";

import { createPlaybackStore, PlaybackProvider, usePlayback, usePlaybackStore } from "@/components/video/playback-store";
import { PosePlayer } from "@/components/video/pose-player";
import type { AIAnalysis, CameraAngle, Stance } from "@/lib/domain/types";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Seconds shown either side of each flagged moment. */
const CLIP_PADDING_MS = 1500;

export interface ObservationEvidenceProps {
    analysis: AIAnalysis;
    stance: Stance;
    cameraAngle: CameraAngle;
    sourceUrl: string | null;
    title: string;
    /** Moments the AI flagged, in milliseconds. */
    timestampsMs: number[];
}

/** Read-only pose reconstruction of the source footage with the flagged moments as seekable clips. */
export function ObservationEvidence({ analysis, stance, cameraAngle, sourceUrl, title, timestampsMs }: ObservationEvidenceProps) {
    const sorted = [...timestampsMs].sort((a, b) => a - b);
    const [store] = useState(() => createPlaybackStore(analysis.durationMs, Math.max(0, (sorted[0] ?? 0) - CLIP_PADDING_MS)));

    return (
        <PlaybackProvider store={store}>
            <div className="flex flex-col gap-4">
                <PosePlayer analysis={analysis} stance={stance} cameraAngle={cameraAngle} sourceUrl={sourceUrl} title={title} />
                <ClipButtons timestampsMs={sorted} durationMs={analysis.durationMs} />
            </div>
        </PlaybackProvider>
    );
}

function ClipButtons({ timestampsMs, durationMs }: { timestampsMs: number[]; durationMs: number }) {
    const store = usePlaybackStore();
    const clips = timestampsMs.map((ms) => ({ start: Math.max(0, ms - CLIP_PADDING_MS), end: Math.min(durationMs, ms + CLIP_PADDING_MS) }));
    // Subscribe to which clips hold the playhead (a primitive key), not the raw time, so playback
    // re-renders the list only when the playhead enters or leaves a clip.
    const activeKey = usePlayback((snapshot) =>
        clips.map((clip) => (snapshot.timeMs >= clip.start && snapshot.timeMs <= clip.end ? "1" : "0")).join(""),
    );

    return (
        <div>
            <h4 className="mb-2 text-[13px] font-semibold text-fg">Flagged moments</h4>
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {clips.map(({ start, end }, index) => {
                    const ms = timestampsMs[index];
                    const inClip = activeKey[index] === "1";
                    return (
                        <li key={`${ms}-${index}`}>
                            <button
                                type="button"
                                onClick={() => {
                                    store.seek(start);
                                    store.play();
                                }}
                                aria-current={inClip || undefined}
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                                    inClip ? "border-ai-border bg-ai-soft/60" : "border-border bg-surface hover:bg-surface-hover",
                                )}
                            >
                                <span
                                    aria-hidden
                                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ai-soft text-ai-fg ring-1 ring-inset ring-ai-border"
                                >
                                    <Play className="size-3.5" />
                                </span>
                                <span className="min-w-0 text-[13px]">
                                    <span className="block font-medium text-fg">Moment {index + 1}</span>
                                    <span className="text-fg-muted tabular-nums">
                                        {formatTimestamp(start)} – {formatTimestamp(end)}
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
