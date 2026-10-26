"use client";

import { useEffect, useRef, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FormFooter, FormSection, Select } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { createBoutAction, previewFeasibilityAction } from "@/lib/actions/bouts";
import { actionError } from "@/lib/actions/state";
import type { CompetitionRuleset } from "@/lib/domain/bout";
import { validateBoutSchedule } from "@/lib/domain/bout-rules";
import { Scale, TriangleAlert } from "lucide-react";
import { Callout } from "@/components/training/callout";
import type { WeightFeasibility } from "@/lib/domain/types";
import { academyWallClockToIso, formatNumber } from "@/lib/format";
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
    const t = useT();
    const [rulesetId, setRulesetId] = useState(defaults.rulesetId);
    const ruleset = rulesets.find((item) => item.id === rulesetId) ?? null;
    const form = useActionForm(createBoutAction, {
        prepare(fd) {
            const field = (name: string) => String(fd.get(name) ?? "");
            const fieldErrors: Record<string, string> = {};
            if (!field("fighterId")) fieldErrors.fighterId = t("coachBouts.form.chooseFighterError");
            if (!ruleset) fieldErrors.rulesetId = t("coachBouts.form.chooseRulesetError");
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
                {},
                t,
            );
            if (!schedule.ok) Object.assign(fieldErrors, schedule.fieldErrors);
            if (!ruleset) delete fieldErrors.weightLimitKg;
            return Object.keys(fieldErrors).length > 0 ? actionError(t("form.fixFields"), fieldErrors) : undefined;
        },
    });
    const formRef = useRef<HTMLFormElement>(null);
    const [preview, setPreview] = useState<{ key: string; value: WeightFeasibility | null } | null>(null);
    const [previewKey, setPreviewKey] = useState<string | null>(null);
    useEffect(() => {
        const element = formRef.current;
        if (!element) return;
        const read = () => {
            const fd = new FormData(element);
            const field = (key: string) => String(fd.get(key) ?? "");
            const weightClassCode = field("weightClassCode");
            const limit = ruleset?.weightClasses.find(c => c.code === weightClassCode)?.limitKg ?? Number(field("weightLimitKg").replace(",", "."));
            const iso = (value: string) => { const [date, time] = value.split("T"); return date && time ? academyWallClockToIso(date, time) : ""; };
            setPreviewKey(JSON.stringify({ fighterId: field("fighterId"), rulesetId, weightClassCode: weightClassCode || "CUSTOM", weightLimitKg: limit, weighInAt: iso(field("weighInAt")), boutAt: iso(field("boutAt")) }));
        };
        read();
        element.addEventListener("input", read);
        element.addEventListener("change", read);
        return () => { element.removeEventListener("input", read); element.removeEventListener("change", read); };
    }, [ruleset, rulesetId]);
    useEffect(() => {
        if (!previewKey) return;
        let stale = false;
        const timer = setTimeout(() => {
            previewFeasibilityAction(JSON.parse(previewKey)).then(value => { if (!stale) setPreview({ key: previewKey, value }); }, () => { if (!stale) setPreview({ key: previewKey, value: null }); });
        }, 400);
        return () => { stale = true; clearTimeout(timer); };
    }, [previewKey]);
    const feasibility = preview?.key === previewKey ? preview?.value : null;
    const fighter = form.control("fighterId", { required: true });
    const rulesetControl = form.control("rulesetId", { required: true });

    return (
        <form {...form.formProps} ref={formRef} className="max-w-4xl">
            <Card>
                <CardContent className="pt-6">
                    <FormSection title={t("coachBouts.form.fighterAndRules")} description={t("coachBouts.form.fighterAndRulesHint")}>
                        <Field label={t("coachBouts.form.fighter")} htmlFor={fighter.id} required error={form.error("fighterId")}>
                            <Select {...fighter} defaultValue={defaults.fighterId}>
                                <option value="">{t("coachBouts.form.chooseFighter")}</option>
                                {fighters.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label={t("coachBouts.form.ruleset")} htmlFor={rulesetControl.id} required error={form.error("rulesetId")}>
                            <Select {...rulesetControl} value={rulesetId} onChange={(event) => setRulesetId(event.target.value)}>
                                <option value="">{t("coachBouts.form.chooseRuleset")}</option>
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

                    <FormSection title={t("coachBouts.form.event")}>
                        <EventFields form={form} defaults={defaults} />
                    </FormSection>

                    <FormSection title={t("coachBouts.form.schedule")} description={t("coachBouts.form.scheduleHint")}>
                        <ScheduleFields form={form} ruleset={ruleset} defaults={defaults} todayOn={todayOn} />
                        {feasibility && <FeasibilityNote feasibility={feasibility} t={t} />}
                    </FormSection>

                    <FormFooter
                        message={form.message}
                        cancelHref={routes.coach.bouts}
                        pending={form.pending}
                        submitLabel={t("coachBouts.form.submit")}
                        pendingLabel={t("coachBouts.form.pending")}
                        cancelLabel={t("common.cancel")}
                    />
                </CardContent>
            </Card>
        </form>
    );
}

const FEASIBILITY_TEXT = {
    OVER_LIMIT: "feasibility.OVER_LIMIT",
    ON_TRACK: "feasibility.ON_TRACK",
    NEUTRAL: "feasibility.NEUTRAL",
    NOT_WEIGHED: "feasibility.NOT_WEIGHED",
    ABOVE_TARGET: "feasibility.ON_TRACK",
} as const;

function FeasibilityNote({ feasibility, t }: { feasibility: WeightFeasibility; t: ReturnType<typeof useT> }) {
    const tone = feasibility.status === "OVER_LIMIT" ? "danger" : feasibility.status === "ON_TRACK" ? "success" : "neutral";
    return (
        <Callout tone={tone} icon={feasibility.status === "OVER_LIMIT" ? TriangleAlert : Scale} title={t("feasibility.title")} role="status">
            {t(FEASIBILITY_TEXT[feasibility.status], {
                kg: feasibility.latestKg != null ? formatNumber(feasibility.latestKg, 1) : "",
                remaining: feasibility.remainingPct != null ? formatNumber(feasibility.remainingPct, 1) : "",
                limit: formatNumber(feasibility.acuteLossLimitPct, 1),
                limitKg: formatNumber(feasibility.limitKg, 1),
                window: 7,
            })}
        </Callout>
    );
}
