"use client";

import { Ban, CircleAlert, CircleCheck, ShieldAlert, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { INJURY_STATUS_META } from "@/components/domain/status-badges";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TONE_FILL, TONE_SOFT, type Tone } from "@/components/ui/tone";
import { checkTrainingAgainstClearance, type ClearanceConflict } from "@/lib/domain/clearance-rules";
import { bodyRegionLabel } from "@/lib/domain/labels";
import type { BodyRegion, Injury } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import styles from "../lab.module.css";
import { LAB_CLEARANCE, LAB_FIGHTER, LAB_INJURIES, LAB_NOW, LAB_SESSIONS, type LabPlannedSession } from "../lab-data";
import type { BodyLook } from "@/components/fighter-3d/body/body-material";
import { BodyStage, type StageHighlight } from "@/components/fighter-3d/body/body-stage";

type Layer = "injuries" | "restrictions" | "plan";

const STATUS_TEXT: Record<Injury["status"], string> = { active: "Đang điều trị", recovering: "Đang hồi phục", resolved: "Đã khỏi" };
const SEVERITY_TEXT: Record<Injury["severity"], string> = { minor: "Nhẹ", moderate: "Vừa", severe: "Nặng", critical: "Nguy kịch" };

function injuryHighlights(): StageHighlight[] {
    return LAB_INJURIES.map((injury) => ({
        region: injury.bodyRegion,
        tone: INJURY_STATUS_META[injury.status].tone,
        label: injury.typeLabel ?? "",
        strength: injury.status === "resolved" ? 0.45 : 1,
        pulse: injury.status === "active",
        pinned: injury.status !== "resolved",
    }));
}

function restrictionHighlights(): StageHighlight[] {
    return LAB_CLEARANCE.restrictions.flatMap((restriction) =>
        restriction.blockedRegions.map((region) => ({ region, tone: "warning" as Tone, label: restriction.label, pinned: true })),
    );
}

function conflictsFor(session: LabPlannedSession): ClearanceConflict[] {
    return checkTrainingAgainstClearance(
        { type: session.type, targetRpe: session.targetRpe, techniques: session.type === "sparring" ? ["kick", "hook"] : [], loadsRegions: session.loadsRegions },
        LAB_CLEARANCE,
        LAB_NOW,
    );
}

function planHighlights(session: LabPlannedSession, conflicts: ClearanceConflict[]): StageHighlight[] {
    const blocked = conflicts.some((c) => c.severity === "block");
    const protectedRegions = new Set(conflicts.flatMap((c) => c.regions ?? []));
    return session.loadsRegions.map((region) => {
        const hit = protectedRegions.has(region);
        return {
            region,
            tone: hit ? (blocked ? "danger" : "warning") : "primary",
            label: hit ? "Vùng đang được bảo vệ" : "Chịu tải",
            strength: hit ? 1 : 0.6,
            pulse: hit,
            pinned: hit,
        };
    });
}

function conflictText(conflict: ClearanceConflict, session: LabPlannedSession): string {
    switch (conflict.code) {
        case "blocked_type":
            return `${session.label} bị cấm theo “${conflict.label}”.`;
        case "exceeds_rpe":
            return `Cường độ RPE ${conflict.targetRpe} vượt mức tối đa ${conflict.maxRpe}.`;
        case "restricted_technique":
            return `Có đòn đá, đang bị hạn chế theo “${conflict.label}”.`;
        case "protected_region":
            return `Tác động vào ${(conflict.regions ?? []).map((r) => bodyRegionLabel(r, "vi").toLowerCase()).join(", ")} (${conflict.label}).`;
        default:
            return conflict.message ?? conflict.code;
    }
}

