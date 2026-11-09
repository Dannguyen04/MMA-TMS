import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PLAN_STATUS, fmtDate } from "@/components/doctor/labels";
import { planSteps } from "@/components/doctor/plan-steps";
import { Empty, FighterFilter, GoLink, PageHead, Pill } from "@/components/doctor/ui";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { listRecoveryPlans } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctor.recovery.title") };
}

/** Kế hoạch đang chạy lấy từ hồ sơ (`activeRecoveryPlans`), kế hoạch đã đóng dựng lại từ lịch sử RECOVERY_PLAN. */
export default async function DoctorRecoveryPage({ searchParams }: PageProps<"/doctor/recovery">) {
    const { t } = await getTranslator();
    const user = await requireRole("doctor");
    const query = await searchParams;
    const requested = param(query.fighter);
    const fighterId = requested && canAccessFighter(user, requested) ? requested : undefined;
    const [fighters, plans] = await Promise.all([listFighters(user), listRecoveryPlans({ fighterIds: fighterId ? [fighterId] : accessibleFighterIds(user) })]);
    const nameOf = new Map(fighters.map((f) => [f.id, f.name]));
    const sorted = [...plans].sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));
    const newHref = `${routes.doctor.recovery}/new${fighterId ? `?fighter=${fighterId}` : ""}`;

    return (
        <div className="yt-page pl-page">
            <PageHead
                title={t("doctor.recovery.title")}
                sub={`${plans.filter((p) => p.status === "active").length} đang thực hiện · ${plans.length} tổng`}
                actions={
                    <Link href={newHref} className="yt-btn" data-v="primary">
                        <Plus aria-hidden />
                        Lập kế hoạch
                    </Link>
                }
            />
            <FighterFilter base={routes.doctor.recovery} fighters={fighters} current={fighterId} />
            {sorted.length === 0 ? (
                <Empty
                    title="Chưa có kế hoạch phục hồi"
                    action={
                        <Link href={routes.doctor.injuries} className="yt-btn">
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
                                <div className="pl-card-head">
                                    <h2>{p.title}</h2>
                                </div>
                                <p className="yt-muted">
                                    <Link href={routes.doctor.fighter(p.fighterId)}>{nameOf.get(p.fighterId) ?? "Võ sĩ"}</Link> · {fmtDate(p.startDate)} → {fmtDate(p.targetReturnDate)}
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
                                <div className="pl-card-footer">
                                    <Pill tone={PLAN_STATUS[p.status].tone}>{PLAN_STATUS[p.status].label}</Pill>
                                    <GoLink href={routes.doctor.recoveryPlan(p.id)}>Mở kế hoạch</GoLink>
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
