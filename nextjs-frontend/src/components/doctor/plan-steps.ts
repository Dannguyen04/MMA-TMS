import type { RecoveryPlan } from "@/lib/domain/types";

export interface PlanStep {
    key: string;
    title: string;
    detail: string | null;
    date: string | null;
    done: boolean;
}

/** Các bước của kế hoạch: mốc phẳng (dịch vụ y tế) hoặc giai đoạn (dữ liệu demo). */
export function planSteps(plan: RecoveryPlan): PlanStep[] {
    if (plan.milestones?.length) {
        return plan.milestones.map((m) => ({ key: m.id, title: m.title, detail: m.criteria || null, date: m.completedAt ?? m.targetDate, done: m.isCompleted }));
    }
    return plan.phases.map((p) => ({ key: p.id, title: p.name, detail: p.goal || null, date: p.endDate, done: p.status === "completed" }));
}
