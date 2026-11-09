import type { Metadata } from "next";
import Link from "next/link";

import { CLEARANCE_LEVEL, CLEARANCE_TYPE, EXAM_TYPE, INJURY_STATUS, OUTCOME, PLAN_STATUS, REQUESTER_ROLE, dayKey, fmtDate, injuryName, injuryPlace, type Tone } from "@/components/doctor/labels";
import { Empty, FighterFilter, PageHead, Panel, Pill, ROW, ROW_LINK, SUB_LINK } from "@/components/doctor/ui";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { Table, TBody, TD, TR } from "@/components/ui/table";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { listClearances, listExaminations, listInjuries, listRecoveryPlans, listReviewRequests } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctor.history.title") };
}

type Kind = "exam" | "injury" | "plan" | "clearance" | "request";
interface Ev {
    id: string;
    at: string;
    kind: Kind;
    fighterId: string;
    title: string;
    detail?: string;
    href?: string;
    tone?: Tone;
}
const KIND: Record<Kind, string> = { exam: "Phiếu khám", injury: "Chấn thương", plan: "Phục hồi", clearance: "Giấy phép", request: "Yêu cầu" };

/** Lịch sử y tế: dòng thời gian dựng lại từ các danh sách đã có (khám, chấn thương, kế hoạch, giấy phép, yêu cầu xem xét). */
export default async function DoctorHistoryPage({ searchParams }: PageProps<"/doctor/history">) {
    const { t } = await getTranslator();
    const user = await requireRole("doctor");
    const query = await searchParams;
    const requested = param(query.fighter);
    const fighterId = requested && canAccessFighter(user, requested) ? requested : undefined;
    const kind = (Object.keys(KIND) as Kind[]).find((k) => k === param(query.kind));
    const scope = fighterId ? [fighterId] : accessibleFighterIds(user);
    const fighters = await listFighters(user);
    const [exams, injuries, plans, clearances, requests] = await Promise.all([
        listExaminations({ fighterIds: scope }),
        listInjuries({ fighterIds: scope }),
        listRecoveryPlans({ fighterIds: scope }),
        listClearances({ fighterIds: scope }),
        Promise.all(fighters.filter((f) => scope.includes(f.id)).map((f) => listReviewRequests(f.id).catch(() => []))).then((l) => l.flat()),
    ]);
    const nameOf = new Map(fighters.map((f) => [f.id, f.name]));
    const events: Ev[] = [
        ...exams.map<Ev>((e) => ({ id: e.id, at: e.date, kind: "exam", fighterId: e.fighterId, title: e.type ? EXAM_TYPE[e.type] : "Phiếu khám", detail: e.outcome ? OUTCOME[e.outcome].label : "Chưa kết luận", tone: e.outcome ? OUTCOME[e.outcome].tone : "neutral", href: routes.doctor.examination(e.id) })),
        ...injuries.map<Ev>((i) => ({ id: i.id, at: i.occurredAt, kind: "injury", fighterId: i.fighterId, title: `${injuryName(i)} · ${injuryPlace(i)}`, detail: INJURY_STATUS[i.status].label, tone: INJURY_STATUS[i.status].tone, href: routes.doctor.injury(i.id) })),
        ...plans.map<Ev>((p) => ({ id: p.id, at: p.startDate, kind: "plan", fighterId: p.fighterId, title: p.title, detail: PLAN_STATUS[p.status].label, tone: PLAN_STATUS[p.status].tone, href: routes.doctor.recoveryPlan(p.id) })),
        ...clearances.map<Ev>((c) => ({
            id: c.id,
            at: c.issuedAt,
            kind: "clearance",
            fighterId: c.fighterId,
            title: c.clearanceType ? CLEARANCE_TYPE[c.clearanceType] : CLEARANCE_LEVEL[c.level],
            detail: c.status === "revoked" ? `Thu hồi ${fmtDate(c.revokedAt)}` : c.validUntil ? `Đến ${fmtDate(c.validUntil)}` : "Không thời hạn",
            tone: c.status === "revoked" ? "red" : c.status === "active" ? "green" : "neutral",
        })),
        ...requests.map<Ev>((r) => ({ id: r.id, at: r.requestedAt, kind: "request", fighterId: r.fighterId, title: r.reason, detail: `${REQUESTER_ROLE[r.requesterRole]} · ${r.status === "OPEN" ? "Đang mở" : "Đã xử lý"}`, tone: r.status === "OPEN" ? "amber" : "neutral" })),
    ]
        .filter((e) => !kind || e.kind === kind)
        .sort((a, b) => b.at.localeCompare(a.at));
    const days = new Map<string, Ev[]>();
    for (const e of events) days.set(dayKey(e.at), [...(days.get(dayKey(e.at)) ?? []), e]);
    const base = routes.doctor.history;
    const href = (k?: Kind) => `${base}?${new URLSearchParams({ ...(fighterId ? { fighter: fighterId } : {}), ...(k ? { kind: k } : {}) })}`;

    return (
        <div className="flex flex-col gap-6">
            <PageHead title={t("doctor.history.title")} sub={`${events.length} sự kiện`} />
            <div className="flex min-w-0 flex-wrap items-center gap-3">
                <SegmentedLinks
                    label="Loại sự kiện"
                    className="max-w-full"
                    items={[
                        { href: href(), label: "Tất cả", active: !kind },
                        ...(Object.keys(KIND) as Kind[]).map((k) => ({ href: href(k), label: KIND[k], active: kind === k })),
                    ]}
                />
                <FighterFilter base={base} fighters={fighters} current={fighterId} extra={{ kind }} />
            </div>
            {events.length ? (
                [...days].map(([day, list]) => (
                    <Panel key={day} title={fmtDate(`${day}T12:00:00+07:00`)} id={`day-${day}`} className="overflow-hidden" contentClassName="px-0 pb-0">
                        <Table className="table-fixed border-t border-border">
                            <TBody>
                                    {list.map((e) => (
                                        <TR key={`${e.kind}-${e.id}`} className={ROW}>
                                            <TD className="w-[108px] pr-1 md:w-[120px]">
                                                <Pill>{KIND[e.kind]}</Pill>
                                            </TD>
                                            <TD className="break-words">
                                                {e.href ? (
                                                    <Link className={ROW_LINK} href={e.href}>
                                                        <b className="font-semibold">{e.title}</b>
                                                    </Link>
                                                ) : (
                                                    <b className="font-semibold">{e.title}</b>
                                                )}
                                                {/* Dưới 768 px cột Võ sĩ và cột trạng thái ẩn đi, hiện gộp dưới tiêu đề. */}
                                                <small className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg-muted md:hidden">
                                                    {nameOf.get(e.fighterId) ?? "Võ sĩ"}
                                                    {e.detail && <Pill tone={e.tone}>{e.detail}</Pill>}
                                                </small>
                                            </TD>
                                            <TD className="w-[22%] max-md:hidden">
                                                <Link className={SUB_LINK} href={routes.doctor.fighter(e.fighterId)}>
                                                    {nameOf.get(e.fighterId) ?? "Võ sĩ"}
                                                </Link>
                                            </TD>
                                            <TD className="w-[22%] max-md:hidden">{e.detail && <Pill tone={e.tone}>{e.detail}</Pill>}</TD>
                                        </TR>
                                    ))}
                            </TBody>
                        </Table>
                    </Panel>
                ))
            ) : (
                <Empty title="Chưa có sự kiện y tế" />
            )}
        </div>
    );
}
