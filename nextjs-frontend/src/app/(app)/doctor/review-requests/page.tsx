import { Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { REQUESTER_ROLE, fmtDateTime, rel } from "@/components/doctor/labels";
import { Empty, FighterFilter, PageHead, Pill } from "@/components/doctor/ui";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listReviewRequests } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Yêu cầu xem xét" };

/** Yêu cầu xem xét: gộp `listReviewRequests` của từng võ sĩ được phân công (cùng nguồn với hồ sơ võ sĩ). */
export default async function DoctorReviewRequestsPage({ searchParams }: PageProps<"/doctor/review-requests">) {
    const user = await requireRole("doctor");
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
            <PageHead title="Yêu cầu xem xét" sub={`${open.length} yêu cầu đang mở · trả lời bằng một phiếu khám mới`} />
            <div className="yt-filters">
                <nav className="yt-segs" aria-label="Trạng thái">
                    <Link href={q()} aria-current={!showResolved ? "page" : undefined}>
                        Đang mở · {open.length}
                    </Link>
                    <Link href={q("resolved")} aria-current={showResolved ? "page" : undefined}>
                        Đã xử lý · {all.length - open.length}
                    </Link>
                </nav>
            </div>
            <FighterFilter base={base} fighters={fighters} current={fighterId} extra={{ status: showResolved ? "resolved" : undefined }} />
            {rows.length ? (
                <div className="yt-tablewrap">
                    <table className="yt-table">
                        <thead>
                            <tr>
                                <th>Võ sĩ</th>
                                <th>Lý do</th>
                                <th className="yt-hide-sm">Người gửi</th>
                                <th className="yt-hide-sm">Thời điểm</th>
                                <th>Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td>
                                        <Link className="yt-rowlink" href={routes.doctor.fighter(r.fighterId)}>
                                            <b>{nameOf.get(r.fighterId) ?? "Võ sĩ"}</b>
                                        </Link>
                                    </td>
                                    <td>{r.reason}</td>
                                    <td className="yt-hide-sm">{REQUESTER_ROLE[r.requesterRole]}</td>
                                    <td className="yt-hide-sm">
                                        {fmtDateTime(r.requestedAt)} <span className="yt-muted">· {rel(r.requestedAt)}</span>
                                    </td>
                                    <td>
                                        {r.status === "OPEN" ? (
                                            <Link className="yt-btn" data-v="primary" href={`${routes.doctor.newExamination}?fighter=${r.fighterId}`}>
                                                <Stethoscope aria-hidden />
                                                Khám
                                            </Link>
                                        ) : (
                                            <Pill tone="green">Đã xử lý {r.resolvedAt ? fmtDateTime(r.resolvedAt) : ""}</Pill>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <Empty title={showResolved ? "Chưa có yêu cầu đã xử lý" : "Không có yêu cầu đang mở"}>Khi võ sĩ hoặc HLV yêu cầu khám lại, yêu cầu sẽ hiện ở đây.</Empty>
            )}
        </div>
    );
}
