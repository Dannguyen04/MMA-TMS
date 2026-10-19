import { Clock, TriangleAlert } from "lucide-react";

import { Callout } from "@/components/training/callout";
import type { WeightWarningStatus } from "@/lib/domain/types";
import { formatNumber, formatShortDate } from "@/lib/format";

export interface WeightFiguresProps {
    latestKg: number | null;
    /** Academy day of the latest weigh-in, `YYYY-MM-DD`. */
    latestOn: string | null;
    limitKg: number;
    remainingPct: number | null;
    catchweight?: boolean;
}

/** Latest weight, the limit and what is left to cut: three numbers, one short caption each. */
export function WeightFigures({ latestKg, latestOn, limitKg, remainingPct, catchweight = false }: WeightFiguresProps) {
    const overKg = latestKg === null ? null : Math.max(0, latestKg - limitKg);
    return (
        <dl className="grid grid-cols-3 gap-3">
            <Figure label="Latest" value={latestKg === null ? "—" : `${formatNumber(latestKg, 1)} kg`} caption={latestOn ? formatShortDate(`${latestOn}T12:00:00+07:00`) : "None yet"} />
            <Figure label="Limit" value={`${formatNumber(limitKg, 1)} kg`} caption={catchweight ? "Catchweight" : undefined} />
            <Figure label="To cut" value={remainingPct === null ? "—" : `${formatNumber(remainingPct, 1)}%`} caption={overKg === null ? undefined : `${formatNumber(overKg, 1)} kg`} />
        </dl>
    );
}

function Figure({ label, value, caption }: { label: string; value: string; caption?: string }) {
    return (
        <div className="flex min-w-0 flex-col rounded-lg bg-surface-muted px-3 py-2.5">
            <dt className="text-xs text-fg-muted">{label}</dt>
            <dd className="font-display text-2xl leading-tight font-bold text-fg">{value}</dd>
            {caption && <dd className="text-xs text-fg-subtle">{caption}</dd>}
        </div>
    );
}

const NOTES: Record<"coach" | "fighter", Partial<Record<WeightWarningStatus, { title: string; text?: string }>>> = {
    coach: {
        RED: { title: "Cut too steep for the time left", text: "Talk to medical staff today. Consider a catchweight or moving up a class." },
        YELLOW: { title: "Above the reference path", text: "Check training load and hydration." },
        GREY: { title: "No weigh-in for 3 days", text: "Remind the fighter to log each morning." },
    },
    fighter: {
        RED: { title: "Your cut is too steep for the time left", text: "Talk to your coach and medical staff today." },
        YELLOW: { title: "Above your planned path" },
        GREY: { title: "No weigh-in for 3 days", text: "Log your weight each morning." },
    },
};

/** One short note for a status that needs action; nothing when the cut is on track. */
export function WeightStatusNote({ status, audience }: { status: WeightWarningStatus; audience: "coach" | "fighter" }) {
    const note = NOTES[audience][status];
    if (!note) return null;
    const tone = status === "RED" ? "danger" : status === "YELLOW" ? "warning" : "neutral";
    return (
        <Callout tone={tone} icon={status === "GREY" ? Clock : TriangleAlert} title={note.title}>
            {note.text}
        </Callout>
    );
}
