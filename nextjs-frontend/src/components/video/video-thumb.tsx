import { TRAINING_TYPE_ICONS } from "@/components/domain/training-type-icon";
import { VideoStatusBadge } from "@/components/domain/status-badges";
import type { VideoStatus, VideoTrainingType } from "@/lib/domain/types";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

const OCTAGON = "M47.6 5h64.8L158 34.6v20.8L112.4 85H47.6L2 55.4V34.6Z";

/** Stylised placeholder tile for footage: training-type mark over a mat with octagon lines. Theme surfaces with a visible edge, so it never melts into a dark card. */
export function VideoThumb({
    trainingType,
    status,
    durationSec,
    size = "md",
    className,
}: {
    trainingType: VideoTrainingType;
    status?: VideoStatus;
    durationSec: number;
    size?: "sm" | "md";
    className?: string;
}) {
    const Icon = TRAINING_TYPE_ICONS[trainingType];
    return (
        <div className={cn("relative aspect-video overflow-hidden bg-surface-muted ring-1 ring-border ring-inset", className)}>
            <svg aria-hidden viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full text-border-strong">
                <path d={OCTAGON} fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d={OCTAGON} fill="none" stroke="currentColor" strokeWidth="0.8" transform="translate(40 22.5) scale(0.5)" opacity="0.7" />
                <path d="M80 5v80M2 45h156" stroke="currentColor" strokeWidth="0.5" opacity="0.45" />
            </svg>
            <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                <span
                    className={cn(
                        "octagon flex items-center justify-center bg-surface text-fg-muted",
                        size === "sm" ? "size-8 [&_svg]:size-4" : "size-9 sm:size-14 [&_svg]:size-4 sm:[&_svg]:size-6",
                    )}
                >
                    <Icon />
                </span>
            </span>
            {status && size === "md" && (
                <span className="absolute top-2 left-2 max-sm:hidden">
                    <VideoStatusBadge status={status} size="sm" />
                </span>
            )}
            <span
                className={cn(
                    "absolute right-1.5 bottom-1.5 rounded bg-surface/90 font-medium text-fg ring-1 ring-border tabular-nums",
                    size === "sm" ? "px-1 text-[10px]" : "px-1 text-[10px] sm:px-1.5 sm:py-0.5 sm:text-[11px]",
                )}
            >
                <span className="sr-only">Length </span>
                {formatClock(durationSec)}
            </span>
        </div>
    );
}