export function BodyViewer({ look }: { look: BodyLook }) {
    const [layer, setLayer] = useState<Layer>("injuries");
    const [selected, setSelected] = useState<BodyRegion | null>(null);
    const [sessionType, setSessionType] = useState<LabPlannedSession["type"]>("sparring");
    const session = LAB_SESSIONS.find((s) => s.type === sessionType) ?? LAB_SESSIONS[0];
    const conflicts = useMemo(() => conflictsFor(session), [session]);
    const blocked = conflicts.some((c) => c.severity === "block");

    const highlights = useMemo(() => {
        if (layer === "injuries") return injuryHighlights();
        if (layer === "restrictions") return restrictionHighlights();
        return planHighlights(session, conflicts);
    }, [layer, session, conflicts]);

    const openInjuries = LAB_INJURIES.filter((i) => i.status !== "resolved");
    const regionInjuries = selected ? LAB_INJURIES.filter((i) => i.bodyRegion === selected) : [];
    const regionRestrictions = selected ? LAB_CLEARANCE.restrictions.filter((r) => r.blockedRegions.includes(selected)) : [];

    return (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <BodyStage
                look={look}
                model="muscular"
                highlights={highlights}
                selected={selected}
                onSelect={setSelected}
                zoomOnSelect
                scanKey={layer === "plan" ? LAB_SESSIONS.indexOf(session) + 10 : layer === "restrictions" ? 1 : 0}
                className="h-[500px] sm:h-[600px]"
                ariaLabel={`Cơ thể 3D của ${LAB_FIGHTER.name}`}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className={cn("font-display text-2xl leading-none font-extrabold italic", "text-fg")}>{LAB_FIGHTER.name}</p>
                        <p className={cn("mt-1 hidden text-[13px] sm:block", "text-fg-muted")}>
                            {LAB_FIGHTER.weightClass} · đấu {formatDate(LAB_FIGHTER.fightDate, "vi")}
                        </p>
                    </div>
                    <span className={cn("rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset", TONE_SOFT.warning)}>Tập có hạn chế</span>
                </div>
            </BodyStage>

            <div className="flex min-w-0 flex-col gap-4">
                <SegmentedControl<Layer>
                    label="Lớp dữ liệu trên cơ thể"
                    size="md"
                    value={layer}
                    onChange={(value) => {
                        setLayer(value);
                        setSelected(null);
                    }}
                    options={[
                        { value: "injuries", label: `Chấn thương · ${openInjuries.length}` },
                        { value: "restrictions", label: "Hạn chế tập" },
                        { value: "plan", label: "Thử xếp buổi" },
                    ]}
                    className="self-start"
                />

                {selected && (
                    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="font-display text-xl font-bold text-fg">{bodyRegionLabel(selected, "vi")}</h3>
                            <button type="button" onClick={() => setSelected(null)} className="text-sm text-fg-muted hover:text-fg">
                                Bỏ chọn
                            </button>
                        </div>
                        {regionInjuries.length === 0 && regionRestrictions.length === 0 ? (
                            <p className="mt-1 text-sm text-fg-muted">Không có chấn thương hay hạn chế ở vùng này.</p>
                        ) : (
                            <ul className="mt-2 flex flex-col gap-2 text-sm">
                                {regionInjuries.map((injury) => (
                                    <li key={injury.id} className="text-fg">
                                        <span className="font-semibold">{injury.typeLabel}</span>
                                        <span className="text-fg-muted"> · {STATUS_TEXT[injury.status].toLowerCase()} · {injury.description}</span>
                                    </li>
                                ))}
                                {regionRestrictions.map((r) => (
                                    <li key={r.id} className="text-fg">
                                        <span className="font-semibold">{r.label}</span>
                                        <span className="text-fg-muted"> · bác sĩ yêu cầu bảo vệ vùng này</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {layer === "injuries" && (
                    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
                        {LAB_INJURIES.map((injury) => {
                            const meta = INJURY_STATUS_META[injury.status];
                            const active = selected === injury.bodyRegion;
                            return (
                                <li key={injury.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelected(active ? null : injury.bodyRegion)}
                                        aria-pressed={active}
                                        className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover", active && "bg-surface-muted")}
                                    >
                                        <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", injury.status === "active" && "animate-pulse", TONE_FILL[meta.tone])} />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                                                <span className="font-semibold text-fg">{injury.typeLabel}</span>
                                                <span className="text-xs text-fg-subtle">{bodyRegionLabel(injury.bodyRegion, "vi")}</span>
                                            </span>
                                            <span className="mt-0.5 block text-[13px] text-fg-muted">
                                                {STATUS_TEXT[injury.status]} · mức {SEVERITY_TEXT[injury.severity].toLowerCase()}
                                                {injury.status !== "resolved" && injury.expectedReturnAt && ` · dự kiến tập lại ${formatDate(injury.expectedReturnAt, "vi")}`}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {layer === "restrictions" && (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-fg-muted">
                            Giấy phép tập có hạn chế, hiệu lực tới {formatDate(LAB_CLEARANCE.validUntil ?? LAB_NOW, "vi")}. {LAB_CLEARANCE.reason}
                        </p>
                        {LAB_CLEARANCE.restrictions.map((r) => (
                            <div key={r.id} className="rounded-xl border border-border bg-surface p-4 shadow-card">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert aria-hidden className="size-4 text-warning-fg" />
                                    <h3 className="font-semibold text-fg">{r.label}</h3>
                                </div>
                                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                                    <dt className="text-fg-subtle">Vùng bảo vệ</dt>
                                    <dd className="text-fg">{r.blockedRegions.map((x) => bodyRegionLabel(x, "vi")).join(", ")}</dd>
                                    {r.blockedTrainingTypes.length > 0 && (
                                        <>
                                            <dt className="text-fg-subtle">Cấm loại buổi</dt>
                                            <dd className="text-fg">Đấu tập</dd>
                                        </>
                                    )}
                                    {r.maxRpe !== null && (
                                        <>
                                            <dt className="text-fg-subtle">Cường độ tối đa</dt>
                                            <dd className="text-fg">RPE {r.maxRpe}</dd>
                                        </>
                                    )}
                                    {r.blockedTechniques.length > 0 && (
                                        <>
                                            <dt className="text-fg-subtle">Hạn chế đòn</dt>
                                            <dd className="text-fg">Đòn đá</dd>
                                        </>
                                    )}
                                </dl>
                            </div>
                        ))}
                    </div>
                )}

                {layer === "plan" && (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-fg-muted">Chọn loại buổi HLV định xếp. Vùng chịu tải sáng xanh, vùng bác sĩ đang bảo vệ nhấp nháy.</p>
                        <div role="group" aria-label="Loại buổi" className="flex flex-wrap gap-2">
                            {LAB_SESSIONS.map((s) => {
                                const on = s.type === sessionType;
                                return (
                                    <button
                                        key={s.type}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => setSessionType(s.type)}
                                        className={cn(
                                            "h-9 rounded-lg px-3.5 text-sm font-medium ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                                            on ? "bg-primary text-primary-fg ring-transparent" : "bg-surface text-fg ring-border hover:bg-surface-hover",
                                        )}
                                    >
                                        {s.label} <span className={on ? "opacity-80" : "text-fg-subtle"}>RPE {s.targetRpe}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div
                            key={session.type}
                            className={cn(
                                "rounded-xl p-4 ring-1 ring-inset", styles.rise,
                                conflicts.length === 0 ? TONE_SOFT.success : blocked ? TONE_SOFT.danger : TONE_SOFT.warning,
                            )}
                        >
                            <p className="flex items-center gap-2 font-semibold">
                                {conflicts.length === 0 ? <CircleCheck aria-hidden className="size-4" /> : blocked ? <Ban aria-hidden className="size-4" /> : <TriangleAlert aria-hidden className="size-4" />}
                                {conflicts.length === 0 ? `Xếp được buổi ${session.label.toLowerCase()}` : blocked ? `Không xếp được: ${conflicts.length} lý do` : "Xếp được, HLV cần xác nhận"}
                            </p>
                            {conflicts.length > 0 && (
                                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                                    {conflicts.map((c, i) => (
                                        <li key={i} className="flex gap-2">
                                            <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 opacity-80" />
                                            <span>{conflictText(c, session)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <p className="text-xs text-fg-subtle">Kết quả chạy bằng đúng hàm kiểm tra giấy phép của app (checkTrainingAgainstClearance).</p>
                    </div>
                )}
            </div>
        </div>
    );
}
