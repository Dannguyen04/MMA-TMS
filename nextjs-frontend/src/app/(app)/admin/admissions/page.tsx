import { CircleAlert, ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import { countLabel } from "@/components/admin/admin-format";
import { ApplicationList } from "@/components/admissions/application-views";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { EmptyState } from "@/components/ui/states";
import { requireRole } from "@/lib/auth/session";
import type { Application } from "@/lib/domain/admissions";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { hrefWith, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listApplications } from "@/lib/services/admissions";
import { listStaffAccounts } from "@/lib/services/care-team";
import { listCareTeamGaps } from "@/lib/services/care-team-gaps";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.admin.meta.admissions") };
}

/** Whether an activated applicant's fighter account still waits for a coach or a sports doctor. */
type NeedsCareTeam = (application: Application) => boolean;

/**
 * What needs the administrator, in the order applications move through it. Activation isn't the end: a new fighter
 * can't train until they have a sports doctor, so they stay out of "Closed" until their care team is in place.
 */
const SEGMENTS = {
    all: { label: "screens.admin.common.all", matches: () => true },
    coach: { label: "screens.admin.admissions.segment.coach", matches: (a: Application) => a.status === "submitted" && !a.evaluator },
    assessment: { label: "screens.admin.admissions.segment.assessment", matches: (a: Application) => a.status === "submitted" && a.evaluator !== null },
    decision: { label: "screens.admin.admissions.segment.decision", matches: (a: Application) => a.status === "passed" },
    activation: { label: "screens.admin.admissions.segment.activation", matches: (a: Application) => a.status === "approved" },
    care: {
        label: "screens.admin.admissions.segment.care",
        matches: (a: Application, needsCare: NeedsCareTeam) => a.status === "activated" && needsCare(a),
    },
    closed: {
        label: "screens.admin.admissions.segment.closed",
        matches: (a: Application, needsCare: NeedsCareTeam) => (a.status === "activated" && !needsCare(a)) || a.status === "failed" || a.status === "rejected",
    },
} satisfies Record<string, { label: MessageKey; matches: (application: Application, needsCare: NeedsCareTeam) => boolean }>;

type Segment = keyof typeof SEGMENTS;

/** What an empty segment says (`screens.admin.admissions.empty.<segment>.*`). None has an action of its own: applicants arrive by applying. */
const emptyKeys = (segment: Segment) => ({
    title: `screens.admin.admissions.empty.${segment}.title` as MessageKey,
    description: `screens.admin.admissions.empty.${segment}.description` as MessageKey,
});

export default async function AdminAdmissionsPage({ searchParams }: PageProps<"/admin/admissions">) {
    const admin = await requireRole("admin");
    const { t, locale } = await getTranslator();
    const segment: Segment = parseEnum(param((await searchParams).view), Object.keys(SEGMENTS) as Segment[]) ?? "all";
    const [applications, coaches, careTeamGaps] = await Promise.all([listApplications(), listStaffAccounts("coach"), listCareTeamGaps(admin)]);
    const waitingForCare = new Set((careTeamGaps ?? []).map((gap) => gap.userId));
    const needsCare: NeedsCareTeam = (application) => waitingForCare.has(application.applicantId);
    const inSegment = (key: Segment) => applications.filter((application) => SEGMENTS[key].matches(application, needsCare));
    const shown = inSegment(segment);
    const coachName = (coachId: string) => coaches.find((coach) => coach.staffId === coachId)?.name ?? t("role.coach");
    const empty = emptyKeys(applications.length > 0 && segment !== "all" ? segment : "all");

    return (
        <>
            <PageHeader title={t("screens.admin.common.admissions")} description={t("screens.admin.admissions.description")} />
            <div className="flex flex-col gap-4">
                <SegmentedLinks
                    label={t("screens.admin.admissions.filter")}
                    items={(Object.keys(SEGMENTS) as Segment[]).map((key) => ({
                        href: hrefWith(routes.admin.admissions, {}, { view: key === "all" ? undefined : key }),
                        label: t(SEGMENTS[key].label),
                        count: inSegment(key).length,
                        active: key === segment,
                    }))}
                />
                {careTeamGaps === null && (segment === "care" || segment === "closed") && (
                    <Callout tone="warning" icon={CircleAlert} title={t("screens.admin.common.careTeamsUnchecked")}>
                        {t("screens.admin.admissions.careTeamsUncheckedBody")}
                    </Callout>
                )}
                <Card className="overflow-hidden">
                    <CardHeader title={countLabel(t, "screens.admin.count.applications", shown.length)} icon={<ClipboardList />} />
                    {shown.length === 0 ? (
                        <CardContent>
                            <EmptyState compact title={t(empty.title)} description={t(empty.description)} />
                        </CardContent>
                    ) : (
                        <div className="border-t border-border">
                            <ApplicationList locale={locale === "en" ? undefined : locale} applications={shown} hrefFor={routes.admin.admission} coachName={coachName} label={t("screens.admin.admissions.list")} />
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}
