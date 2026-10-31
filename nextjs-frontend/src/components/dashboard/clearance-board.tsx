import { CalendarDays, CircleCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { ClearanceValidity } from "@/components/domain/clearance-validity";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { RestrictionList } from "@/components/domain/restriction-list";
import { FighterStatusBadges } from "@/components/domain/status-badges";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { fighterSessionsHref } from "./coach-attention";
import { SESSION_HORIZON_DAYS, sessionsWith, type RosterEntry } from "./roster-data";

export interface ClearanceSectionProps {
    id: string;
    title: string;
    description: string;
    icon: LucideIcon;
    entries: RosterEntry[];
    doctorNames: Map<string, string>;
    warningDays: number;
    emptyText: string;
    /** Server time (ISO). */
    now: string;
}

/** One group of the roster clearance board (e.g. Restricted) with a row per fighter. Summary level — no clinical reasons. */
export function ClearanceSection({ id, title, description, icon: Icon, entries, doctorNames, warningDays, emptyText, now }: ClearanceSectionProps) {
    const headingId = `${id}-heading`;
    return (
        <Card id={id} className="min-w-0 scroll-mt-24" role="region" aria-labelledby={headingId}>
            <CardHeader
                title={
                    <span id={headingId}>
                        {title} <span className="font-normal text-fg-muted">({entries.length})</span>
                    </span>
                }
                description={description}
                icon={<Icon />}
            />
            {entries.length === 0 ? (
                <p className="flex items-center gap-2 border-t border-border px-5 py-4 text-sm text-fg-muted">
                    <CircleCheck aria-hidden className="size-4 shrink-0 text-success-fg" />
                    {emptyText}
                </p>
            ) : (
                <ul className="flex flex-col divide-y divide-border border-t border-border">
                    {entries.map((entry) => (
                        <ClearanceRow key={entry.fighter.id} entry={entry} doctorNames={doctorNames} warningDays={warningDays} now={now} />
                    ))}
                </ul>
            )}
        </Card>
    );
}

function ClearanceRow({ entry, doctorNames, warningDays, now }: { entry: RosterEntry; doctorNames: Map<string, string>; warningDays: number; now: string }) {
    const { fighter, clearance, clearanceState: state, upcoming, revoked } = entry;
    const blocked = state === "not_cleared" || state === "expired";
    const affected = blocked ? upcoming : upcoming.filter((check) => check.conflicts.length > 0);
    const blocking = blocked ? upcoming.length : sessionsWith(upcoming, "block").length;

    return (
        <li className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-x-6 xl:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,27rem)]">
            <div className="flex min-w-0 flex-col gap-2">
                <FighterIdentity fighter={fighter} size="sm" href={routes.coach.fighter(fighter.id)} />
                <FighterStatusBadges healthStatus={fighter.healthStatus} clearanceState={state} size="sm" />
            </div>

            <div className="min-w-0 text-sm">
                <p className="sr-only">What applies:</p>
                {state === "restricted" && clearance ? (
                    <RestrictionList restrictions={clearance.restrictions} />
                ) : (
                    <p className="text-pretty text-fg-muted">{stateText(entry)}</p>
                )}
            </div>

            <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-3 lg:col-start-2 xl:col-start-auto">
                <div className="min-w-0">
                    <dt className="text-fg-muted">Validity</dt>
                    <dd className="mt-0.5 font-medium text-fg">
                        <ClearanceValidity clearance={clearance} state={state} now={now} warningDays={warningDays} />
                    </dd>
                </div>
                <div className="min-w-0">
                    <dt className="text-fg-muted">Issuing doctor</dt>
                    <dd className="mt-0.5 font-medium text-fg">
                        {clearance ? (doctorNames.get(clearance.doctorId) ?? "Sports doctor") : "—"}
                        {clearance && <span className="block font-normal text-fg-muted">on {formatDate(revoked && clearance.revokedAt ? clearance.revokedAt : clearance.issuedAt)}</span>}
                    </dd>
                </div>
                <div className="col-span-2 min-w-0 sm:col-span-1">
                    <dt className="text-fg-muted">Next {SESSION_HORIZON_DAYS} days</dt>
                    <dd className="mt-0.5">
                        {upcoming.length === 0 ? (
                            <span className="text-fg-muted">None scheduled</span>
                        ) : affected.length === 0 ? (
                            <span className="flex items-start gap-1 font-medium text-fg">
                                <CircleCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success-fg" />
                                No conflicts in {pluralize(upcoming.length, "session")}
                            </span>
                        ) : (
                            <span className="flex flex-col gap-0.5">
                                <span className={cn("flex items-start gap-1 font-medium", blocking > 0 ? "text-danger-fg" : "text-warning-fg")}>
                                    <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                                    {affected.length} of {pluralize(upcoming.length, "session")} affected
                                </span>
                                <Link
                                    href={fighterSessionsHref(fighter.id)}
                                    className="inline-flex w-fit items-center gap-1 rounded-sm font-medium text-primary-soft-fg hover:underline"
                                >
                                    <CalendarDays aria-hidden className="size-3.5" />
                                    Review sessions<span className="sr-only"> for {fighter.name}</span>
                                </Link>
                            </span>
                        )}
                    </dd>
                </div>
            </dl>
        </li>
    );
}

function stateText({ clearance, clearanceState: state, revoked }: RosterEntry): string {
    if (revoked && clearance?.revokedAt) {
        return `Clearance revoked on ${formatDate(clearance.revokedAt)}. No training until the sports doctor issues a new clearance.`;
    }
    switch (state) {
        case "not_cleared":
            return "No training permitted. Pause every session until the sports doctor clears this fighter.";
        case "expired":
            return "The clearance has lapsed. Training is blocked until a sports doctor renews it.";
        case "none":
            return "No Medical Clearance on file. Sessions can't be checked against medical guidance until the sports doctor completes a baseline examination.";
        case "full":
            return "Cleared for all training. No restrictions apply.";
        case "restricted":
            return "Cleared to train within restrictions.";
    }
}
