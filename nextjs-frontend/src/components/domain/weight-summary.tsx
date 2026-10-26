import { Clock, TriangleAlert } from "lucide-react";

import { Callout } from "@/components/training/callout";
import type { WeightWarningStatus } from "@/lib/domain/types";
import { formatNumber, formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey, Translator } from "@/lib/i18n/translate";

export interface WeightFiguresProps {
    latestKg: number | null;
    /** Academy day of the latest weigh-in, `YYYY-MM-DD`. */
    latestOn: string | null;
    limitKg: number;
    remainingPct: number | null;
    catchweight?: boolean;
    t: Translator;
    locale: Locale;
}

/** Latest weight, the limit and what is left to cut: three numbers, one short caption each. */
export function WeightFigures({ latestKg, latestOn, limitKg, remainingPct, catchweight = false, t, locale }: WeightFiguresProps) {
    const overKg = latestKg === null ? null : Math.max(0, latestKg - limitKg);
    return (
        <dl className="grid grid-cols-3 gap-3">
            <Figure
                label={t("weight.latest")}
                value={latestKg === null ? "—" : `${formatNumber(latestKg, 1)} kg`}
                caption={latestOn ? formatShortDate(`${latestOn}T12:00:00+07:00`, locale) : t("weight.noneYet")}
            />
            <Figure label={t("weight.limit")} value={`${formatNumber(limitKg, 1)} kg`} caption={catchweight ? t("weight.catchweight") : undefined} />
            <Figure
                label={t("weight.toCut")}
                value={remainingPct === null ? "—" : `${formatNumber(remainingPct, 1)}%`}
                caption={overKg === null ? undefined : `${formatNumber(overKg, 1)} kg`}
            />
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

const NOTES: Record<"coach" | "fighter", Partial<Record<WeightWarningStatus, { title: MessageKey; text?: MessageKey }>>> = {
    coach: {
        OVER_LIMIT: { title: "weightNote.coach.OVER_LIMIT.title", text: "weightNote.coach.OVER_LIMIT.text" },
        ABOVE_TARGET: { title: "weightNote.coach.ABOVE_TARGET.title", text: "weightNote.coach.ABOVE_TARGET.text" },
        NOT_WEIGHED: { title: "weightNote.coach.NOT_WEIGHED.title", text: "weightNote.coach.NOT_WEIGHED.text" },
    },
    fighter: {
        OVER_LIMIT: { title: "weightNote.fighter.OVER_LIMIT.title", text: "weightNote.fighter.OVER_LIMIT.text" },
        ABOVE_TARGET: { title: "weightNote.fighter.ABOVE_TARGET.title" },
        NOT_WEIGHED: { title: "weightNote.fighter.NOT_WEIGHED.title", text: "weightNote.fighter.NOT_WEIGHED.text" },
    },
};

/** One short note for a status that needs action; nothing when the cut is on track. */
export function WeightStatusNote({ status, audience, t }: { status: WeightWarningStatus; audience: "coach" | "fighter"; t: Translator }) {
    const note = NOTES[audience][status];
    if (!note) return null;
    const tone = status === "OVER_LIMIT" ? "danger" : status === "ABOVE_TARGET" ? "warning" : "neutral";
    return (
        <Callout tone={tone} icon={status === "NOT_WEIGHED" ? Clock : TriangleAlert} title={t(note.title)}>
            {note.text && t(note.text)}
        </Callout>
    );
}
