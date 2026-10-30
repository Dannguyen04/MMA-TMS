"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useMemo, useRef, useState } from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import type { TrainingType } from "@/lib/domain/types";
import { daysBetween, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LAB_CAMP, LAB_FIGHTER, LAB_NOW, type LabPhase } from "../lab-data";
import styles from "../lab.module.css";
import { useReducedMotion } from "@/components/fighter-3d/use-graphics";

gsap.registerPlugin(useGSAP);

const TOTAL_DAYS = daysBetween(LAB_CAMP.start, LAB_CAMP.fight);
const TODAY = daysBetween(LAB_CAMP.start, LAB_NOW.slice(0, 10));
const SUSPENSION_FROM = daysBetween(LAB_CAMP.start, LAB_CAMP.suspension.from);
const SUSPENSION_TO = daysBetween(LAB_CAMP.start, LAB_CAMP.suspension.to);

/** Types a concussion suspension blocks; R28 turns each blocked session into recovery while recovery stays allowed. */
const BLOCKED: TrainingType[] = ["sparring", "grappling", "pad_work"];

const TYPE_META: Record<TrainingType, { label: string; color: string }> = {
    pad_work: { label: "Đấm đích", color: "var(--chart-1)" },
    strength_conditioning: { label: "Thể lực", color: "var(--chart-4)" },
    sparring: { label: "Đấu tập", color: "var(--chart-8)" },
    grappling: { label: "Vật", color: "var(--chart-7)" },
    technical_drilling: { label: "Kỹ thuật", color: "var(--chart-2)" },
    recovery_mobility: { label: "Hồi phục", color: "var(--chart-3)" },
    shadow_boxing: { label: "Đấm gió", color: "var(--chart-5)" },
    heavy_bag: { label: "Bao cát", color: "var(--chart-6)" },
};

const PHASE_TINT: Record<LabPhase, string> = {
    base: "var(--chart-1)",
    build: "var(--chart-7)",
    fight_camp: "var(--chart-8)",
    taper: "var(--chart-3)",
};

const pct = (day: number) => `${((day / TOTAL_DAYS) * 100).toFixed(3)}%`;

type View = "before" | "after";

