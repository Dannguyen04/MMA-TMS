import { Stethoscope } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import { examinationTitle } from "@/lib/domain/labels";
import type { MedicalExamination } from "@/lib/domain/types";
import { formatDate, formatShortDate, formatTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ExaminationOutcomeBadge } from "./clinical-badges";

/**
 * Compact list of examinations with their outcome; each row opens the examination. "stacked" suits a narrow side
 * column: nothing is cut off, the outcome sits under the title and the date drops the time.
 */
export function ExaminationList({
    items,
    layout = "row",
    className,
}: {
    items: { examination: MedicalExamination; fighterName: string }[];
    layout?: "row" | "stacked";
    className?: string;
}) {
    if (items.length === 0) {
        return (
            <EmptyState
                compact
                icon={<Stethoscope />}
                title="No examinations recorded yet"
                description="Recorded examinations and their outcomes appear here."
                className={className}
            />
        );
    }

    return (
        <ul className={cn("flex flex-col divide-y divide-border", className)}>
            {items.map(({ examination, fighterName }) =>
                layout === "stacked" ? (
                    <li key={examination.id} className="relative flex items-start gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50">
                        <Avatar name={fighterName} shape="octagon" size="sm" />
                        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                            <p className="text-sm font-medium text-pretty text-fg">
                                <ExaminationLink examination={examination} fighterName={fighterName} />
                            </p>
                            <p className="text-[13px] text-fg-muted">
                                {fighterName} · <time dateTime={examination.date}>{formatShortDate(examination.date)}</time>
                            </p>
                            <ExaminationOutcomeBadge outcome={examination.outcome} size="sm" />
                        </div>
                    </li>
                ) : (
                    <li key={examination.id} className="relative flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50">
                        <Avatar name={fighterName} shape="octagon" size="sm" />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-fg">
                                <ExaminationLink examination={examination} fighterName={fighterName} />
                            </p>
                            <p className="truncate text-[13px] text-fg-muted">
                                {fighterName} · <time dateTime={examination.date}>{formatDate(examination.date)}, {formatTime(examination.date)}</time>
                            </p>
                        </div>
                        <ExaminationOutcomeBadge outcome={examination.outcome} size="sm" className="shrink-0" />
                    </li>
                ),
            )}
        </ul>
    );
}

/** The examination's title, linking the whole row to it. */
function ExaminationLink({ examination, fighterName }: { examination: MedicalExamination; fighterName: string }) {
    return (
        <Link href={routes.doctor.examination(examination.id)} className="rounded-sm after:absolute after:inset-0 after:content-[''] hover:underline">
            {examinationTitle(examination)}
            <span className="sr-only"> for {fighterName}</span>
        </Link>
    );
}
