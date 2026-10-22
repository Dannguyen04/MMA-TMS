"use client";

import { Info, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useT } from "@/components/i18n/locale-provider";
import { Field, Input, Select } from "@/components/ui/form";
import type { ActionForm } from "@/components/ui/use-action-form";
import type { CompetitionRuleset } from "@/lib/domain/bout";
import { scheduleSummary, wallClockIso } from "@/lib/domain/bout-rules";
import { weighInCountdown } from "@/lib/domain/nutrition";
import { formatNumber, isDateTimeInputValue } from "@/lib/format";

export interface ScheduleDefaults {
    event: string;
    venue: string;
    opponent: string;
    weightClassCode: string;
    weightLimitKg: string;
    weighInAt: string;
    boutAt: string;
}

/** The class a bout is fought at: a preset's list, or the coach's own limit when the ruleset has none. */
export function WeightClassField<T>({ form, ruleset, defaults }: { form: ActionForm<T>; ruleset: CompetitionRuleset | null; defaults: Pick<ScheduleDefaults, "weightClassCode" | "weightLimitKg"> }) {
    const t = useT();
    if (ruleset && ruleset.weightClasses.length === 0) {
        const limit = form.control("weightLimitKg", { required: true, hint: true });
        return (
            <Field label={t("coachBouts.fields.weightLimit")} htmlFor={limit.id} required error={form.error("weightLimitKg")} hint={t("coachBouts.fields.weightLimitHint")}>
                <Input {...limit} key={`${ruleset.id}-limit`} inputMode="decimal" autoComplete="off" placeholder="63.5" suffix="kg" defaultValue={defaults.weightLimitKg} />
            </Field>
        );
    }
    const code = form.control("weightClassCode", { required: true });
    const options = [{ code: "", label: ruleset ? t("coachBouts.fields.chooseClass") : t("coachBouts.fields.chooseRulesetFirst") }, ...(ruleset?.weightClasses ?? [])];
    return (
        <Field label={t("coachBouts.fields.weightClass")} htmlFor={code.id} required error={form.error("weightClassCode")}>
            <Select {...code} key={ruleset?.id ?? "none"} defaultValue={defaults.weightClassCode} disabled={!ruleset}>
                {options.map((option) => (
                    <option key={option.code || "none"} value={option.code}>
                        {option.label}
                    </option>
                ))}
            </Select>
        </Field>
    );
}

/** What a coach must know about the ruleset they picked: unverified presets are only a reference. */
export function RulesetNote({ ruleset }: { ruleset: CompetitionRuleset | null }) {
    const t = useT();
    if (!ruleset) return null;
    if (ruleset.weightClasses.length === 0) {
        return <InlineNote icon={Info}>{t("coachBouts.fields.customRulesNote")}</InlineNote>;
    }
    if (!ruleset.verified) {
        return (
            <InlineNote icon={ShieldAlert} tone="warning">
                {t("coachBouts.fields.unverifiedNote")}
            </InlineNote>
        );
    }
    return null;
}

/** Event name, venue and opponent. */
export function EventFields<T>({ form, defaults }: { form: ActionForm<T>; defaults: Pick<ScheduleDefaults, "event" | "venue" | "opponent"> }) {
    const t = useT();
    const event = form.control("event", { required: true });
    const venue = form.control("venue");
    const opponent = form.control("opponent", { hint: true });
    return (
        <>
            <Field label={t("coachBouts.fields.event")} htmlFor={event.id} required error={form.error("event")}>
                <Input {...event} maxLength={120} autoComplete="off" defaultValue={defaults.event} />
            </Field>
            <Field label={t("coachBouts.fields.venue")} htmlFor={venue.id} optional error={form.error("venue")}>
                <Input {...venue} maxLength={120} autoComplete="off" defaultValue={defaults.venue} />
            </Field>
            <Field label={t("coachBouts.fields.opponent")} htmlFor={opponent.id} optional error={form.error("opponent")} hint={t("coachBouts.fields.opponentHint")}>
                <Input {...opponent} maxLength={80} autoComplete="off" defaultValue={defaults.opponent} />
            </Field>
        </>
    );
}

/** Weigh-in and bout times on the academy clock, with the preview F1 asks for underneath. */
export function ScheduleFields<T>({ form, ruleset, defaults, todayOn }: { form: ActionForm<T>; ruleset: CompetitionRuleset | null; defaults: Pick<ScheduleDefaults, "weighInAt" | "boutAt">; todayOn: string }) {
    const t = useT();
    const [weighInAt, setWeighInAt] = useState(defaults.weighInAt);
    const [boutAt, setBoutAt] = useState(defaults.boutAt);
    const weighIn = form.control("weighInAt", { required: true, hint: true });
    const bout = form.control("boutAt", { required: true });
    const valid = ruleset && isDateTimeInputValue(weighInAt) && isDateTimeInputValue(boutAt) ? scheduleSummary(wallClockIso(weighInAt), wallClockIso(boutAt), ruleset, todayOn) : null;

    return (
        <>
            <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label={t("coachBouts.fields.weighIn")} htmlFor={weighIn.id} required error={form.error("weighInAt")} hint={t("coachBouts.fields.weighInHint")}>
                    <Input {...weighIn} type="datetime-local" value={weighInAt} onChange={(event) => setWeighInAt(event.target.value)} />
                </Field>
                <Field label={t("coachBouts.fields.bout")} htmlFor={bout.id} required error={form.error("boutAt")}>
                    <Input {...bout} type="datetime-local" value={boutAt} onChange={(event) => setBoutAt(event.target.value)} />
                </Field>
            </div>
            <div aria-live="polite" className="rounded-lg bg-surface-muted px-4 py-3 text-sm">
                {valid && valid.gapHours > 0 ? (
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
                        <div>
                            <dt className="text-[13px] text-fg-muted">{t("coachBouts.fields.countdown")}</dt>
                            <dd className="font-medium text-fg">{weighInCountdown(valid.daysToWeighIn, t)}</dd>
                        </div>
                        <div>
                            <dt className="text-[13px] text-fg-muted">{t("coachBouts.fields.gap")}</dt>
                            <dd className="font-medium text-fg">{t("coachBouts.fields.gapHours", { n: formatNumber(valid.gapHours, Number.isInteger(valid.gapHours) ? 0 : 1) })}</dd>
                        </div>
                        <div>
                            <dt className="text-[13px] text-fg-muted">{t("coachBouts.fields.acuteLossLimit")}</dt>
                            <dd className="font-medium text-fg">
                                {t(valid.gapHours >= 12 ? "coachBouts.fields.acuteLossLong" : "coachBouts.fields.acuteLossShort", { pct: formatNumber(valid.acuteLossLimitPct) })}
                            </dd>
                        </div>
                    </dl>
                ) : (
                    <p className="text-fg-muted">{valid ? t("coachBouts.fields.boutAfterWeighIn") : t("coachBouts.fields.previewEmpty")}</p>
                )}
            </div>
        </>
    );
}
