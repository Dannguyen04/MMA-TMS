import Link from "next/link";

import { CLEARANCE_LEVEL, CLEARANCE_TYPE, EXAM_TYPE, INJURY_STATUS, OUTCOME, PLAN_STATUS, REQUESTER_ROLE, dayKey, fmtDate, injuryName, injuryPlace, type Tone } from "@/components/doctor/labels";
import { Empty, FighterFilter, Pill } from "@/components/doctor/ui";

import { ListHead } from "./list-head";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listClearances, listExaminations, listInjuries, listRecoveryPlans, listReviewRequests } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type MessageKey } from "@/lib/i18n/translate";
import { param } from "@/lib/utils";

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
const KIND: Record<Kind, MessageKey> = {
    exam: "doctorViews.history.kind.exam",
    injury: "doctorViews.history.kind.injury",
    plan: "doctorViews.history.kind.plan",
    clearance: "doctorViews.history.kind.clearance",
    request: "doctorViews.history.kind.request",
};

/** Lịch sử y tế: dòng thời gian dựng lại từ các danh sách đã có (khám, chấn thương, kế hoạch, giấy phép, yêu cầu xem xét). */
export async function HistoryView({ query, fighterId: scopedId }: { query: Record<string, string | string[] | undefined>; fighterId?: string }) {
    const user = await requireRole("doctor");
    const { t, locale } = await getTranslator();
    const requested = scopedId ?? param(query.fighter);
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
        ...exams.map<Ev>((e) => ({ id: e.id, at: e.date, kind: "exam", fighterId: e.fighterId, title: t(e.type ? EXAM_TYPE[e.type] : "doctorViews.history.kind.exam"), detail: e.outcome ? t(OUTCOME[e.outcome].label) : t("doctorViews.history.noOutcome"), tone: e.outcome ? OUTCOME[e.outcome].tone : "neutral", href: routes.doctor.fighterExamination(e.fighterId, e.id) })),
        ...injuries.map<Ev>((i) => ({ id: i.id, at: i.occurredAt, kind: "injury", fighterId: i.fighterId, title: `${injuryName(t, i)} · ${injuryPlace(t, i)}`, detail: t(INJURY_STATUS[i.status].label), tone: INJURY_STATUS[i.status].tone, href: routes.doctor.fighterInjury(i.fighterId, i.id) })),
        ...plans.map<Ev>((p) => ({ id: p.id, at: p.startDate, kind: "plan", fighterId: p.fighterId, title: p.title, detail: t(PLAN_STATUS[p.status].label), tone: PLAN_STATUS[p.status].tone, href: routes.doctor.fighterRecoveryPlan(p.fighterId, p.id) })),
        ...clearances.map<Ev>((c) => ({
            id: c.id,
            at: c.issuedAt,
            kind: "clearance",
            fighterId: c.fighterId,
            title: t(c.clearanceType ? CLEARANCE_TYPE[c.clearanceType] : CLEARANCE_LEVEL[c.level]),
            detail:
                c.status === "revoked"
                    ? t("doctorViews.history.revokedOn", { date: fmtDate(c.revokedAt, locale) })
                    : c.validUntil
                      ? t("doctorViews.history.until", { date: fmtDate(c.validUntil, locale) })
                      : t("doctorViews.history.noEnd"),
            tone: c.status === "revoked" ? "red" : c.status === "active" ? "green" : "neutral",
        })),
        ...requests.map<Ev>((r) => ({ id: r.id, at: r.requestedAt, kind: "request", fighterId: r.fighterId, title: r.reason, detail: `${t(REQUESTER_ROLE[r.requesterRole])} · ${t(r.status === "OPEN" ? "doctorViews.history.open" : "doctorViews.history.handled")}`, tone: r.status === "OPEN" ? "amber" : "neutral" })),
    ]
        .filter((e) => !kind || e.kind === kind)
        .sort((a, b) => b.at.localeCompare(a.at));
    const days = new Map<string, Ev[]>();
    for (const e of events) days.set(dayKey(e.at), [...(days.get(dayKey(e.at)) ?? []), e]);
    const base = scopedId ? routes.doctor.fighterHistory(scopedId) : routes.doctor.history;
    const href = (k?: Kind) => `${base}?${new URLSearchParams({ ...(fighterId && !scopedId ? { fighter: fighterId } : {}), ...(k ? { kind: k } : {}) })}`;

    return (
        <>
            <ListHead scoped={!!scopedId} title={t("doctorViews.history.title")} sub={plural(t, "doctorViews.history.count", events.length)} />
            <div className="yt-filters">
                <nav className="yt-segs" aria-label={t("doctorViews.history.kinds")}>
                    <Link href={href()} aria-current={!kind ? "page" : undefined}>
                        {t("doctorViews.history.all")}
                    </Link>
                    {(Object.keys(KIND) as Kind[]).map((k) => (
                        <Link key={k} href={href(k)} aria-current={kind === k ? "page" : undefined}>
                            {t(KIND[k])}
                        </Link>
                    ))}
                </nav>
            </div>
            {!scopedId && <FighterFilter base={base} fighters={fighters} current={fighterId} extra={{ kind }} t={t} />}
            {events.length ? (
                [...days].map(([day, list]) => (
                    <section key={day} className="yt-panel" data-shot={`day-${day}`}>
                        <header className="yt-panel-head">
                            <h2>{fmtDate(`${day}T12:00:00+07:00`, locale)}</h2>
                        </header>
                        <div className="yt-tablewrap">
                            <table className="yt-table" style={{ tableLayout: "fixed" }}>
                                <tbody>
                                    {list.map((e) => (
                                        <tr key={`${e.kind}-${e.id}`}>
                                            <td style={{ width: 120 }}>
                                                <Pill>{t(KIND[e.kind])}</Pill>
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
                                            {!scopedId && (
                                                <td className="yt-hide-sm" style={{ width: "22%" }}>
                                                    <Link className="yt-sublink" href={routes.doctor.fighter(e.fighterId)}>
                                                        {nameOf.get(e.fighterId) ?? t("doctorViews.common.fighter")}
                                                    </Link>
                                                </td>
                                            )}
                                            <td style={{ width: "22%" }}>{e.detail && <Pill tone={e.tone}>{e.detail}</Pill>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ))
            ) : (
                <Empty title={t("doctorViews.history.empty")} />
            )}
        </>
    );
}
