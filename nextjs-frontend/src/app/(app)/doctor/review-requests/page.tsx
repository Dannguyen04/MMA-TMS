import { Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { REQUESTER_ROLE, fmtDateTime, rel } from "@/components/doctor/labels";
import { Empty, FighterFilter, PageHead, Pill } from "@/components/doctor/ui";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { listReviewRequests } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.reviewRequests") };
}

/** Yêu cầu xem xét: gộp `listReviewRequests` của từng võ sĩ được phân công (cùng nguồn với hồ sơ võ sĩ). */
export default async function DoctorReviewRequestsPage({ searchParams }: PageProps<"/doctor/review-requests">) {
    const user = await requireRole("doctor");
    const { t, locale } = await getTranslator();
    const query = await searchParams;
    const requested = param(query.fighter);
    const fighterId = requested && canAccessFighter(user, requested) ? requested : undefined;
    const showResolved = param(query.status) === "resolved";
    const fighters = await listFighters(user);
    const scope = fighterId ? fighters.filter((f) => f.id === fighterId) : fighters;
    const lists = await Promise.all(scope.map((f) => listReviewRequests(f.id).catch(() => [])));
    const nameOf = new Map(fighters.map((f) => [f.id, f.name]));
    const all = lists.flat().sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    const open = all.filter((r) => r.status === "OPEN");
    const rows = showResolved ? all.filter((r) => r.status === "RESOLVED") : open;
    const base = routes.doctor.reviewRequests;
    const q = (s?: string) => `${base}?${new URLSearchParams({ ...(fighterId ? { fighter: fighterId } : {}), ...(s ? { status: s } : {}) })}`;

    return (
        <div className="yt-page">
            <PageHead title={t("doctorPages.meta.reviewRequests")} sub={plural(t, "doctorPages.reviews.sub", open.length)} />
            <div className="yt-filters">
                <nav className="yt-segs" aria-label={t("doctorPages.reviews.statusAria")}>
                    <Link href={q()} aria-current={!showResolved ? "page" : undefined}>
                        {t("doctorPages.reviews.segOpen", { n: open.length })}
                    </Link>
                    <Link href={q("resolved")} aria-current={showResolved ? "page" : undefined}>
                        {t("doctorPages.reviews.segResolved", { n: all.length - open.length })}
                    </Link>
                </nav>
            </div>
            <FighterFilter base={base} fighters={fighters} current={fighterId} extra={{ status: showResolved ? "resolved" : undefined }} t={t} />
            {rows.length ? (
                <div className="yt-tablewrap">
                    <table className="yt-table">
                        <thead>
                            <tr>
                                <th>{t("doctorPages.fighters.col.fighter")}</th>
                                <th>{t("doctorPages.reviews.col.reason")}</th>
                                <th className="yt-hide-sm">{t("doctorPages.reviews.col.sender")}</th>
                                <th className="yt-hide-sm">{t("doctorPages.reviews.col.time")}</th>
                                <th>{t("doctorPages.reviews.col.status")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td>
                                        <Link className="yt-rowlink" href={routes.doctor.fighter(r.fighterId)}>
                                            <b>{nameOf.get(r.fighterId) ?? t("screens.doctor.fighterFallback")}</b>
                                        </Link>
                                    </td>
                                    <td>{r.reason}</td>
                                    <td className="yt-hide-sm">{t(REQUESTER_ROLE[r.requesterRole])}</td>
                                    <td className="yt-hide-sm">
                                        {fmtDateTime(r.requestedAt, locale)} <span className="yt-muted">· {rel(t, r.requestedAt)}</span>
                                    </td>
                                    <td>
                                        {r.status === "OPEN" ? (
                                            <Link className="yt-btn" data-v="primary" href={`${routes.doctor.newExamination}?fighter=${r.fighterId}`}>
                                                <Stethoscope aria-hidden />
                                                {t("doctorPages.reviews.examine")}
                                            </Link>
                                        ) : (
                                            <Pill tone="green">{t("doctorPages.reviews.resolvedAt", { date: r.resolvedAt ? fmtDateTime(r.resolvedAt, locale) : "" })}</Pill>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <Empty title={t(showResolved ? "doctorPages.reviews.empty.resolved" : "doctorPages.reviews.empty.open")}>{t("doctorPages.reviews.empty.body")}</Empty>
            )}
        </div>
    );
}
