import { Activity, CircleCheck, Flag, HeartHandshake, Hourglass, LineChart as LineChartIcon, MapPinned, NotebookPen, RefreshCw, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { INJURY_SEVERITY_DESCRIPTIONS, injuryTitle } from "@/components/clinical/clinical-copy";
import { TreatmentList } from "@/components/clinical/treatment-list";
import { CheckInTrends } from "@/components/dashboard/check-in-trends";
import { InlineNote } from "@/components/dashboard/inline-note";
import { BodyMap } from "@/components/domain/body-map";
import { CheckInCharts } from "@/components/domain/check-in-charts";
import { describeDaysUntil } from "@/components/domain/domain-format";
import { RecoveryProgress } from "@/components/domain/recovery-progress";
import { INJURY_STATUS_META, InjurySeverityBadge, InjuryStatusBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import type { Tone } from "@/components/ui/tone";
import { requireRole } from "@/lib/auth/session";
import { BODY_REGION_LABELS, INJURY_MECHANISM_LABELS, INJURY_SEVERITY_LABELS, INJURY_STATUS_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import type { Injury } from "@/lib/domain/types";
import { daysBetween, formatDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getInjuryDetail, type InjuryDetail } from "@/lib/services/medical";
import { listDoctors } from "@/lib/services/people";

/** The injury, only when it belongs to the signed-in fighter. Loaded once per request for the metadata and the page. */
const loadOwnInjury = cache(async (injuryId: string): Promise<InjuryDetail> => {
    const user = await requireRole("fighter");
    const detail = await getInjuryDetail(injuryId);
    if (!detail || !user.profileId || detail.injury.fighterId !== user.profileId) notFound();
    return detail;
});

export async function generateMetadata({ params }: PageProps<"/fighter/health/injuries/[injuryId]">): Promise<Metadata> {
    const { injury } = await loadOwnInjury((await params).injuryId);
    return { title: injuryTitle(injury) };
}

export default async function FighterInjuryPage({ params }: PageProps<"/fighter/health/injuries/[injuryId]">) {
    const [detail, doctors] = await Promise.all([params.then(({ injuryId }) => loadOwnInjury(injuryId)), listDoctors()]);
    const { injury, treatments, recoveryPlan, recordedBy } = detail;
    const now = new Date().toISOString();
    const planDoctor = recoveryPlan ? doctors.find((doctor) => doctor.id === recoveryPlan.doctorId)?.name : undefined;
    const doctorName = planDoctor ?? recordedBy?.name;
    const expectation = whatToExpect(injury, now);
    /** Without a recovery plan the main column is short, so the facts sit there in columns; otherwise they go beside it. */
    const aboutInMain = !recoveryPlan;

    const about = (
        <Card className="min-w-0">
            <CardHeader title="About this injury" icon={<NotebookPen />} />
            <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-pretty text-fg">{injury.description}</p>
                <DescriptionList
                    columns={aboutInMain ? 3 : 1}
                    className={aboutInMain ? undefined : "gap-y-3"}
                    items={[
                        { label: "Type", value: INJURY_TYPE_LABELS[injury.type] },
                        { label: "Body area", value: BODY_REGION_LABELS[injury.bodyRegion] },
                        { label: "Status", value: INJURY_STATUS_LABELS[injury.status] },
                        { label: "How it happened", value: INJURY_MECHANISM_LABELS[injury.mechanism] },
                        { label: "Occurred", value: <time dateTime={injury.occurredAt}>{formatDate(injury.occurredAt)}</time> },
                        { label: "Diagnosed", value: <time dateTime={injury.diagnosedAt}>{formatDate(injury.diagnosedAt)}</time> },
                        injury.resolvedAt
                            ? { label: "Resolved", value: <time dateTime={injury.resolvedAt}>{formatDate(injury.resolvedAt)}</time> }
                            : {
                                  label: "Expected return",
                                  value: injury.expectedReturnAt ? <time dateTime={injury.expectedReturnAt}>{formatDate(injury.expectedReturnAt)}</time> : "To be assessed",
                              },
                        { label: "Recorded by", value: recordedBy?.name ?? "Sports doctor" },
                        {
                            label: "Severity",
                            wide: true,
                            value: (
                                <span className="flex flex-col gap-0.5">
                                    {INJURY_SEVERITY_LABELS[injury.severity]}
                                    <span className="text-[13px] font-normal text-fg-muted">{INJURY_SEVERITY_DESCRIPTIONS[injury.severity]}</span>
                                </span>
                            ),
                        },
                    ]}
                />
                {doctorName && (
                    <InlineNote icon={HeartHandshake}>
                        Questions about your recovery? Talk to <span className="font-medium">{doctorName}</span>.
                    </InlineNote>
                )}
            </CardContent>
        </Card>
    );

    return (
        <>
            <PageHeader
                back={{ href: routes.fighter.health, label: "Health & Medical Clearance" }}
                eyebrow="Injury"
                title={injuryTitle(injury)}
                description={`${INJURY_MECHANISM_LABELS[injury.mechanism]} · ${formatDate(injury.occurredAt)}`}
                meta={
                    <>
                        <InjurySeverityBadge severity={injury.severity} />
                        <InjuryStatusBadge status={injury.status} />
                    </>
                }
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    <Callout
                        tone={expectation.tone}
                        icon={expectation.icon}
                        title={expectation.title}
                        action={
                            <ButtonLink href={routes.fighter.health} variant="secondary" size="sm">
                                View Medical Clearance
                            </ButtonLink>
                        }
                    >
                        {expectation.body}
                    </Callout>

                    {aboutInMain && about}

                    {recoveryPlan && (
                        <Card className="min-w-0">
                            <CardHeader
                                title="Recovery plan"
                                description={`${recoveryPlan.title}${planDoctor ? ` · ${planDoctor}` : ""}`}
                                icon={<RefreshCw />}
                            />
                            <CardContent>
                                <RecoveryProgress plan={recoveryPlan} now={now} />
                            </CardContent>
                        </Card>
                    )}

                    {recoveryPlan && (
                        <Card className="min-w-0">
                            <CardHeader title="Check-ins" description="How you've reported feeling at each check-in" icon={<LineChartIcon />} />
                            <CardContent className="flex flex-col gap-6">
                                <CheckInTrends checkIns={recoveryPlan.checkIns} now={now} />
                                {recoveryPlan.checkIns.length >= 2 ? (
                                    <div className="border-t border-border pt-5">
                                        <CheckInCharts checkIns={recoveryPlan.checkIns} audience="fighter" />
                                    </div>
                                ) : (
                                    <p className="text-[13px] text-fg-muted">Trend charts appear after your second check-in.</p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Card className="min-w-0 overflow-hidden">
                        <CardHeader title="Treatments" description={pluralize(treatments.length, "treatment")} icon={<Activity />} />
                        {treatments.length === 0 ? (
                            <EmptyState
                                compact
                                icon={<Activity />}
                                title="No treatments recorded"
                                description="Your doctor adds treatments here as your care progresses."
                                className="border-t border-border"
                            />
                        ) : (
                            <TreatmentList treatments={treatments} className="border-t border-border" />
                        )}
                    </Card>
                </div>

                <div className="flex min-w-0 flex-col gap-6">
                    {!aboutInMain && about}

                    <Card className="min-w-0">
                        <CardHeader title="Body map" icon={<MapPinned />} />
                        <CardContent>
                            <BodyMap
                                highlights={[
                                    {
                                        region: injury.bodyRegion,
                                        tone: INJURY_STATUS_META[injury.status].tone,
                                        label: `${INJURY_TYPE_LABELS[injury.type]} · ${INJURY_STATUS_LABELS[injury.status].toLowerCase()}`,
                                    },
                                ]}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

function whatToExpect(injury: Injury, now: string): { tone: Tone; icon: LucideIcon; title: string; body: string } {
    if (injury.status === "resolved") {
        return {
            tone: "success",
            icon: CircleCheck,
            title: injury.resolvedAt ? `Resolved on ${formatDate(injury.resolvedAt)}` : "This injury is resolved",
            body: "Your doctor marked this injury as resolved. Check your Medical Clearance before returning to full training.",
        };
    }
    if (!injury.expectedReturnAt) {
        return {
            tone: "info",
            icon: Hourglass,
            title: "Return date to be confirmed",
            body: "Your doctor sets an expected return after your next assessment. Keep following your treatment in the meantime.",
        };
    }
    const days = daysBetween(now, injury.expectedReturnAt);
    if (days < 0) {
        return {
            tone: "info",
            icon: Hourglass,
            title: "Taking a little longer than planned",
            body: `The expected return date was ${formatDate(injury.expectedReturnAt)}. Recovery often varies — your doctor will review your progress and update your clearance.`,
        };
    }
    return {
        tone: "info",
        icon: Flag,
        title: days === 0 ? "Expected return today" : `Expected return ${describeDaysUntil(days)}`,
        body: `Around ${formatDate(injury.expectedReturnAt)}. Your doctor will update your clearance as you progress — keep following your recovery plan.`,
    };
}
