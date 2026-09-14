import { ArrowRight, CircleCheck, ClipboardList, FileText, MapPin, Radar, RefreshCw, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AddTreatmentDialog } from "@/components/clinical/add-treatment-dialog";
import { RecoveryPlanStatusBadge } from "@/components/clinical/clinical-badges";
import { injuryTitle } from "@/components/clinical/clinical-copy";
import { clinicalLinks } from "@/components/clinical/clinical-links";
import { InjuryStatusActions } from "@/components/clinical/injury-status-actions";
import { ObservationSummary } from "@/components/clinical/observation-summary";
import { TreatmentList } from "@/components/clinical/treatment-list";
import { AINotice } from "@/components/domain/ai-notice";
import { BodyMap } from "@/components/domain/body-map";
import { ClearanceValidity } from "@/components/domain/clearance-validity";
import { describeDaysUntil } from "@/components/domain/domain-format";
import { RecoveryProgress } from "@/components/domain/recovery-progress";
import { ClearanceBadge, FighterStatusBadges, INJURY_STATUS_META, InjurySeverityBadge, InjuryStatusBadge } from "@/components/domain/status-badges";
import { RestrictionSummary } from "@/components/medical/restriction-summary";
import { Callout } from "@/components/training/callout";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList, type DescriptionItem } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { canAccessFighter } from "@/lib/auth/access";
import { getCurrentUser, requireRole } from "@/lib/auth/session";
import { INJURY_MECHANISM_LABELS, INJURY_SEVERITY_LABELS, INJURY_STATUS_LABELS } from "@/lib/domain/labels";
import { clearanceState } from "@/lib/domain/rules";
import type { Injury } from "@/lib/domain/types";
import { dayKey, daysBetween, formatDate, formatDateTime, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getCurrentClearanceFor, getInjuryDetail } from "@/lib/services/medical";
import { getVideo } from "@/lib/services/videos";
import { param } from "@/lib/utils";

/** The injury with its fighter, treatments, plan and linked observation, loaded once per request for the metadata and the page. */
const loadInjuryDetail = cache(getInjuryDetail);

export async function generateMetadata({ params }: PageProps<"/doctor/injuries/[injuryId]">): Promise<Metadata> {
    const [{ injuryId }, user] = await Promise.all([params, getCurrentUser()]);
    const detail = await loadInjuryDetail(injuryId);
    // The title must not reveal a record the viewer isn't assigned to.
    const visible = detail && user && canAccessFighter(user, detail.injury.fighterId);
    return { title: visible ? `${injuryTitle(detail.injury)} · ${detail.fighter.name}` : "Injury" };
}

