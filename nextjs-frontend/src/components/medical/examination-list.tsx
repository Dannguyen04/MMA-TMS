import { Stethoscope } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import type { MedicalExamination } from "@/lib/domain/types";
import { formatDate, formatTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ExaminationOutcomeBadge } from "./clinical-badges";

/** Compact list of examinations with their outcome; each row opens the examination. */
export function ExaminationList({
    items,
    className,
}: {
    items: { examination: MedicalExamination; fighterName: string }[];
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
            {items.map(({ examination, fighterName }) => (
                <li key={examination.id} className="relative flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50">
                    <Avatar name={fighterName} shape="octagon" size="sm" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">
                            <Link
                                href={routes.doctor.examination(examination.id)}
                                className="rounded-sm after:absolute after:inset-0 after:content-[''] hover:underline"
                            >
                                {EXAMINATION_TYPE_LABELS[examination.type]}
                                <span className="sr-only"> for {fighterName}</span>
                            </Link>
                        </p>
                        <p className="truncate text-[13px] text-fg-muted">
                            {fighterName} · <time dateTime={examination.date}>{formatDate(examination.date)}, {formatTime(examination.date)}</time>
                        </p>
                    </div>
                    <ExaminationOutcomeBadge outcome={examination.outcome} size="sm" className="shrink-0" />
                </li>
            ))}
        </ul>
    );
}