export function CampTimeline() {
    const root = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const [view, setView] = useState<View>("before");

    const sessions = useMemo(
        () =>
            LAB_CAMP.sessions.map((s) => {
                const inWindow = s.day >= SUSPENSION_FROM && s.day <= SUSPENSION_TO;
                const affected = inWindow && BLOCKED.includes(s.type);
                return { ...s, affected, past: s.day < TODAY };
            }),
        [],
    );
    const affected = sessions.filter((s) => s.affected && !s.past);
    const kgLeft = LAB_CAMP.weights.at(-1)!.kg - LAB_CAMP.targetKg;
    const week = Math.floor(TODAY / 7) + 1;

    const phases = LAB_CAMP.phases.map((p, i) => {
        const from = LAB_CAMP.phases.slice(0, i).reduce((days, earlier) => days + earlier.weeks * 7, 0);
        return { ...p, from, to: Math.min(from + p.weeks * 7, TOTAL_DAYS) };
    });
    const currentPhase = phases.find((p) => TODAY >= p.from && TODAY < p.to);

    // Weight: recorded points, then a dashed straight line to the target on fight day.
    const maxKg = 77.5;
    const minKg = 69.5;
    const y = (kg: number) => ((maxKg - kg) / (maxKg - minKg)) * 100;
    const x = (day: number) => (day / TOTAL_DAYS) * 1000;
    const recordedPath = LAB_CAMP.weights.map((w, i) => `${i ? "L" : "M"}${x(w.day).toFixed(1)},${y(w.kg).toFixed(2)}`).join(" ");
    const last = LAB_CAMP.weights.at(-1)!;
    const projection = `M${x(last.day).toFixed(1)},${y(last.kg).toFixed(2)} L${x(TOTAL_DAYS).toFixed(1)},${y(LAB_CAMP.targetKg).toFixed(2)}`;

    useGSAP(
        () => {
            if (reduced) return;
            const q = gsap.utils.selector(root);
            const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
            tl.from(q("[data-phase]"), { clipPath: "inset(0 100% 0 0)", duration: 0.9, stagger: 0.12 })
                .from(q("[data-today]"), { scaleY: 0, transformOrigin: "50% 0%", duration: 0.6 }, 0.35)
                .from(q("[data-dot]"), { scale: 0, opacity: 0, duration: 0.45, stagger: { amount: 0.6 } }, 0.45)
                .from(q("[data-weight]"), { strokeDashoffset: 1, duration: 1.2, ease: "power2.out" }, 0.5)
                .from(q("[data-window]"), { opacity: 0, duration: 0.5 }, 1.0)
                .from(q("[data-count]"), { textContent: 0, duration: 1.1, snap: { textContent: 1 }, ease: "power2.out" }, 0.2);
        },
        { scope: root, dependencies: [reduced] },
    );

    useGSAP(
        () => {
            if (reduced) return;
            const q = gsap.utils.selector(root);
            gsap.fromTo(q("[data-affected]"), { scale: 0.4 }, { scale: 1, duration: 0.5, ease: "back.out(2.4)", stagger: 0.05 });
        },
        { scope: root, dependencies: [view, reduced], revertOnUpdate: true },
    );

    return (
        <div ref={root} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-5 pt-5">
                <div>
                    <p className="font-display text-[22px] leading-6 font-extrabold text-fg italic">Camp của {LAB_FIGHTER.name}</p>
                    <p className="mt-1 text-sm text-fg-muted">
                        {formatDate(LAB_CAMP.start, "vi")} → đấu {formatDate(LAB_CAMP.fight, "vi")} với {LAB_FIGHTER.opponent}
                    </p>
                </div>
                <dl className="flex flex-wrap gap-x-8 gap-y-2">
                    <div>
                        <dt className="text-xs text-fg-subtle">Còn tới ngày đấu</dt>
                        <dd className="font-display text-[28px] leading-8 font-extrabold text-fg tabular-nums">
                            <span data-count>{TOTAL_DAYS - TODAY}</span> ngày
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-fg-subtle">Đang ở</dt>
                        <dd className="font-display text-[28px] leading-8 font-extrabold text-fg">
                            Tuần {week} · {currentPhase?.label}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-fg-subtle">Còn phải giảm</dt>
                        <dd className="font-display text-[28px] leading-8 font-extrabold text-fg tabular-nums">{kgLeft.toFixed(1).replace(".", ",")} kg</dd>
                    </div>
                </dl>
            </header>

            <div className="scrollbar-thin overflow-x-auto overflow-y-hidden">
                <div className="relative mx-5 mt-2 min-w-[720px] pt-6 pb-6">
                    {/* Phases */}
                    <div className="relative h-11">
                        {phases.map((p) => (
                            <div
                                key={p.phase}
                                data-phase
                                className="absolute inset-y-0 flex items-center overflow-hidden rounded-md px-3"
                                style={{
                                    left: pct(p.from),
                                    width: `calc(${pct(p.to - p.from)} - 3px)`,
                                    background: `color-mix(in oklab, ${PHASE_TINT[p.phase]} 16%, var(--surface))`,
                                    boxShadow: `inset 0 -3px 0 ${PHASE_TINT[p.phase]}`,
                                }}
                            >
                                <span className="truncate text-sm font-semibold text-fg">{p.label}</span>
                                <span className="ml-2 shrink-0 text-xs text-fg-muted">{p.weeks} tuần</span>
                            </div>
                        ))}
                    </div>

                    {/* Week ticks */}
                    <div className="relative mt-2 h-5 text-[11px] text-fg-subtle">
                        {Array.from({ length: Math.ceil(TOTAL_DAYS / 7) }, (_, w) => (
                            <span key={w} className="absolute tabular-nums" style={{ left: pct(w * 7) }}>
                                T{w + 1}
                            </span>
                        ))}
                    </div>

                    {/* Sessions and the suspension window */}
                    <div className="relative mt-1 h-28">
                        <div
                            data-window
                            className="absolute inset-y-0 rounded-md"
                            style={{
                                left: pct(SUSPENSION_FROM),
                                width: pct(SUSPENSION_TO - SUSPENSION_FROM + 1),
                                background: "repeating-linear-gradient(135deg, color-mix(in oklab, var(--danger-solid) 14%, transparent) 0 6px, transparent 6px 12px)",
                                boxShadow: "inset 0 0 0 1px var(--danger-border)",
                            }}
                        >
                            <span className="absolute top-1 left-1.5 rounded bg-danger-soft px-1.5 text-[11px] leading-5 font-semibold whitespace-nowrap text-danger-fg">
                                {LAB_CAMP.suspension.label}
                            </span>
                        </div>
                        {sessions.map((s) => {
                            const changed = view === "after" && s.affected && !s.past;
                            const type: TrainingType = changed ? "recovery_mobility" : s.type;
                            const flagged = view === "before" && s.affected && !s.past;
                            return (
                                <span
                                    key={s.day}
                                    data-dot
                                    {...(changed || flagged ? { "data-affected": "" } : {})}
                                    title={`${formatDate(addDays(LAB_CAMP.start, s.day), "vi")}: ${TYPE_META[type].label}${changed ? " (R28 đổi từ " + TYPE_META[s.type].label.toLowerCase() + ")" : ""}`}
                                    className={cn("absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full", s.past && "opacity-40", flagged && "size-3.5")}
                                    style={{
                                        left: pct(s.day + 0.5),
                                        top: `${32 + (TRAINING_ROW[type] ?? 0) * 12}%`,
                                        background: flagged ? "transparent" : TYPE_META[type].color,
                                        boxShadow: flagged
                                            ? `inset 0 0 0 2.5px ${TYPE_META[s.type].color}, 0 0 0 2px var(--surface), 0 0 0 4px var(--danger-solid)`
                                            : changed
                                              ? `0 0 0 2px var(--surface), 0 0 0 4px color-mix(in oklab, var(--success-solid) 55%, transparent)`
                                              : undefined,
                                    }}
                                />
                            );
                        })}
                        <div data-today className="absolute -top-[4.75rem] bottom-0 w-0.5 -translate-x-1/2 bg-corner-red" style={{ left: pct(TODAY + 0.5) }}>
                            <span className="absolute -top-0.5 left-1.5 -translate-y-full rounded bg-corner-red px-1.5 text-[11px] leading-5 font-semibold whitespace-nowrap text-white">Hôm nay</span>
                        </div>
                    </div>

                    {/* Weight */}
                    <div className="relative mt-3 h-24 border-t border-border">
                        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
                            <line x1="0" x2="1000" y1={y(LAB_CAMP.targetKg)} y2={y(LAB_CAMP.targetKg)} stroke="var(--chart-grid)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                            <path data-weight d={recordedPath} fill="none" stroke="var(--chart-1)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray="1" strokeDashoffset="0" />
                            <path d={projection} fill="none" stroke="var(--chart-1)" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
                        </svg>
                        <span className="absolute text-xs font-semibold text-chart-1 tabular-nums" style={{ left: `calc(${pct(last.day)} + 8px)`, top: `calc(${y(last.kg)}% - 20px)` }}>
                            {last.kg.toFixed(1).replace(".", ",")} kg
                        </span>
                        <span className="absolute right-0 text-xs text-fg-muted tabular-nums" style={{ top: `calc(${y(LAB_CAMP.targetKg)}% + 4px)` }}>
                            Mục tiêu {LAB_CAMP.targetKg.toFixed(1).replace(".", ",")} kg
                        </span>
                        <span className="absolute bottom-1 left-0 text-[11px] text-fg-subtle">Cân nặng</span>
                    </div>
                </div>
            </div>

            <footer className="flex flex-col gap-4 border-t border-border bg-surface-muted px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-muted">
                    {(["pad_work", "strength_conditioning", "sparring", "grappling", "technical_drilling", "recovery_mobility"] as TrainingType[]).map((t) => (
                        <span key={t} className="inline-flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full" style={{ background: TYPE_META[t].color }} />
                            {TYPE_META[t].label}
                        </span>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <p key={view} className={cn("text-sm text-fg", styles.rise)}>
                        {view === "before" ? (
                            <>
                                <span className="font-semibold text-danger-fg">{affected.length} buổi</span> trong thời gian đình chỉ cần xử lý
                            </>
                        ) : (
                            <>
                                R28: <span className="font-semibold text-success-fg">{affected.length} buổi</span> chuyển thành hồi phục
                            </>
                        )}
                    </p>
                    <SegmentedControl<View>
                        label="Lịch camp"
                        size="md"
                        value={view}
                        onChange={setView}
                        options={[
                            { value: "before", label: "Lịch gốc" },
                            { value: "after", label: "Sau khi xử lý" },
                        ]}
                    />
                </div>
            </footer>
        </div>
    );
}

/** Each type keeps its own lane so a week reads as a small score. */
const TRAINING_ROW: Partial<Record<TrainingType, number>> = {
    pad_work: 0,
    strength_conditioning: 1,
    sparring: 2,
    grappling: 3,
    technical_drilling: 4,
    recovery_mobility: 5,
};

function addDays(iso: string, days: number): string {
    const date = new Date(`${iso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}
