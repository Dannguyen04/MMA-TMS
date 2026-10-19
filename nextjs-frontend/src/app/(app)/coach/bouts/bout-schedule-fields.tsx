"use client";

import { Info, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
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
    if (ruleset && ruleset.weightClasses.length === 0) {
        const limit = form.control("weightLimitKg", { required: true, hint: true });
        return (
            <Field label="Weight limit" htmlFor={limit.id} required error={form.error("weightLimitKg")} hint="This event's own limit in kilograms, such as 63.5.">
                <Input {...limit} key={`${ruleset.id}-limit`} inputMode="decimal" autoComplete="off" placeholder="63.5" suffix="kg" defaultValue={defaults.weightLimitKg} />
            </Field>
        );
    }
    const code = form.control("weightClassCode", { required: true });
    return (
        <Field label="Weight class" htmlFor={code.id} required error={form.error("weightClassCode")}>
            <Select {...code} key={ruleset?.id ?? "none"} defaultValue={defaults.weightClassCode} disabled={!ruleset}>
                <option value="">{ruleset ? "Choose a class" : "Choose a ruleset first"}</option>
                {ruleset?.weightClasses.map((option) => (
                    <option key={option.code} value={option.code}>
                        {option.label}
                    </option>
                ))}
            </Select>
        </Field>
    );
}

/** What a coach must know about the ruleset they picked: unverified presets are only a reference. */
export function RulesetNote({ ruleset }: { ruleset: CompetitionRuleset | null }) {
    if (!ruleset) return null;
    if (ruleset.weightClasses.length === 0) {
        return (
            <InlineNote icon={Info}>
                Enter this event&apos;s own rules. Anything typed here is coach-entered and not verified.
            </InlineNote>
        );
    }
    if (!ruleset.verified) {
        return (
            <InlineNote icon={ShieldAlert} tone="warning">
                Reference only, not verified with the organiser.
            </InlineNote>
        );
    }
    return null;
}

/** Event name, venue and opponent. */
export function EventFields<T>({ form, defaults }: { form: ActionForm<T>; defaults: Pick<ScheduleDefaults, "event" | "venue" | "opponent"> }) {
    const event = form.control("event", { required: true });
    const venue = form.control("venue");
    const opponent = form.control("opponent", { hint: true });
    return (
        <>
            <Field label="Event" htmlFor={event.id} required error={form.error("event")}>
                <Input {...event} maxLength={120} autoComplete="off" placeholder="Lotus Fight Night 18" defaultValue={defaults.event} />
            </Field>
            <Field label="Venue" htmlFor={venue.id} optional error={form.error("venue")}>
                <Input {...venue} maxLength={120} autoComplete="off" defaultValue={defaults.venue} />
            </Field>
            <Field label="Opponent" htmlFor={opponent.id} optional error={form.error("opponent")} hint="Leave empty while the organiser hasn't named one; the bout shows “Opponent TBA”.">
                <Input {...opponent} maxLength={80} autoComplete="off" defaultValue={defaults.opponent} />
            </Field>
        </>
    );
}

/** Weigh-in and bout times on the academy clock, with the preview F1 asks for underneath. */
export function ScheduleFields<T>({ form, ruleset, defaults, todayOn }: { form: ActionForm<T>; ruleset: CompetitionRuleset | null; defaults: Pick<ScheduleDefaults, "weighInAt" | "boutAt">; todayOn: string }) {
    const [weighInAt, setWeighInAt] = useState(defaults.weighInAt);
    const [boutAt, setBoutAt] = useState(defaults.boutAt);
    const weighIn = form.control("weighInAt", { required: true, hint: true });
    const bout = form.control("boutAt", { required: true });
    const valid = ruleset && isDateTimeInputValue(weighInAt) && isDateTimeInputValue(boutAt) ? scheduleSummary(wallClockIso(weighInAt), wallClockIso(boutAt), ruleset, todayOn) : null;

    return (
        <>
            <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Weigh-in" htmlFor={weighIn.id} required error={form.error("weighInAt")} hint="Academy time (Ho Chi Minh City).">
                    <Input {...weighIn} type="datetime-local" value={weighInAt} onChange={(event) => setWeighInAt(event.target.value)} />
                </Field>
                <Field label="Bout" htmlFor={bout.id} required error={form.error("boutAt")}>
                    <Input {...bout} type="datetime-local" value={boutAt} onChange={(event) => setBoutAt(event.target.value)} />
                </Field>
            </div>
            <div aria-live="polite" className="rounded-lg bg-surface-muted px-4 py-3 text-sm">
                {valid && valid.gapHours > 0 ? (
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
                        <div>
                            <dt className="text-[13px] text-fg-muted">Countdown</dt>
                            <dd className="font-medium text-fg">{weighInCountdown(valid.daysToWeighIn)}</dd>
                        </div>
                        <div>
                            <dt className="text-[13px] text-fg-muted">Weigh-in to bout</dt>
                            <dd className="font-medium text-fg">{formatNumber(valid.gapHours, Number.isInteger(valid.gapHours) ? 0 : 1)} hours</dd>
                        </div>
                        <div>
                            <dt className="text-[13px] text-fg-muted">Acute-loss limit</dt>
                            <dd className="font-medium text-fg">
                                {formatNumber(valid.acuteLossLimitPct)}% {valid.gapHours >= 12 ? "(12 hours or more)" : "(under 12 hours)"}
                            </dd>
                        </div>
                    </dl>
                ) : (
                    <p className="text-fg-muted">
                        {valid ? "The bout must start after the weigh-in." : "Pick a ruleset and both times to see days to weigh-in, the gap and the acute-loss limit."}
                    </p>
                )}
            </div>
        </>
    );
}
