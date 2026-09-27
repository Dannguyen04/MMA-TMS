import { ClipboardList, ClipboardPlus, ListTodo, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { CardLink } from "@/components/dashboard/card-link";
import { AttentionList } from "@/components/medical/attention-list";
import { ExaminationList } from "@/components/medical/examination-list";
import { buildTriageQueue, TRIAGE_QUEUE_META, TRIAGE_QUEUES, type TriageQueue } from "@/components/medical/triage-queue";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { formatWeekdayDate, pluralize } from "@/lib/format";
import { hrefWith, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getDoctorOverview, getFighterHealthSummary } from "@/lib/services/medical";
import { medicalFeatureAvailable, usesMedicalServiceForms } from "@/lib/services/medical-features";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Triage" };

/** The unfiltered queue shows this many; picking a group shows all of it. */
const QUEUE_PREVIEW = 8;

/** Groups backed by features the medical service doesn't offer yet are only shown where they exist (demo mode). */
const QUEUE_FEATURE: Partial<Record<TriageQueue, "followUps" | "aiObservations">> = { "follow-ups": "followUps", observations: "aiObservations" };

/**
 * The sports doctor's Today page answers one question: who needs me first? One triage queue, most urgent first and
 * filterable by group, with the latest examinations beside it. The full roster lives under Patients.
 */
export default async function DoctorDashboardPage({ searchParams }: PageProps<"/doctor/dashboard">) {
    const user = await requireRole("doctor");
    const query = await searchParams;
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    // Doctors are always scoped to their assigned fighters, so the summaries load alongside the list.
    const [overview, fighters, loaded] = await Promise.all([
        getDoctorOverview(scope, now),
        listFighters(user),
        Promise.all((scope === "all" ? [] : scope).map((fighterId) => getFighterHealthSummary(fighterId, now))),
    ]);
    const summaryById = new Map(loaded.flatMap((summary) => (summary ? [[summary.fighter.id, summary] as const] : [])));
    const summaries = fighters.flatMap((fighter) => summaryById.get(fighter.id) ?? []);

    const triage = buildTriageQueue({ overview, summaries, now, serviceForms: usesMedicalServiceForms() });
    const queues = TRIAGE_QUEUES.filter((group) => {
        const feature = QUEUE_FEATURE[group];
        return !feature || medicalFeatureAvailable(feature);
    });
    const queue = parseEnum(param(query.queue), queues);
    const inQueue = queue ? triage.filter((item) => item.group === queue) : triage;
    const shown = queue ? inQueue : inQueue.slice(0, QUEUE_PREVIEW);
    const queueHref = (next: TriageQueue | null) => hrefWith(routes.doctor.dashboard, query, { queue: next });

    return (
        <>
            <PageHeader
                eyebrow={formatWeekdayDate(now)}
                title="Triage"
                description={`${user.name} · ${pluralize(fighters.length, "assigned fighter")}`}
                actions={
                    <>
                        <ButtonLink href={routes.doctor.grantClearance} variant="secondary">
                            <ShieldCheck aria-hidden />
                            Update clearance
                        </ButtonLink>
                        <ButtonLink href={routes.doctor.newExamination}>
                            <ClipboardPlus aria-hidden />
                            New examination
                        </ButtonLink>
                    </>
                }
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <Card className="min-w-0 lg:col-span-2">
                    <CardHeader
                        title="Waiting for you"
                        icon={<ListTodo />}
                        description={triage.length > 0 ? `${pluralize(triage.length, "item")}, most urgent first` : "All clear — nothing needs you right now"}
                    />
                    {triage.length > 0 && (
                        <div className="border-t border-border px-5 py-3">
                            <SegmentedLinks
                                label="Filter the triage queue"
                                items={[
                                    { href: queueHref(null), label: "All", count: triage.length, active: !queue },
                                    // Empty groups stay out of the way unless they're the one selected.
                                    ...queues
                                        .map((group) => ({
                                            href: queueHref(group),
                                            label: TRIAGE_QUEUE_META[group].label,
                                            icon: TRIAGE_QUEUE_META[group].icon,
                                            count: triage.filter((item) => item.group === group).length,
                                            active: queue === group,
                                        }))
                                        .filter((chip) => chip.count > 0 || chip.active),
                                ]}
                            />
                        </div>
                    )}
                    <AttentionList
                        items={shown}
                        empty={
                            queue
                                ? TRIAGE_QUEUE_META[queue].empty
                                : {
                                      title: "Nothing needs your attention",
                                      description: "Every assigned fighter can train, no clearance is about to lapse and no one has asked for a review.",
                                  }
                        }
                        className="border-t border-border"
                    />
                    {!queue && inQueue.length > shown.length && (
                        <CardFooter className="text-fg-muted">
                            Showing the {shown.length} most urgent of {inQueue.length}. Pick a group above to see the rest.
                        </CardFooter>
                    )}
                </Card>

                <Card className="min-w-0">
                    <CardHeader title="Recent examinations" icon={<ClipboardList />} action={<CardLink href={routes.doctor.examinations}>All</CardLink>} />
                    <ExaminationList
                        items={overview.recentExaminations.map(({ examination, fighter }) => ({ examination, fighterName: fighter.name }))}
                        layout="stacked"
                        className="border-t border-border"
                    />
                </Card>
            </div>
        </>
    );
}
