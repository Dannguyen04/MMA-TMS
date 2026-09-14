import { Ban, ShieldQuestion, Stethoscope } from "lucide-react";
import Link from "next/link";

import { InlineNote } from "@/components/dashboard/inline-note";
import { ClearanceValidity } from "@/components/domain/clearance-validity";
import { RestrictionList } from "@/components/domain/restriction-list";
import { CLEARANCE_STATE_META, ClearanceBadge } from "@/components/domain/status-badges";
import { EmptyState } from "@/components/ui/states";
import { TONE_SOFT } from "@/components/ui/tone";
import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import { clearanceState } from "@/lib/domain/rules";
import type { ClearanceStatus, MedicalClearance, MedicalExamination } from "@/lib/domain/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ClearanceRecordStatusBadge } from "./clinical-badges";

export interface ClearanceHistoryProps {
    /** Newest first. */
    clearances: MedicalClearance[];
    examinationsById: Map<string, MedicalExamination>;
    doctorNames: Map<string, string>;
    /** Server time (ISO). */
    now: string;
    /** Days before expiry at which the current clearance's validity turns into a warning. */
    warningDays?: number;
}

/** Timeline of every clearance issued: level, lifecycle, who issued it and when, why, and how it ended. */
export function ClearanceHistory({ clearances, examinationsById, doctorNames, now, warningDays }: ClearanceHistoryProps) {
    if (clearances.length === 0) {
        return (
            <EmptyState
                compact
                icon={<ShieldQuestion />}
                title="No clearances issued yet"
                description="Each Medical Clearance you issue, supersede or revoke is kept here with its reason."
            />
        );
    }

    return (
        <ol className="flex flex-col">
            {clearances.map((clearance, index) => {
                const newer = index > 0 ? clearances[index - 1] : null;
                const isLast = index === clearances.length - 1;
                const meta = CLEARANCE_STATE_META[clearance.level];
                const Icon = meta.icon;
                const state = clearanceState(clearance, now);
                const lapsed = clearance.status === "active" && state === "expired";
                const status: ClearanceStatus = lapsed ? "expired" : clearance.status;
                const isCurrent = clearance.status === "active";
                const examination = clearance.examinationId ? examinationsById.get(clearance.examinationId) : undefined;

                return (
                    <li key={clearance.id} className={cn("relative flex gap-4", !isLast && "pb-5")}>
                        {!isLast && <span aria-hidden className="absolute top-10 bottom-0 left-[17px] w-px bg-border" />}
                        <span
                            aria-hidden
                            className={cn("octagon flex size-9 shrink-0 items-center justify-center", isCurrent ? TONE_SOFT[meta.tone] : "bg-surface-muted text-fg-subtle")}
                        >
                            <Icon className="size-4" strokeWidth={2.25} />
                        </span>
                        <article
                            className={cn(
                                "min-w-0 flex-1 rounded-xl border px-4 py-3.5",
                                isCurrent ? "border-border-strong bg-surface shadow-card" : "border-border bg-surface-muted/40",
                            )}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="sr-only">
                                    {meta.label} clearance issued {formatDate(clearance.issuedAt)}
                                </h3>
                                <ClearanceBadge state={clearance.level} size="sm" />
                                <ClearanceRecordStatusBadge status={status} size="sm" />
                                {isCurrent && !lapsed && <span className="text-xs font-medium text-fg-muted">In force now</span>}
                            </div>

                            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                                <div className="min-w-0">
                                    <dt className="text-fg-muted">Issued</dt>
                                    <dd className="font-medium text-fg">
                                        <time dateTime={clearance.issuedAt}>{formatDateTime(clearance.issuedAt)}</time>
                                        <span className="font-normal text-fg-muted"> · {doctorNames.get(clearance.doctorId) ?? "Sports doctor"}</span>
                                    </dd>
                                </div>
                                <div className="min-w-0">
                                    <dt className="text-fg-muted">Validity</dt>
                                    <dd className="font-medium text-fg">
                                        {isCurrent ? (
                                            <ClearanceValidity clearance={clearance} state={state} now={now} warningDays={warningDays} />
                                        ) : clearance.validUntil ? (
                                            <>
                                                Valid until <time dateTime={clearance.validUntil}>{formatDate(clearance.validUntil)}</time>
                                            </>
                                        ) : (
                                            "No expiry date"
                                        )}
                                    </dd>
                                </div>
                            </dl>

                            <p className="mt-3 text-sm text-pretty text-fg">{clearance.reason}</p>

                            {clearance.restrictions.length > 0 && <RestrictionList restrictions={clearance.restrictions} className="mt-3" />}

                            {clearance.status === "revoked" && (
                                <InlineNote icon={Ban} tone="danger" className="mt-3">
                                    <span className="font-semibold">Revoked{clearance.revokedAt ? ` ${formatDateTime(clearance.revokedAt)}` : ""}.</span>{" "}
                                    {clearance.revokedReason}
                                </InlineNote>
                            )}
                            {clearance.status === "superseded" && newer && (
                                <p className="mt-3 text-[13px] text-fg-muted">
                                    Superseded on <time dateTime={newer.issuedAt}>{formatDate(newer.issuedAt)}</time> by a{" "}
                                    {CLEARANCE_STATE_META[newer.level].label.toLowerCase()} clearance.
                                </p>
                            )}

                            {examination && (
                                <p className="mt-3 flex items-center gap-1.5 text-[13px] text-fg-muted">
                                    <Stethoscope aria-hidden className="size-3.5 shrink-0" />
                                    Based on{" "}
                                    <Link href={routes.doctor.examination(examination.id)} className="rounded-sm font-medium text-primary-soft-fg hover:underline">
                                        {EXAMINATION_TYPE_LABELS[examination.type].toLowerCase()} on {formatDate(examination.date)}
                                    </Link>
                                </p>
                            )}
                        </article>
                    </li>
                );
            })}
        </ol>
    );
}