export default async function InjuryDetailPage({ params, searchParams }: PageProps<"/doctor/injuries/[injuryId]">) {
    const user = await requireRole("doctor");
    const [{ injuryId }, query] = await Promise.all([params, searchParams]);
    const now = new Date().toISOString();

    const [detail, settings] = await Promise.all([loadInjuryDetail(injuryId), getSettings()]);
    if (!detail || !canAccessFighter(user, detail.injury.fighterId)) notFound();
    const { injury, fighter, treatments, recoveryPlan, linkedAlert, recordedBy } = detail;

    const clearance = getCurrentClearanceFor(fighter.id);
    const clearanceNow = clearanceState(clearance, now);
    const linkedVideo = linkedAlert ? await getVideo(linkedAlert.videoId) : null;
    const justCreated = param(query.created) === "1";
    const openPlan = recoveryPlan && recoveryPlan.status !== "completed" ? recoveryPlan : null;
    const firstName = fighter.name.split(" ")[0];

    return (
        <>
            <PageHeader
                back={{ href: routes.doctor.injuries, label: "Injuries" }}
                eyebrow="Injury record"
                title={injuryTitle(injury)}
                meta={
                    <>
                        <InjurySeverityBadge severity={injury.severity} />
                        <InjuryStatusBadge status={injury.status} />
                        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
                        <Link
                            href={routes.doctor.fighter(fighter.id)}
                            className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-fg hover:underline"
                        >
                            <Avatar name={fighter.name} shape="octagon" size="xs" />
                            {fighter.name}
                        </Link>
                        <FighterStatusBadges healthStatus={fighter.healthStatus} clearanceState={clearanceNow} size="sm" />
                    </>
                }
                actions={
                    <InjuryStatusActions
                        injuryId={injury.id}
                        status={injury.status}
                        fighterName={fighter.name}
                        openPlanTitle={openPlan?.title ?? null}
                        todayLabel={formatDate(now)}
                    />
                }
            />

            <div className="flex flex-col gap-6">
                {justCreated && (
                    <Callout
                        tone="success"
                        icon={CircleCheck}
                        role="status"
                        title="Injury recorded"
                        action={
                            <>
                                <ButtonLink href={clinicalLinks.grantClearanceFor(fighter.id)} size="sm">
                                    <ShieldCheck aria-hidden />
                                    Review Medical Clearance for {fighter.name}
                                </ButtonLink>
                                <ButtonLink href={routes.doctor.injury(injury.id)} variant="ghost" size="sm" replace scroll={false}>
                                    Dismiss
                                </ButtonLink>
                            </>
                        }
                    >
                        {fighter.name}&apos;s coaches have been asked to check Medical Clearance. Review it now so training restrictions match this injury.
                    </Callout>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                    <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                        <Card>
                            <CardHeader title="Injury details" icon={<FileText />} />
                            <CardContent className="flex flex-col gap-5">
                                <DescriptionList items={detailItems(injury, now, recordedBy?.name ?? null)} columns={3} className="grid-cols-2" />
                                <div className="border-t border-border pt-4">
                                    <h3 className="text-[13px] font-semibold text-fg">Clinical description</h3>
                                    <p className="mt-1 text-sm leading-relaxed text-pretty whitespace-pre-line text-fg">{injury.description}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden">
                            <CardHeader
                                title="Treatments"
                                description={
                                    treatments.length === 0
                                        ? "What is being done for this injury"
                                        : `${treatments.filter((t) => t.status === "ongoing").length} ongoing · ${treatments.length} in total`
                                }
                                icon={<ClipboardList />}
                                action={<AddTreatmentDialog injuryId={injury.id} providerName={user.name} today={dayKey(now)} />}
                            />
                            {treatments.length === 0 ? (
                                <EmptyState
                                    compact
                                    icon={<ClipboardList />}
                                    title="No treatments yet"
                                    description="Add rest, physiotherapy, imaging or referrals so the fighter can follow the plan from their Health page."
                                    className="border-t border-border"
                                />
                            ) : (
                                <TreatmentList treatments={treatments} editable className="border-t border-border" />
                            )}
                        </Card>

                        <Card>
                            <CardHeader
                                title="Recovery plan"
                                icon={<RefreshCw />}
                                description={recoveryPlan ? recoveryPlan.title : "Phased return to training for this injury"}
                                action={
                                    recoveryPlan ? (
                                        <div className="flex items-center gap-2">
                                            <RecoveryPlanStatusBadge status={recoveryPlan.status} size="sm" />
                                        </div>
                                    ) : undefined
                                }
                            />
                            <CardContent>
                                {recoveryPlan ? (
                                    <div className="flex flex-col gap-5">
                                        <RecoveryProgress plan={recoveryPlan} now={now} />
                                        <Link
                                            href={routes.doctor.recoveryPlan(recoveryPlan.id)}
                                            className="inline-flex w-fit items-center gap-1 rounded-md text-sm font-medium text-primary-soft-fg hover:underline"
                                        >
                                            Open recovery plan — milestones and check-ins
                                            <ArrowRight aria-hidden className="size-4" />
                                        </Link>
                                    </div>
                                ) : injury.status === "resolved" ? (
                                    <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-fg-muted">
                                        No recovery plan was created for this injury.
                                    </p>
                                ) : (
                                    <EmptyState
                                        compact
                                        icon={<RefreshCw />}
                                        title="No recovery plan yet"
                                        description={`Plan ${firstName}'s return in phases with milestones, then track pain, mobility and strength at each check-in.`}
                                        action={
                                            <ButtonLink href={clinicalLinks.newRecoveryPlanFor(injury.id)} size="sm">
                                                Create recovery plan
                                            </ButtonLink>
                                        }
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <aside aria-label="Location, clearance and AI observation" className="flex min-w-0 flex-col gap-6">
                        <Card>
                            <CardHeader title="Location" icon={<MapPin />} />
                            <CardContent>
                                <BodyMap
                                    size="md"
                                    highlights={[
                                        {
                                            region: injury.bodyRegion,
                                            tone: INJURY_STATUS_META[injury.status].tone,
                                            label: `${INJURY_SEVERITY_LABELS[injury.severity]} · ${INJURY_STATUS_LABELS[injury.status].toLowerCase()}`,
                                        },
                                    ]}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader title="Medical Clearance" icon={<ShieldCheck />} description="Set separately from the injury record" />
                            <CardContent className="flex flex-col gap-3">
                                <div className="flex flex-col items-start gap-1.5">
                                    <ClearanceBadge state={clearanceNow} />
                                    <ClearanceValidity clearance={clearance} state={clearanceNow} now={now} warningDays={settings.clearanceExpiryWarningDays} variant="inline" />
                                </div>
                                {clearance && clearance.restrictions.length > 0 && clearanceNow === "restricted" && (
                                    <RestrictionSummary restrictions={clearance.restrictions} />
                                )}
                                <ButtonLink href={clinicalLinks.grantClearanceFor(fighter.id)} variant="secondary" size="sm" className="w-fit">
                                    Update clearance
                                </ButtonLink>
                            </CardContent>
                        </Card>

                        {linkedAlert ? (
                            <section aria-labelledby="linked-observation-heading" className="flex flex-col gap-3">
                                <h2 id="linked-observation-heading" className="flex items-center gap-2 text-[15px] font-semibold text-fg">
                                    <Radar aria-hidden className="size-4 text-fg-muted" />
                                    Linked AI observation
                                </h2>
                                <AINotice audience="doctor" compact />
                                <ObservationSummary
                                    alert={linkedAlert}
                                    source={linkedVideo ? { trainingType: linkedVideo.trainingType, uploadedAt: linkedVideo.uploadedAt } : null}
                                    href={routes.doctor.aiAlert(linkedAlert.id)}
                                />
                            </section>
                        ) : (
                            <Card>
                                <CardHeader title="AI movement observation" icon={<Radar />} />
                                <CardContent>
                                    <p className="text-sm text-fg-muted">No AI movement observation is linked to this injury.</p>
                                </CardContent>
                            </Card>
                        )}
                    </aside>
                </div>
            </div>
        </>
    );
}

function detailItems(injury: Injury, now: string, recordedByName: string | null): DescriptionItem[] {
    const items: DescriptionItem[] = [
        { label: "Occurred", value: <time dateTime={injury.occurredAt}>{formatDateTime(injury.occurredAt)}</time> },
        { label: "Diagnosed", value: <time dateTime={injury.diagnosedAt}>{formatDate(injury.diagnosedAt)}</time> },
        { label: "Mechanism", value: INJURY_MECHANISM_LABELS[injury.mechanism] },
    ];

    if (injury.resolvedAt) {
        items.push({ label: "Resolved", value: <time dateTime={injury.resolvedAt}>{formatDate(injury.resolvedAt)}</time> });
        items.push({ label: "Time to resolve", value: pluralize(Math.max(0, daysBetween(injury.occurredAt, injury.resolvedAt)), "day") });
    } else if (injury.expectedReturnAt) {
        const days = daysBetween(now, injury.expectedReturnAt);
        items.push({
            label: "Expected return",
            value: (
                <span className="flex flex-col gap-0.5">
                    <time dateTime={injury.expectedReturnAt}>{formatDate(injury.expectedReturnAt)}</time>
                    <span className={days < 0 ? "text-[13px] font-medium text-warning-fg" : "text-[13px] font-normal text-fg-muted"}>
                        {days < 0 ? `Target passed ${describeDaysUntil(days)}` : days === 0 ? "Today" : `${pluralize(days, "day")} remaining`}
                    </span>
                </span>
            ),
        });
    } else {
        items.push({ label: "Expected return", value: <span className="font-normal text-fg-muted">To be assessed</span> });
    }

    if (!injury.resolvedAt) items.push({ label: "Days since injury", value: pluralize(Math.max(0, daysBetween(injury.occurredAt, now)), "day") });
    if (recordedByName) items.push({ label: "Recorded by", value: recordedByName });
    return items;
}
