import { CalendarClock, Lock, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";
import type { Metadata } from "next";

import { ClearanceSection } from "@/components/dashboard/clearance-board";
import { loadRoster, type RosterEntry } from "@/components/dashboard/roster-data";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { clearanceExpiresSoon } from "@/lib/domain/rules";
import { pluralize } from "@/lib/format";
import { getSettings } from "@/lib/services/admin";
import { listDoctors, listFighters } from "@/lib/services/people";

export const metadata: Metadata = { title: "Medical Clearance" };

/** Soonest to lapse first, then by name. */
function byDaysRemaining(a: RosterEntry, b: RosterEntry): number {
    return (a.daysRemaining ?? Number.POSITIVE_INFINITY) - (b.daysRemaining ?? Number.POSITIVE_INFINITY) || a.fighter.name.localeCompare(b.fighter.name);
}

export default async function CoachMedicalClearancePage() {
    const user = await requireRole("coach");
    const now = new Date().toISOString();
    const [roster, doctors, settings] = await Promise.all([loadRoster(user, now, { fighters: listFighters(user) }), listDoctors(), getSettings()]);
    const warningDays = settings.clearanceExpiryWarningDays;
    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));

    const expiresSoon = (entry: RosterEntry) => clearanceExpiresSoon(entry.clearance, warningDays, now);
    const notCleared = roster.filter((entry) => entry.clearanceState === "not_cleared" || entry.clearanceState === "expired").sort(byDaysRemaining);
    const noClearance = roster.filter((entry) => entry.clearanceState === "none").sort(byDaysRemaining);
    const restricted = roster.filter((entry) => entry.clearanceState === "restricted" && !expiresSoon(entry)).sort(byDaysRemaining);
    const expiring = roster.filter((entry) => (entry.clearanceState === "full" || entry.clearanceState === "restricted") && expiresSoon(entry)).sort(byDaysRemaining);
    const cleared = roster.filter((entry) => entry.clearanceState === "full" && !expiresSoon(entry)).sort(byDaysRemaining);
    const expiringRestricted = expiring.filter((entry) => entry.clearanceState === "restricted").length;
    const expiringFull = expiring.length - expiringRestricted;
    const shared = { doctorNames, warningDays, now };

    return (
        <>
            <PageHeader
                title="Medical Clearance"
                description="Set by the sports doctor. Plan training within these limits."
                meta={
                    <p className="flex items-start gap-1.5 text-[13px] text-pretty text-fg-muted">
                        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
                        Only the sports doctor can change clearance. You see clearance levels and restrictions — clinical notes stay with the medical team.
                    </p>
                }
            />

            {roster.length === 0 ? (
                <EmptyState
                    icon={<ShieldCheck />}
                    title="No fighters assigned to you yet"
                    description="Once fighters are on your roster, their Medical Clearance and training restrictions appear here."
                />
            ) : (
                <div className="flex flex-col gap-6">
                    <section aria-label="Clearance summary" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            label="Not cleared"
                            value={notCleared.length}
                            icon={<ShieldX />}
                            href="#not-cleared"
                            hint={
                                noClearance.length > 0
                                    ? `+ ${pluralize(noClearance.length, "fighter")} with no clearance on file`
                                    : notCleared.length > 0
                                      ? "No training permitted"
                                      : "Everyone may train"
                            }
                        />
                        <StatCard
                            label="Restricted"
                            value={restricted.length}
                            icon={<ShieldAlert />}
                            href="#restricted"
                            hint={expiringRestricted > 0 ? `+ ${expiringRestricted} more expiring soon` : "Train within the listed limits"}
                        />
                        <StatCard
                            label={`Expiring ≤ ${warningDays} days`}
                            value={expiring.length}
                            icon={<CalendarClock />}
                            href="#expiring"
                            hint={expiring.length > 0 ? "Sessions after expiry will be blocked" : "No clearances lapsing soon"}
                        />
                        <StatCard
                            label="Cleared"
                            value={cleared.length}
                            icon={<ShieldCheck />}
                            href="#cleared"
                            hint={expiringFull > 0 ? `+ ${expiringFull} more expiring soon` : "Full training, no restrictions"}
                        />
                    </section>

                    <ClearanceSection
                        id="not-cleared"
                        title="Not cleared"
                        description="No training permitted until a sports doctor clears them — including lapsed clearances."
                        icon={ShieldX}
                        entries={notCleared}
                        emptyText="Nobody on your roster is not cleared right now."
                        {...shared}
                    />
                    {noClearance.length > 0 && (
                        <ClearanceSection
                            id="no-clearance"
                            title="No clearance on file"
                            description="Sessions can't be checked against medical guidance until the sports doctor issues a clearance."
                            icon={ShieldQuestion}
                            entries={noClearance}
                            emptyText=""
                            {...shared}
                        />
                    )}
                    <ClearanceSection
                        id="restricted"
                        title="Restricted"
                        description="Cleared to train, but only within these restrictions."
                        icon={ShieldAlert}
                        entries={restricted}
                        emptyText="No other restricted clearances."
                        {...shared}
                    />
                    <ClearanceSection
                        id="expiring"
                        title="Expiring soon"
                        description={`Clearances lapsing within ${warningDays} days. The sports doctor renews them — sessions after expiry will be blocked.`}
                        icon={CalendarClock}
                        entries={expiring}
                        emptyText={`No clearances lapse in the next ${warningDays} days.`}
                        {...shared}
                    />
                    <ClearanceSection
                        id="cleared"
                        title="Cleared"
                        description="Full training with no restrictions."
                        icon={ShieldCheck}
                        entries={cleared}
                        emptyText="No fighters are fully cleared right now."
                        {...shared}
                    />
                </div>
            )}
        </>
    );
}
