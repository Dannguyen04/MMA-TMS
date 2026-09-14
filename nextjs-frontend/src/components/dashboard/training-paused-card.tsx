import { CalendarClock, CalendarX2, HeartPulse, ShieldX } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { TONE_SOFT } from "@/components/ui/tone";
import { formatWeekdayDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { relativeDay } from "./dashboard-utils";

export interface TrainingPausedCardProps {
    /** "expired" means the clearance lapsed; otherwise the doctor set Not Cleared. */
    reason: "not_cleared" | "expired";
    doctorName?: string;
    followUpDate: string | null;
    recovery: { phaseName: string | null; progressPct: number } | null;
    /** Sessions this week that were cancelled while training is paused. */
    cancelledThisWeek: number;
    healthHref: string;
    /** Server time (ISO). */
    now: string;
    className?: string;
}

const COPY: Record<TrainingPausedCardProps["reason"], { title: string; body: string }> = {
    not_cleared: {
        title: "Training paused — not medically cleared",
        body: "Your sports doctor has paused training while you recover. Rest, follow your recovery plan, and don't train until they clear you.",
    },
    expired: {
        title: "Training paused — clearance needs renewing",
        body: "Your Medical Clearance has lapsed. A sports doctor needs to renew it before you train again.",
    },
};

/** Calm replacement for the next-session hero when the fighter must not train. */
export function TrainingPausedCard({ reason, doctorName, followUpDate, recovery, cancelledThisWeek, healthHref, now, className }: TrainingPausedCardProps) {
    const copy = COPY[reason];

    return (
        <Card className={cn("flex min-w-0 flex-col overflow-hidden", className)}>
            <div aria-hidden className="h-1 bg-danger-solid" />
            <CardHeader title="Next session" icon={<CalendarClock />} />
            <CardContent className="flex flex-1 flex-col gap-4">
                <div role="status" className={cn("flex items-start gap-3.5 rounded-lg px-4 py-3.5 ring-1 ring-inset", TONE_SOFT.danger)}>
                    <span aria-hidden className="octagon flex size-11 shrink-0 items-center justify-center bg-surface">
                        <ShieldX className="size-5 text-danger-fg" strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0">
                        <p className="text-base leading-snug font-semibold text-fg">{copy.title}</p>
                        <p className="mt-1 text-sm text-pretty text-fg-muted">{copy.body}</p>
                    </div>
                </div>

                <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-[13px]">
                    <li className="flex flex-col gap-0.5 px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-fg-muted">
                            <CalendarClock aria-hidden className="size-3.5 text-fg-subtle" />
                            Next check with your doctor
                        </span>
                        {followUpDate ? (
                            <span className="font-medium text-fg">
                                <time dateTime={followUpDate}>{formatWeekdayDate(followUpDate)}</time>
                                <span className="font-normal text-fg-muted">
                                    {" · "}
                                    {relativeDay(followUpDate, now).toLowerCase()}
                                    {doctorName ? ` with ${doctorName}` : ""}
                                </span>
                            </span>
                        ) : (
                            <span className="text-fg-muted">Your doctor will arrange it</span>
                        )}
                    </li>
                    {cancelledThisWeek > 0 && (
                        <li className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5 text-fg-muted">
                                <CalendarX2 aria-hidden className="size-3.5 text-fg-subtle" />
                                This week
                            </span>
                            <span className="text-right font-medium text-fg">{pluralize(cancelledThisWeek, "session")} cancelled for you</span>
                        </li>
                    )}
                    {recovery && (
                        <li className="px-3 py-2.5">
                            <ProgressBar
                                value={recovery.progressPct}
                                tone="info"
                                size="sm"
                                showLabel
                                label={recovery.phaseName ? `Recovery · ${recovery.phaseName}` : "Recovery plan"}
                            />
                        </li>
                    )}
                </ul>

                <ButtonLink href={healthHref} variant="secondary" className="mt-auto w-full">
                    <HeartPulse aria-hidden />
                    View health &amp; clearance
                </ButtonLink>
            </CardContent>
        </Card>
    );
}
