import { Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { REQUESTER_ROLE, fmtDateTime, rel } from "@/components/doctor/labels";
import { Empty, FighterFilter, PageHead, Pill, ROW, ROW_LINK } from "@/components/doctor/ui";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { listReviewRequests } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctor.reviews.title") };
}

/** Yêu cầu xem xét: gộp `listReviewRequests` của từng võ sĩ được phân công (cùng nguồn với hồ sơ võ sĩ). */
export default async function DoctorReviewRequestsPage({ searchParams }: PageProps<"/doctor/review-requests">) {
    const { t } = await getTranslator();
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
        <div className="flex flex-col gap-6">
            <PageHead title={t("doctor.reviews.title")} sub={`${open.length} yêu cầu đang mở · trả lời bằng một phiếu khám mới`} />
            <div className="flex min-w-0 flex-wrap items-center gap-3">
                <SegmentedLinks
                    label="Trạng thái"
                    items={[
                        { href: q(), label: "Đang mở", count: open.length, active: !showResolved },
                        { href: q("resolved"), label: "Đã xử lý", count: all.length - open.length, active: showResolved },
                    ]}
                />
                <FighterFilter base={base} fighters={fighters} current={fighterId} extra={{ status: showResolved ? "resolved" : undefined }} />
            </div>
            {rows.length ? (
                <Card className="overflow-hidden">
                    <Table>
                        <THead>
                            <tr>
                                <TH>Võ sĩ</TH>
                                <TH>Lý do</TH>
                                <TH className="max-md:hidden">Người gửi</TH>
                                <TH className="max-md:hidden">Thời điểm</TH>
                                <TH>Trạng thái</TH>
                            </tr>
                        </THead>
                        <TBody>
                            {rows.map((r) => (
                                <TR key={r.id} className={ROW}>
                                    <TD>
                                        <Link className={ROW_LINK} href={routes.doctor.fighter(r.fighterId)}>
                                            <b className="font-semibold">{nameOf.get(r.fighterId) ?? "Võ sĩ"}</b>
                                        </Link>
                                    </TD>
                                    <TD>{r.reason}</TD>
                                    <TD className="max-md:hidden">{REQUESTER_ROLE[r.requesterRole]}</TD>
                                    <TD className="max-md:hidden">
                                        {fmtDateTime(r.requestedAt)} <span className="text-fg-muted">· {rel(r.requestedAt)}</span>
                                    </TD>
                                    <TD>
                                        {r.status === "OPEN" ? (
                                            <ButtonLink size="sm" className="relative z-10" href={`${routes.doctor.newExamination}?fighter=${r.fighterId}`}>
                                                <Stethoscope aria-hidden />
                                                Khám
                                            </ButtonLink>
                                        ) : (
                                            <Pill tone="green">Đã xử lý {r.resolvedAt ? fmtDateTime(r.resolvedAt) : ""}</Pill>
                                        )}
                                    </TD>
                                </TR>
                            ))}
                        </TBody>
                    </Table>
                </Card>
            ) : (
                <Empty title={showResolved ? "Chưa có yêu cầu đã xử lý" : "Không có yêu cầu đang mở"}>Khi võ sĩ hoặc HLV yêu cầu khám lại, yêu cầu sẽ hiện ở đây.</Empty>
            )}
        </div>
    );
}
