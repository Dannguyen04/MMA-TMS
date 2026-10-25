import { CalendarClock, Lock, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";
import type { Metadata } from "next";

import { ClearanceSection } from "@/components/dashboard/clearance-board";
import { loadRoster, type RosterEntry } from "@/components/dashboard/roster-data";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import { clearanceExpiresSoon } from "@/lib/domain/rules";
import { getTranslator } from "@/lib/i18n/server";
import { getSettings } from "@/lib/services/admin";
import { listDoctors, listFighters } from "@/lib/services/people";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("coachClearance.metaTitle") };
}

/** Soonest to lapse first, then by name. */
function byDaysRemaining(a: RosterEntry, b: RosterEntry): number {
    return (a.daysRemaining ?? Number.POSITIVE_INFINITY) - (b.daysRemaining ?? Number.POSITIVE_INFINITY) || a.fighter.name.localeCompare(b.fighter.name);
}

export default async function CoachMedicalClearancePage() {
    const user = await requireRole("coach");
    const { t, locale } = await getTranslator();
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
    const shared = { doctorNames, warningDays, now, locale };

    return (
        <>
            <PageHeader
                title={t("coachClearance.pageTitle")}
                description={t("coachClearance.pageDesc")}
                meta={
                    <p className="flex items-start gap-1.5 text-[13px] text-pretty text-fg-muted">
                        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
                        {t("coachClearance.doctorLockNotice")}
                    </p>
                }
            />

            {roster.length === 0 ? (
                <EmptyState
                    icon={<ShieldCheck />}
                    title={t("coachClearance.emptyTitle")}
                    description={t("coachClearance.emptyDesc")}
                />
            ) : (
                <div className="flex flex-col gap-6">
                    <section aria-label={t("coachClearance.summaryAria")} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            label={t("coachClearance.statNotCleared")}
                            value={notCleared.length}
                            icon={<ShieldX />}
                            href="#not-cleared"
                            hint={
                                noClearance.length > 0
                                    ? t("coachClearance.hintNoClearance", {
                                          count: noClearance.length,
                                          fighters: noClearance.length === 1 ? t("coachClearance.fighter") : t("coachClearance.fighters"),
                                      })
                                    : notCleared.length > 0
                                      ? t("coachClearance.hintNoTraining")
                                      : t("coachClearance.hintEveryoneMayTrain")
                            }
                        />
                        <StatCard
                            label={t("coachClearance.statRestricted")}
                            value={restricted.length}
                            icon={<ShieldAlert />}
                            href="#restricted"
                            hint={
                                expiringRestricted > 0
                                    ? t("coachClearance.hintExpiringSoon", { count: expiringRestricted })
                                    : t("coachClearance.hintTrainWithinLimits")
                            }
                        />
                        <StatCard
                            label={t("coachClearance.statExpiringDays", { days: warningDays })}
                            value={expiring.length}
                            icon={<CalendarClock />}
                            href="#expiring"
                            hint={expiring.length > 0 ? t("coachClearance.hintSessionsBlocked") : t("coachClearance.hintNoLapsingSoon")}
                        />
                        <StatCard
                            label={t("coachClearance.statCleared")}
                            value={cleared.length}
                            icon={<ShieldCheck />}
                            href="#cleared"
                            hint={
                                expiringFull > 0
                                    ? t("coachClearance.hintExpiringSoon", { count: expiringFull })
                                    : t("coachClearance.hintFullTraining")
                            }
                        />
                    </section>

                    <ClearanceSection
                        id="not-cleared"
                        title={t("coachClearance.secNotClearedTitle")}
                        description={t("coachClearance.secNotClearedDesc")}
                        icon={ShieldX}
                        entries={notCleared}
                        emptyText={t("coachClearance.secNotClearedEmpty")}
                        {...shared}
                    />
                    {noClearance.length > 0 && (
                        <ClearanceSection
                            id="no-clearance"
                            title={t("coachClearance.secNoClearanceTitle")}
                            description={t("coachClearance.secNoClearanceDesc")}
                            icon={ShieldQuestion}
                            entries={noClearance}
                            emptyText=""
                            {...shared}
                        />
                    )}
                    <ClearanceSection
                        id="restricted"
                        title={t("coachClearance.secRestrictedTitle")}
                        description={t("coachClearance.secRestrictedDesc")}
                        icon={ShieldAlert}
                        entries={restricted}
                        emptyText={t("coachClearance.secRestrictedEmpty")}
                        {...shared}
                    />
                    <ClearanceSection
                        id="expiring"
                        title={t("coachClearance.secExpiringTitle")}
                        description={t("coachClearance.secExpiringDesc", { days: warningDays })}
                        icon={CalendarClock}
                        entries={expiring}
                        emptyText={t("coachClearance.secExpiringEmpty", { days: warningDays })}
                        {...shared}
                    />
                    <ClearanceSection
                        id="cleared"
                        title={t("coachClearance.secClearedTitle")}
                        description={t("coachClearance.secClearedDesc")}
                        icon={ShieldCheck}
                        entries={cleared}
                        emptyText={t("coachClearance.secClearedEmpty")}
                        {...shared}
                    />
                </div>
            )}
        </>
    );
}
