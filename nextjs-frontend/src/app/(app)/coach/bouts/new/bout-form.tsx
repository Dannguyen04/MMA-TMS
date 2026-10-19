"use client";

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Field, FormFooter, FormSection, Select } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { createBoutAction } from "@/lib/actions/bouts";
import { actionError, FIX_FIELDS } from "@/lib/actions/state";
import type { CompetitionRuleset } from "@/lib/domain/bout";
import { validateBoutSchedule } from "@/lib/domain/bout-rules";
import { routes } from "@/lib/routes";
import { EventFields, RulesetNote, ScheduleFields, WeightClassField, type ScheduleDefaults } from "../bout-schedule-fields";

export interface BoutFormProps {
    fighters: { id: string; name: string }[];
    rulesets: CompetitionRuleset[];
    defaults: ScheduleDefaults & { fighterId: string; rulesetId: string };
    todayOn: string;
}

/**
 * F1: fighter, ruleset and class, the event, and both times. The same checks as the server run first in the
 * browser, so a bout that starts before its weigh-in is stopped at the field without a round trip.
 */
export function BoutForm({ fighters, rulesets, defaults, todayOn }: BoutFormProps) {
    const [rulesetId, setRulesetId] = useState(defaults.rulesetId);
    const ruleset = rulesets.find((item) => item.id === rulesetId) ?? null;
    const form = useActionForm(createBoutAction, {
        prepare(fd) {
            const field = (name: string) => String(fd.get(name) ?? "");
            const fieldErrors: Record<string, string> = {};
            if (!field("fighterId")) fieldErrors.fighterId = "Choose a fighter.";
            if (!ruleset) fieldErrors.rulesetId = "Choose a ruleset.";
            const schedule = validateBoutSchedule(
                {
                    event: field("event"),
                    venue: field("venue"),
                    opponent: field("opponent"),
                    weightClassCode: field("weightClassCode"),
                    weightLimitKg: field("weightLimitKg"),
                    weighInAt: field("weighInAt"),
                    boutAt: field("boutAt"),
                },
                ruleset ?? { weightClasses: [] },
                new Date(),
            );
            if (!schedule.ok) Object.assign(fieldErrors, schedule.fieldErrors);
            if (!ruleset) delete fieldErrors.weightLimitKg;
            return Object.keys(fieldErrors).length > 0 ? actionError(FIX_FIELDS, fieldErrors) : undefined;
        },
    });
    const fighter = form.control("fighterId", { required: true });
    const rulesetControl = form.control("rulesetId", { required: true });

    return (
        <form {...form.formProps} className="max-w-4xl">
            <Card>
                <CardContent className="pt-6">
                    <FormSection title="Fighter and rules" description="The ruleset sets the weight classes, the documents deadline and the acute-loss limits.">
                        <Field label="Fighter" htmlFor={fighter.id} required error={form.error("fighterId")}>
                            <Select {...fighter} defaultValue={defaults.fighterId}>
                                <option value="">Choose a fighter</option>
                                {fighters.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Ruleset" htmlFor={rulesetControl.id} required error={form.error("rulesetId")}>
                            <Select {...rulesetControl} value={rulesetId} onChange={(event) => setRulesetId(event.target.value)}>
                                <option value="">Choose a ruleset</option>
                                {rulesets.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <RulesetNote ruleset={ruleset} />
                        <WeightClassField form={form} ruleset={ruleset} defaults={defaults} />
                    </FormSection>

                    <FormSection title="Event">
                        <EventFields form={form} defaults={defaults} />
                    </FormSection>

                    <FormSection title="Schedule" description="Weigh-in must come before the bout. The bout must be in the future.">
                        <ScheduleFields form={form} ruleset={ruleset} defaults={defaults} todayOn={todayOn} />
                    </FormSection>

                    <FormFooter message={form.message} cancelHref={routes.coach.bouts} pending={form.pending} submitLabel="Create bout" pendingLabel="Creating bout" />
                </CardContent>
            </Card>
        </form>
    );
}
