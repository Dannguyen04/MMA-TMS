import { Plus } from "lucide-react";
import Link from "next/link";

import { PLAN_STATUS, fmtDate, injuryName, injuryPlace } from "@/components/doctor/labels";
import { planSteps } from "@/components/doctor/plan-steps";
import { RecoveryPlanPanel } from "@/components/doctor/recovery-plan-panel";
import { Empty, FighterFilter, GoLink, Pill } from "@/components/doctor/ui";

import { ListHead } from "./list-head";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { listInjuries, listRecoveryPlans } from "@/lib/services/medical";
import { getDoctor, listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

/** Kế hoạch đang chạy lấy từ hồ sơ (`activeRecoveryPlans`), kế hoạch đã đóng dựng lại từ lịch sử RECOVERY_PLAN. */
export async function RecoveryView({ query, fighterId: scopedId }: { query: Record<string, string | string[] | undefined>; fighterId?: string }) {
    const user = await requireRole("doctor");
    const requested = scopedId ?? param(query.fighter);
    const fighterId = requested && canAccessFighter(user, requested) ? requested : undefined;
    const [fighters, plans] = await Promise.all([listFighters(user), listRecoveryPlans({ fighterIds: fighterId ? [fighterId] : accessibleFighterIds(user) })]);
    const nameOf = new Map(fighters.map((f) => [f.id, f.name]));
    const sorted = [...plans].sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));
    const newHref = scopedId ? routes.doctor.fighterNewRecoveryPlan(scopedId) : `${routes.doctor.recovery}/new${fighterId ? `?fighter=${fighterId}` : ""}`;

    // Inside the profile: each active plan opened up as a timeline, finished ones as a short list below.
    if (scopedId) {
        const now = new Date().toISOString();
        const active = sorted.filter((p) => p.status === "active");
        const ended = sorted.filter((p) => p.status !== "active");
        const [injuries, doctors] = await Promise.all([
            listInjuries({ fighterIds: [scopedId] }),
            Promise.all([...new Set(active.map((p) => p.doctorId))].map((id) => getDoctor(id))),
        ]);
        const injuryOf = new Map(injuries.map((i) => [i.id, `${injuryName(i)} · ${injuryPlace(i)}`]));
        const doctorOf = new Map(doctors.flatMap((d) => (d ? [[d.id, d.name] as const] : [])));
        return (
            <>
                <ListHead scoped title="Kế hoạch phục hồi" sub={`${active.length} đang thực hiện · ${plans.length} tổng`} />
                {active.length === 0 ? (
                    <Empty
                        title="Không có kế hoạch đang thực hiện"
                        action={
                            <Link href={routes.doctor.fighterInjuries(scopedId)} className="yt-btn">
                                Xem chấn thương
                            </Link>
                        }
                    >
                        Kế hoạch được lập từ một chấn thương đang mở, bằng nút Lập kế hoạch phục hồi ở đầu hồ sơ.
                    </Empty>
                ) : (
                    active.map((p) => (
                        <RecoveryPlanPanel
                            key={p.id}
                            plan={p}
                            injury={p.injuryId ? (injuryOf.get(p.injuryId) ?? null) : null}
                            doctorName={doctorOf.get(p.doctorId) ?? null}
                            now={now}
                        />
                    ))
                )}
                <section className="rp-ended" aria-labelledby="rp-ended-h">
                    <h3 id="rp-ended-h">Đã kết thúc</h3>
                    {ended.length === 0 ? (
                        <p className="rp-none">Chưa có kế hoạch nào đã kết thúc.</p>
                    ) : (
                        <ul>
                            {ended.map((p) => (
                                <li key={p.id}>
                                    <Link className="yt-rowlink" href={routes.doctor.fighterRecoveryPlan(p.fighterId, p.id)}>
                                        {p.title}
                                    </Link>
                                    <small>
                                        {fmtDate(p.startDate)} → {fmtDate(p.targetReturnDate)}
                                    </small>
                                    <Pill tone={PLAN_STATUS[p.status].tone}>{PLAN_STATUS[p.status].label}</Pill>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </>
        );
    }

    return (
        <>
            <ListHead
                scoped={!!scopedId}
                title="Kế hoạch phục hồi"
                sub={`${plans.filter((p) => p.status === "active").length} đang thực hiện · ${plans.length} tổng`}
                actions={
                    <Link href={newHref} className="yt-btn" data-v="primary">
                        <Plus aria-hidden />
                        Lập kế hoạch
                    </Link>
                }
            />
            {!scopedId && <FighterFilter base={routes.doctor.recovery} fighters={fighters} current={fighterId} />}
            {sorted.length === 0 ? (
                <Empty
                    title="Chưa có kế hoạch phục hồi"
                    action={
                        <Link href={scopedId ? routes.doctor.fighterInjuries(scopedId) : routes.doctor.injuries} className="yt-btn">
                            Xem chấn thương
                        </Link>
                    }
                >
                    Kế hoạch được lập từ một chấn thương đang mở.
                </Empty>
            ) : (
                <div className="pl-cards" data-shot="cards">
                    {sorted.map((p) => {
                        const steps = planSteps(p);
                        const done = steps.filter((m) => m.done).length;
                        const nextIdx = steps.findIndex((m) => !m.done);
                        const nx = steps[nextIdx];
                        return (
                            <section key={p.id} className="yt-panel pl-card">
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                    <h2>{p.title}</h2>
                                    <Pill tone={PLAN_STATUS[p.status].tone}>{PLAN_STATUS[p.status].label}</Pill>
                                </div>
                                <p className="yt-muted">
                                    {!scopedId && (
                                        <>
                                            <Link href={routes.doctor.fighter(p.fighterId)}>{nameOf.get(p.fighterId) ?? "Võ sĩ"}</Link> ·{" "}
                                        </>
                                    )}
                                    {fmtDate(p.startDate)} → {fmtDate(p.targetReturnDate)}
                                </p>
                                {steps.length > 0 && (
                                    <div className="pl-track" style={{ ["--n" as string]: steps.length }} aria-label={`${done}/${steps.length} mốc hoàn thành`} role="img">
                                        {steps.map((m, i) => (
                                            <i key={m.key} data-done={m.done} data-next={i === nextIdx} style={{ ["--i" as string]: i }} />
                                        ))}
                                    </div>
                                )}
                                <p>
                                    <b>
                                        {done}/{steps.length} mốc
                                    </b>
                                    {nx ? ` · tiếp theo: ${nx.title}${nx.date ? ` (${fmtDate(nx.date)})` : ""}` : " · đã xong mọi mốc"}
                                </p>
                                <GoLink href={routes.doctor.fighterRecoveryPlan(p.fighterId, p.id)}>Mở kế hoạch</GoLink>
                            </section>
                        );
                    })}
                </div>
            )}
        </>
    );
}
