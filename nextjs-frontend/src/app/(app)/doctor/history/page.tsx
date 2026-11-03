import type { Metadata } from "next";
import Link from "next/link";

import { CLEARANCE_LEVEL, CLEARANCE_TYPE, EXAM_TYPE, INJURY_STATUS, OUTCOME, PLAN_STATUS, REQUESTER_ROLE, dayKey, fmtDate, injuryName, injuryPlace, type Tone } from "@/components/doctor/labels";
import { Empty, FighterFilter, PageHead, Pill } from "@/components/doctor/ui";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listClearances, listExaminations, listInjuries, listRecoveryPlans, listReviewRequests } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Lịch sử y tế" };

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
        <div className="yt-page">
            <PageHead title="Lịch sử y tế" sub={`${events.length} sự kiện`} />
            <div className="yt-filters">
                <nav className="yt-segs" aria-label="Loại sự kiện">
                    <Link href={href()} aria-current={!kind ? "page" : undefined}>
                        Tất cả
                    </Link>
                    {(Object.keys(KIND) as Kind[]).map((k) => (
                        <Link key={k} href={href(k)} aria-current={kind === k ? "page" : undefined}>
                            {KIND[k]}
                        </Link>
                    ))}
                </nav>
            </div>
            <FighterFilter base={base} fighters={fighters} current={fighterId} extra={{ kind }} />
            {events.length ? (
                [...days].map(([day, list]) => (
                    <section key={day} className="yt-panel" data-shot={`day-${day}`}>
                        <header className="yt-panel-head">
                            <h2>{fmtDate(`${day}T12:00:00+07:00`)}</h2>
                        </header>
                        <div className="yt-tablewrap">
                            <table className="yt-table" style={{ tableLayout: "fixed" }}>
                                <tbody>
                                    {list.map((e) => (
                                        <tr key={`${e.kind}-${e.id}`}>
                                            <td style={{ width: 120 }}>
                                                <Pill>{KIND[e.kind]}</Pill>
                                            </td>
                                            <td>
                                                {e.href ? (
                                                    <Link className="yt-rowlink" href={e.href}>
                                                        <b>{e.title}</b>
                                                    </Link>
                                                ) : (
                                                    <b>{e.title}</b>
                                                )}
                                            </td>
                                            <td className="yt-hide-sm" style={{ width: "22%" }}>
                                                <Link className="yt-rowlink" href={routes.doctor.fighter(e.fighterId)}>
                                                    {nameOf.get(e.fighterId) ?? "Võ sĩ"}
                                                </Link>
                                            </td>
                                            <td style={{ width: "22%" }}>{e.detail && <Pill tone={e.tone}>{e.detail}</Pill>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ))
            ) : (
                <Empty title="Chưa có sự kiện y tế" />
            )}
        </div>
    );
}
