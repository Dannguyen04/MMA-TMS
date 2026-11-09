import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PLAN_STATUS, fmtDate } from "@/components/doctor/labels";
import { planSteps } from "@/components/doctor/plan-steps";
import { Empty, FighterFilter, GoLink, PageHead, Pill } from "@/components/doctor/ui";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { listRecoveryPlans } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { cn, param } from "@/lib/utils";

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
        <div className="flex flex-col gap-6">
            <PageHead
                title={t("doctor.recovery.title")}
                sub={`${plans.filter((p) => p.status === "active").length} đang thực hiện · ${plans.length} tổng`}
                actions={
                    <ButtonLink href={newHref}>
                        <Plus aria-hidden />
                        Lập kế hoạch
                    </ButtonLink>
                }
            />
            <FighterFilter base={routes.doctor.recovery} fighters={fighters} current={fighterId} />
            {sorted.length === 0 ? (
                <Empty
                    title="Chưa có kế hoạch phục hồi"
                    action={
                        <ButtonLink href={routes.doctor.injuries} variant="secondary">
                            Xem chấn thương
                        </ButtonLink>
                    }
                >
                    Kế hoạch được lập từ một chấn thương đang mở.
                </Empty>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,270px),1fr))] gap-4">
                    {sorted.map((p) => {
                        const steps = planSteps(p);
                        const done = steps.filter((m) => m.done).length;
                        const nextIdx = steps.findIndex((m) => !m.done);
                        const nx = steps[nextIdx];
                        return (
                            <Card key={p.id} role="region" aria-labelledby={`plan-${p.id}`} className="flex min-w-0 flex-col gap-2 p-4">
                                <h2 id={`plan-${p.id}`} className="text-[15px] leading-snug font-semibold text-fg">
                                    {p.title}
                                </h2>
                                <p className="text-[13px] text-fg-muted">
                                    <Link href={routes.doctor.fighter(p.fighterId)} className="font-medium text-fg hover:underline">
                                        {nameOf.get(p.fighterId) ?? "Võ sĩ"}
                                    </Link>{" "}
                                    · {fmtDate(p.startDate)} → {fmtDate(p.targetReturnDate)}
                                </p>
                                {steps.length > 0 && (
                                    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label={`${done}/${steps.length} mốc hoàn thành`} role="img">
                                        {steps.map((m, i) => (
                                            <i key={m.key} className={cn("h-1 rounded-full", m.done ? "bg-success-solid" : i === nextIdx ? "bg-warning-solid" : "bg-surface-hover")} />
                                        ))}
                                    </div>
                                )}
                                <p className="text-[13px] text-fg">
                                    <b className="font-semibold">
                                        {done}/{steps.length} mốc
                                    </b>
                                    {nx ? ` · tiếp theo: ${nx.title}${nx.date ? ` (${fmtDate(nx.date)})` : ""}` : " · đã xong mọi mốc"}
                                </p>
                                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                                    <Pill tone={PLAN_STATUS[p.status].tone}>{PLAN_STATUS[p.status].label}</Pill>
                                    <GoLink href={routes.doctor.recoveryPlan(p.id)}>Mở kế hoạch</GoLink>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
