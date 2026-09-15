import { CalendarDays, StickyNote, ThumbsUp, Video, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/components/ui/tone";
import { FEEDBACK_KIND_LABELS } from "@/lib/domain/labels";
import type { CoachFeedback, FeedbackKind } from "@/lib/domain/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TechniqueChips } from "./technique-chip";

const KIND_META: Record<FeedbackKind, { icon: LucideIcon; tone: Tone }> = {
    praise: { icon: ThumbsUp, tone: "success" },
    correction: { icon: Wrench, tone: "info" },
    note: { icon: StickyNote, tone: "neutral" },
};

export interface CoachFeedbackItemProps {
    feedback: CoachFeedback;
    coachName: string;
    /** Server time (ISO) used for the relative date. */
    now: string;
    /** Link to the session the feedback is about. */
    sessionHref?: string;
    /** Link to the video the feedback is about. */
    videoHref?: string;
    className?: string;
}

/** A piece of coach feedback: who, what kind, the message, techniques and related session/video. */
export function CoachFeedbackItem({ feedback, coachName, now, sessionHref, videoHref, className }: CoachFeedbackItemProps) {
    const kind = KIND_META[feedback.kind];
    const linkClass = "inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 text-[13px] font-medium text-primary-soft-fg hover:bg-surface-hover";

    return (
        <article className={cn("flex gap-3", className)}>
            <Avatar name={coachName} size="sm" />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-semibold text-fg">{coachName}</p>
                    <Badge tone={kind.tone} icon={kind.icon} size="sm">
                        {FEEDBACK_KIND_LABELS[feedback.kind]}
                    </Badge>
                    <time dateTime={feedback.createdAt} title={formatDateTime(feedback.createdAt)} className="text-xs text-fg-subtle">
                        {formatRelative(feedback.createdAt, now)}
                    </time>
                </div>
                <p className="mt-1 text-sm text-pretty whitespace-pre-line text-fg">{feedback.body}</p>
                <TechniqueChips techniques={feedback.techniques} label="Techniques" size="sm" className="mt-2" />
                {(sessionHref || videoHref) && (
                    <div className="mt-1.5 -ml-1.5 flex flex-wrap gap-1">
                        {sessionHref && (
                            <Link href={sessionHref} className={linkClass}>
                                <CalendarDays aria-hidden className="size-3.5" />
                                View session
                            </Link>
                        )}
                        {videoHref && (
                            <Link href={videoHref} className={linkClass}>
                                <Video aria-hidden className="size-3.5" />
                                View video
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
}
