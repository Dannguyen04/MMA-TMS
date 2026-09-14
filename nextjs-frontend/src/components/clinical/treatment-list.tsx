import { TREATMENT_TYPE_LABELS } from "@/lib/domain/labels";
import type { Treatment } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TreatmentStatusBadge, TreatmentTypeIcon } from "./clinical-badges";
import { TreatmentStatusMenu } from "./treatment-status-menu";

export interface TreatmentListProps {
    treatments: Treatment[];
    /** Shows the status change menu on each treatment. */
    editable?: boolean;
    className?: string;
}

/** Treatments in order: type icon, what and who, frequency, dates and status. */
export function TreatmentList({ treatments, editable = false, className }: TreatmentListProps) {
    return (
        <ul className={cn("flex flex-col divide-y divide-border", className)}>
            {treatments.map((treatment) => (
                <li key={treatment.id} className="flex gap-3 px-5 py-4">
                    <TreatmentTypeIcon type={treatment.type} />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className="text-sm font-semibold text-fg">{TREATMENT_TYPE_LABELS[treatment.type]}</h3>
                            <TreatmentStatusBadge status={treatment.status} size="sm" />
                        </div>
                        <p className="mt-0.5 text-sm text-pretty text-fg">{treatment.description}</p>
                        <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-fg-muted">
                            <div className="flex gap-1">
                                <dt className="sr-only">Provider</dt>
                                <dd>{treatment.providerName}</dd>
                            </div>
                            <div className="flex gap-1">
                                <dt className="sr-only">Frequency</dt>
                                <dd>{treatment.frequency}</dd>
                            </div>
                            <div className="flex gap-1">
                                <dt className="sr-only">Dates</dt>
                                <dd>
                                    <time dateTime={treatment.startDate}>{formatDate(treatment.startDate)}</time>
                                    {" – "}
                                    {treatment.endDate ? <time dateTime={treatment.endDate}>{formatDate(treatment.endDate)}</time> : "open-ended"}
                                </dd>
                            </div>
                        </dl>
                        {treatment.notes && (
                            <p className="mt-2 rounded-md bg-surface-muted px-3 py-2 text-[13px] text-pretty text-fg-muted">{treatment.notes}</p>
                        )}
                    </div>
                    {editable && (
                        <div className="-mt-1 -mr-2 shrink-0">
                            <TreatmentStatusMenu
                                injuryId={treatment.injuryId}
                                treatmentId={treatment.id}
                                type={treatment.type}
                                status={treatment.status}
                            />
                        </div>
                    )}
                </li>
            ))}
        </ul>
    );
}
