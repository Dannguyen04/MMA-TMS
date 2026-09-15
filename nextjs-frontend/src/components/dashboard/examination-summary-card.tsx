import { Stethoscope } from "lucide-react";

import { ExaminationOutcomeBadge } from "@/components/medical/clinical-badges";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import type { MedicalExamination } from "@/lib/domain/types";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CardLink } from "./card-link";

export interface ExaminationSummaryCardProps {
    examination: MedicalExamination | null;
    doctorName?: string;
    historyHref: string;
    /** Server time (ISO). */
    now: string;
    /** Dashboard size: "Last medical check" with type, outcome, date and doctor only — no summary or recommendations. */
    compact?: boolean;
    className?: string;
}

/** The fighter's own latest examination: type, date, outcome, doctor, summary and recommendations. */
export function ExaminationSummaryCard({ examination, doctorName, historyHref, now, compact = false, className }: ExaminationSummaryCardProps) {
    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader
                title={compact ? "Last medical check" : "Latest examination"}
                icon={<Stethoscope />}
                action={(examination || !compact) && <CardLink href={historyHref}>History</CardLink>}
            />
            <CardContent>
                {examination ? (
                    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
                        <div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className={cn("font-semibold text-fg", compact ? "text-sm" : "text-[15px]")}>{EXAMINATION_TYPE_LABELS[examination.type]}</p>
                                <ExaminationOutcomeBadge outcome={examination.outcome} size="sm" />
                            </div>
                            <p className="mt-0.5 text-[13px] text-fg-muted">
                                <time dateTime={examination.date}>{formatDate(examination.date)}</time> ({formatRelative(examination.date, now)})
                                {doctorName ? ` · ${doctorName}` : ""}
                            </p>
                        </div>
                        {!compact && <p className="text-sm text-pretty text-fg">{examination.summary}</p>}
                        {!compact && examination.recommendations && (
                            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
                                <h3 className="text-xs font-semibold text-fg-muted">What your doctor recommends</h3>
                                <p className="mt-0.5 text-[13px] text-pretty text-fg">{examination.recommendations}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <EmptyState
                        compact
                        icon={<Stethoscope />}
                        title={compact ? "No medical checks yet" : "No examinations yet"}
                        description={
                            compact
                                ? "Your sports doctor starts with a baseline physical."
                                : "Your sports doctor starts with a baseline physical and records every check-up here."
                        }
                        className="pt-0"
                    />
                )}
            </CardContent>
        </Card>
    );
}
