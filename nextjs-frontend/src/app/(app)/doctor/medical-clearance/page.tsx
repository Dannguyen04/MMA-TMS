import { ShieldCheck, ShieldQuestion } from "lucide-react";
import type { Metadata } from "next";

import { FighterIdentity } from "@/components/domain/fighter-identity";
import { ClearanceBadge } from "@/components/domain/status-badges";
import { ClearanceCell, ClearanceValidity } from "@/components/domain/clearance-validity";
import { RestrictionSummary } from "@/components/medical/restriction-summary";
import { RevokeClearanceButton } from "@/components/medical/revoke-clearance-button";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { EmptyState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { clearanceExpiresSoon } from "@/lib/domain/rules";
import { formatDate } from "@/lib/format";
import { hrefWith, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getClearanceOverview, type ClearanceOverviewRow } from "@/lib/services/medical";
import { listDoctors } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Medical Clearance" };

const VIEWS = ["all", "not_cleared", "expired", "restricted", "expiring", "full"] as const;
type View = (typeof VIEWS)[number];

const VIEW_LABELS: Record<View, string> = {
    all: "All",
    not_cleared: "Not cleared",
    expired: "Expired or none",
    restricted: "Restricted",
    expiring: "Expiring soon",
    full: "Cleared",
};

function matchesView(row: ClearanceOverviewRow, view: View, warningDays: number, now: string): boolean {
    switch (view) {
        case "all":
            return true;
        case "expired":
            return row.state === "expired" || row.state === "none";
        case "expiring":
            return clearanceExpiresSoon(row.clearance, warningDays, now);
        default:
            return row.state === view;
    }
}

export default async function MedicalClearanceBoardPage({ searchParams }: PageProps<"/doctor/medical-clearance">) {
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();

    const scope = accessibleFighterIds(user);
    // Rows arrive ordered by what needs a decision first.
    const [rows, doctors, settings] = await Promise.all([getClearanceOverview(scope, now), listDoctors(), getSettings()]);
    const warningDays = settings.clearanceExpiryWarningDays;
    const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.name]));
    const view = parseEnum(param(params.view), VIEWS) ?? "all";
    const visible = rows.filter((row) => matchesView(row, view, warningDays, now));
    const pathname = routes.doctor.clearance;

    const actionsFor = (row: ClearanceOverviewRow, align: "start" | "end") => {
        const grantHref = `${routes.doctor.grantClearance}?fighter=${row.fighter.id}`;
        const label = row.state === "none" ? "Issue" : row.state === "expired" ? "Renew" : row.clearance?.status === "revoked" ? "Issue new" : "Update";
        const canRevoke = row.clearance?.status === "active" && (row.state === "full" || row.state === "restricted");
        return (
            <div className={align === "end" ? "flex items-center justify-end gap-2" : "flex flex-wrap items-center gap-2"}>
                <ButtonLink href={grantHref} variant="secondary" size="sm">
                    <ShieldCheck aria-hidden />
                    {label}
                    <span className="sr-only"> clearance for {row.fighter.name}</span>
                </ButtonLink>
                {canRevoke && row.clearance && <RevokeClearanceButton clearanceId={row.clearance.id} fighterName={row.fighter.name} emphasis="quiet" />}
            </div>
        );
    };

    const restrictionsFor = (row: ClearanceOverviewRow) => {
        if (row.state === "restricted") return <RestrictionSummary restrictions={row.restrictions} />;
        if (row.state === "not_cleared") return <span className="text-[13px] font-medium text-danger-fg">No training permitted</span>;
        if (row.state === "full") return <span className="text-[13px] text-fg-muted">No restrictions</span>;
        return <span className="text-[13px] text-fg-muted">Training can&apos;t be checked</span>;
    };

    const issuedFor = (row: ClearanceOverviewRow) =>
        row.clearance ? (
            <span className="flex flex-col gap-0.5 text-[13px]">
                <span className="text-fg">{doctorNames.get(row.clearance.doctorId) ?? "Sports doctor"}</span>
                <time dateTime={row.clearance.issuedAt} className="text-fg-muted">
                    {formatDate(row.clearance.issuedAt)}
                </time>
            </span>
        ) : (
            <span className="text-[13px] text-fg-muted">—</span>
        );

    return (
        <>
            <PageHeader
                title="Medical Clearance"
                description="Who may train, within which limits, and until when. Coaches plan every session against these decisions."
                actions={
                    <ButtonLink href={routes.doctor.grantClearance}>
                        <ShieldCheck aria-hidden />
                        Issue clearance
                    </ButtonLink>
                }
            />

            <div className="flex flex-col gap-4">
                <SegmentedLinks
                    label="Filter by clearance state"
                    items={VIEWS.map((key) => ({
                        href: hrefWith(pathname, params, { view: key === "all" ? null : key }),
                        label: VIEW_LABELS[key],
                        count: rows.filter((row) => matchesView(row, key, warningDays, now)).length,
                        active: key === view,
                    }))}
                />

                {visible.length === 0 ? (
                    <EmptyState
                        icon={<ShieldQuestion />}
                        title={rows.length === 0 ? "No fighters assigned yet" : `No fighters in “${VIEW_LABELS[view]}”`}
                        description={
                            rows.length === 0
                                ? "Clearances for your assigned fighters appear here."
                                : view === "expiring"
                                  ? `No clearance lapses in the next ${warningDays} days.`
                                  : "Nobody currently falls in this group."
                        }
                        action={
                            rows.length > 0 && (
                                <ButtonLink href={pathname} variant="secondary">
                                    Show all fighters
                                </ButtonLink>
                            )
                        }
                    />
                ) : (
                    <>
                        <Card className="hidden overflow-hidden md:block">
                            <Table caption="Medical Clearance by fighter">
                                <THead>
                                    <tr>
                                        <TH>Fighter</TH>
                                        <TH>Clearance & validity</TH>
                                        <TH>Restrictions</TH>
                                        <TH>Issued</TH>
                                        <TH>
                                            <span className="sr-only">Actions</span>
                                        </TH>
                                    </tr>
                                </THead>
                                <TBody>
                                    {visible.map((row) => (
                                        <TR key={row.fighter.id}>
                                            <TD className="min-w-44">
                                                <FighterIdentity fighter={row.fighter} size="sm" href={routes.doctor.fighter(row.fighter.id)} showMeta={false} />
                                            </TD>
                                            <TD className="min-w-40">
                                                <ClearanceCell clearance={row.clearance} state={row.state} now={now} warningDays={warningDays} />
                                            </TD>
                                            <TD className="max-w-72 min-w-52">{restrictionsFor(row)}</TD>
                                            <TD className="min-w-32">{issuedFor(row)}</TD>
                                            <TD className="relative">{actionsFor(row, "end")}</TD>
                                        </TR>
                                    ))}
                                </TBody>
                            </Table>
                        </Card>

                        <ul className="grid grid-cols-1 gap-3 md:hidden">
                            {visible.map((row) => (
                                <li key={row.fighter.id} className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-card">
                                    <div className="flex items-start justify-between gap-3">
                                        <FighterIdentity fighter={row.fighter} size="sm" href={routes.doctor.fighter(row.fighter.id)} />
                                        <ClearanceBadge state={row.state} size="sm" className="shrink-0" />
                                    </div>
                                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                                        <div className="col-span-2 min-w-0">
                                            <dt className="mb-1 text-xs text-fg-muted">Restrictions</dt>
                                            <dd>{restrictionsFor(row)}</dd>
                                        </div>
                                        <div className="min-w-0">
                                            <dt className="mb-1 text-xs text-fg-muted">Valid until</dt>
                                            <dd>
                                                <ClearanceValidity clearance={row.clearance} state={row.state} now={now} warningDays={warningDays} />
                                            </dd>
                                        </div>
                                        <div className="min-w-0">
                                            <dt className="mb-1 text-xs text-fg-muted">Issued</dt>
                                            <dd>{issuedFor(row)}</dd>
                                        </div>
                                    </dl>
                                    <div className="mt-4 border-t border-border pt-3">{actionsFor(row, "start")}</div>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </>
    );
}
