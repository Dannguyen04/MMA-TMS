"use client";

import { Ban, CalendarPlus, Flag, Link2, Pencil, Scale, ShieldAlert, Trophy } from "lucide-react";
import { useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Callout } from "@/components/training/callout";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import {
    cancelBoutAction,
    enterFightWeekAction,
    linkCampAction,
    recordResultAction,
    recordWeighInAction,
    updateBoutAction,
} from "@/lib/actions/bouts";
import { CANCEL_REASONS, type CampBout, type CompetitionRuleset } from "@/lib/domain/bout";
import { asksHeadStrikes, asksLossOfConsciousness, BOUT_RESULTS, HYDRATION_CHECKS, LOSS_OF_CONSCIOUSNESS, madeWeight, methodsFor } from "@/lib/domain/bout-rules";
import { formatNumber, toDateTimeInputValue } from "@/lib/format";
import { routes } from "@/lib/routes";
import { EventFields, RulesetNote, ScheduleFields, WeightClassField } from "../bout-schedule-fields";
import { useNotify } from "../use-notify";


/* ─── Header: edit and cancel ─────────────────────────────────────────────── */

/** F8: event details, dates, class and the documents deadline. A class change needs a reason. */
export function EditBoutButton({ bout, ruleset, todayOn }: { bout: CampBout; ruleset: CompetitionRuleset | null; todayOn: string }) {
    const [open, setOpen] = useState(false);
    const notify = useNotify();
    const t = useT();
    const defaults = {
        event: bout.event,
        venue: bout.venue ?? "",
        opponent: bout.opponent ?? "",
        weightClassCode: bout.weightClassCode,
        weightLimitKg: bout.limitKg === null ? "" : String(bout.limitKg),
        weighInAt: toDateTimeInputValue(bout.weighInAt),
        boutAt: toDateTimeInputValue(bout.boutAt),
    };
    return (
        <>
            <Button variant="secondary" onClick={() => setOpen(true)}>
                <Pencil aria-hidden />
                {t("boutDetail.common.edit")}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title={t("boutDetail.edit.title")}
                description={t("boutDetail.edit.description")}
                size="lg"
                action={updateBoutAction}
                submitLabel={t("boutDetail.edit.submit")}
                pendingLabel={t("boutDetail.common.saving")}
                onSuccess={notify}
            >
                {(form) => {
                    const due = form.control("requirementsDueDays", { required: true, hint: true });
                    const reason = form.control("changeReason", { hint: true });
                    const notes = form.control("notes");
                    return (
                        <>
                            <input type="hidden" name="boutId" value={bout.id} />
                            <EventFields form={form} defaults={defaults} />
                            <RulesetNote ruleset={ruleset} />
                            <WeightClassField form={form} ruleset={ruleset} defaults={defaults} />
                            <Field label={t("boutDetail.edit.changeReason")} htmlFor={reason.id} optional error={form.error("changeReason")} hint={t("boutDetail.edit.changeReasonHint")}>
                                <Input {...reason} maxLength={300} />
                            </Field>
                            <ScheduleFields form={form} ruleset={ruleset} defaults={defaults} todayOn={todayOn} />
                            <Field label={t("boutDetail.edit.dueDays")} htmlFor={due.id} required error={form.error("requirementsDueDays")} hint={t("boutDetail.edit.dueDaysHint")}>
                                <Input {...due} inputMode="numeric" defaultValue={String(bout.requirementsDueDays)} className="w-28" />
                            </Field>
                            <Field label={t("boutDetail.common.notes")} htmlFor={notes.id} optional error={form.error("notes")}>
                                <Textarea {...notes} rows={3} maxLength={500} defaultValue={bout.notes ?? ""} />
                            </Field>
                        </>
                    );
                }}
            </ActionDialog>
        </>
    );
}

/** Cancelling is final; the camp plan stays and no suspension is created (H4). */
export function CancelBoutButton({ bout }: { bout: CampBout }) {
    const [open, setOpen] = useState(false);
    const notify = useNotify();
    const t = useT();
    return (
        <>
            <Button variant="danger-soft" onClick={() => setOpen(true)}>
                <Ban aria-hidden />
                {t("boutDetail.cancel.button")}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title={t("boutDetail.cancel.title")}
                description={t("boutDetail.cancel.description")}
                action={cancelBoutAction}
                submitLabel={t("boutDetail.cancel.button")}
                pendingLabel={t("boutDetail.cancel.pending")}
                submitVariant="danger"
                onSuccess={notify}
            >
                {(form) => {
                    const reason = form.control("reason", { required: true });
                    const note = form.control("note", { hint: true });
                    return (
                        <>
                            <input type="hidden" name="boutId" value={bout.id} />
                            <Field label={t("boutDetail.common.reason")} htmlFor={reason.id} required error={form.error("reason")}>
                                <Select {...reason} defaultValue="">
                                    <option value="">{t("boutDetail.cancel.chooseReason")}</option>
                                    {CANCEL_REASONS.map((value) => (
                                        <option key={value} value={value}>
                                            {t(`boutLabel.cancelReason.${value}`)}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label={t("boutDetail.common.note")} htmlFor={note.id} error={form.error("note")} hint={t("boutDetail.cancel.noteHint")}>
                                <Textarea {...note} rows={3} maxLength={300} />
                            </Field>
                        </>
                    );
                }}
            </ActionDialog>
        </>
    );
}

/* ─── Scheduled: link the camp ────────────────────────────────────────────── */

export interface CampPlanOption {
    id: string;
    title: string;
    period: string;
}

/** F2: link one of the fighter's fight-camp plans; the bout moves to camp. */
export function LinkCampButton({ bout, plans, fighterName }: { bout: CampBout; plans: CampPlanOption[]; fighterName: string }) {
    const [open, setOpen] = useState(false);
    const notify = useNotify();
    const t = useT();
    if (plans.length === 0) {
        return (
            <div className="flex flex-col gap-3">
                <p className="text-sm text-fg-muted">{t("boutDetail.link.noPlans", { name: fighterName })}</p>
                <ButtonLink href={`${routes.coach.newPlan}?fighter=${encodeURIComponent(bout.fighterId)}`} className="self-start">
                    <CalendarPlus aria-hidden />
                    {t("boutDetail.link.createPlan")}
                </ButtonLink>
            </div>
        );
    }
    return (
        <>
            <Button onClick={() => setOpen(true)} className="self-start">
                <Link2 aria-hidden />
                {t("boutDetail.link.button")}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title={t("boutDetail.link.title")}
                description={t("boutDetail.link.description")}
                action={linkCampAction}
                submitLabel={t("boutDetail.link.submit")}
                pendingLabel={t("boutDetail.link.pending")}
                onSuccess={notify}
            >
                {(form) => {
                    const plan = form.control("trainingPlanId", { required: true });
                    return (
                        <>
                            <input type="hidden" name="boutId" value={bout.id} />
                            <Field label={t("boutDetail.link.plan")} htmlFor={plan.id} required error={form.error("trainingPlanId")}>
                                <Select {...plan} defaultValue={plans.length === 1 ? plans[0].id : ""}>
                                    {plans.length > 1 && <option value="">{t("boutDetail.link.choosePlan")}</option>}
                                    {plans.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.title} ({option.period})
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        </>
                    );
                }}
            </ActionDialog>
        </>
    );
}

/* ─── Camp: Gate 1 ────────────────────────────────────────────────────────── */

/** CAMP → FIGHT_WEEK. When Gate 1 refuses, the bout stays in camp and the reasons are listed here. */
export function EnterFightWeekForm({ boutId }: { boutId: string }) {
    const form = useActionForm(enterFightWeekAction);
    const t = useT();
    const blocked = form.state.status === "error" ? form.state : null;
    return (
        <form {...form.formProps} className="flex flex-col gap-3">
            <input type="hidden" name="boutId" value={boutId} />
            {blocked && (
                <Callout tone="warning" icon={ShieldAlert} role="alert" title={blocked.message ?? t("boutDetail.fightWeek.blocked")}>
                    {blocked.data?.lines.length ? (
                        <ul className="mt-1 list-disc pl-5">
                            {blocked.data.lines.map((line) => (
                                <li key={line}>{line}</li>
                            ))}
                        </ul>
                    ) : null}
                </Callout>
            )}
            <SubmitButton pending={form.pending} pendingLabel={t("boutDetail.fightWeek.pending")} className="self-start">
                <Flag aria-hidden />
                {t("boutDetail.fightWeek.submit")}
            </SubmitButton>
        </form>
    );
}

/* ─── Fight week: official weigh-in (F5) ──────────────────────────────────── */

export function WeighInButton({ bout }: { bout: CampBout }) {
    const [open, setOpen] = useState(false);
    const [weight, setWeight] = useState("");
    const [hydration, setHydration] = useState<string>("");
    const [decision, setDecision] = useState<"" | "CATCHWEIGHT" | "CANCEL">("");
    const notify = useNotify();
    const t = useT();
    const limit = bout.catchweightKg ?? bout.limitKg;
    const kg = Number(weight.trim().replace(",", "."));
    const missed = weight.trim() !== "" && Number.isFinite(kg) && !madeWeight(kg, limit);

    return (
        <>
            <Button onClick={() => setOpen(true)} className="self-start">
                <Scale aria-hidden />
                {t("boutDetail.weighIn.button")}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => {
                    setOpen(false);
                    setWeight("");
                    setDecision("");
                    setHydration("");
                }}
                title={t("boutDetail.weighIn.title")}
                description={limit === null ? t("boutDetail.weighIn.openClass") : t("boutDetail.weighIn.limit", { kg: formatNumber(limit, 1) })}
                action={recordWeighInAction}
                submitLabel={missed && decision === "CANCEL" ? t("boutDetail.cancel.button") : t("boutDetail.weighIn.submit")}
                submitVariant={missed && decision === "CANCEL" ? "danger" : "primary"}
                pendingLabel={t("boutDetail.common.saving")}
                onSuccess={notify}
            >
                {(form) => {
                    const weightControl = form.control("weightKg", { required: true });
                    const hydrationControl = form.control("hydrationCheck", { hint: true });
                    const catchweight = form.control("catchweightKg", { required: true });
                    const note = form.control("note");
                    return (
                        <>
                            <input type="hidden" name="boutId" value={bout.id} />
                            <Field label={t("boutDetail.common.officialWeight")} htmlFor={weightControl.id} required error={form.error("weightKg")}>
                                <Input {...weightControl} inputMode="decimal" autoComplete="off" suffix="kg" value={weight} onChange={(event) => setWeight(event.target.value)} />
                            </Field>
                            {weight.trim() !== "" && Number.isFinite(kg) && limit !== null && (
                                <p role="status" className={missed ? "text-sm font-medium text-danger-fg" : "text-sm font-medium text-success-fg"}>
                                    {missed ? t("boutDetail.weighIn.over", { kg: formatNumber(kg - limit, 1) }) : t("boutDetail.weighIn.made")}
                                </p>
                            )}
                            <Field label={t("boutDetail.common.hydrationCheck")} htmlFor={hydrationControl.id} optional error={form.error("hydrationCheck")} hint={t("boutDetail.weighIn.hydrationHint")}>
                                <Select {...hydrationControl} value={hydration} onChange={(event) => setHydration(event.target.value)}>
                                    <option value="">{t("boutDetail.weighIn.notRecorded")}</option>
                                    {HYDRATION_CHECKS.map((value) => (
                                        <option key={value} value={value}>
                                            {t(`boutLabel.hydration.${value}`)}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            {missed && (
                                <>
                                    <ChoiceGroup
                                        id={`${form.formProps.id}-decision`}
                                        name="decision"
                                        legend={t("boutDetail.weighIn.decision")}
                                        required
                                        options={[
                                            { value: "CATCHWEIGHT", label: t("boutDetail.weighIn.goOn"), description: t("boutDetail.weighIn.goOnDescription") },
                                            {
                                                value: "CANCEL",
                                                label: t("boutDetail.weighIn.cancel"),
                                                description: t("boutDetail.weighIn.cancelDescription", { reason: t("boutLabel.cancelReason.MISSED_WEIGHT") }),
                                            },
                                        ]}
                                        value={decision}
                                        onChange={setDecision}
                                        error={form.error("decision")}
                                    />
                                    {decision === "CATCHWEIGHT" && (
                                        <Field label={t("boutDetail.common.catchweight")} htmlFor={catchweight.id} required error={form.error("catchweightKg")}>
                                            <Input {...catchweight} inputMode="decimal" autoComplete="off" suffix="kg" />
                                        </Field>
                                    )}
                                    <Field label={t("boutDetail.common.note")} htmlFor={note.id} required={decision === "CATCHWEIGHT"} optional={decision !== "CATCHWEIGHT"} error={form.error("note")}>
                                        <Textarea {...note} rows={2} maxLength={300} placeholder={decision === "CATCHWEIGHT" ? t("boutDetail.weighIn.notePlaceholder") : undefined} />
                                    </Field>
                                </>
                            )}
                        </>
                    );
                }}
            </ActionDialog>
        </>
    );
}

/* ─── Weighed in: result (F6) ─────────────────────────────────────────────── */

export function ResultButton({ bout }: { bout: CampBout }) {
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState("");
    const [method, setMethod] = useState("");
    const notify = useNotify();
    const t = useT();
    const methods = methodsFor(bout.sport);

    return (
        <>
            <Button onClick={() => setOpen(true)} className="self-start">
                <Trophy aria-hidden />
                {t("boutDetail.result.button")}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => {
                    setOpen(false);
                    setResult("");
                    setMethod("");
                }}
                title={t("boutDetail.result.title")}
                description={t("boutDetail.result.description")}
                size="lg"
                action={recordResultAction}
                submitLabel={t("boutDetail.result.submit")}
                pendingLabel={t("boutDetail.common.saving")}
                onSuccess={notify}
            >
                {(form) => {
                    const resultControl = form.control("result", { required: true });
                    const methodControl = form.control("method", { required: true });
                    const round = form.control("round", { hint: true });
                    const loc = form.control("lossOfConsciousness", { required: true });
                    const head = form.control("stoppedByHeadStrikes", { required: true });
                    const knockedDown = form.control("knockedDown");
                    const injury = form.control("injuryNote", { hint: true });
                    const notes = form.control("notes");
                    return (
                        <>
                            <input type="hidden" name="boutId" value={bout.id} />
                            <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                                <Field label={t("boutDetail.common.result")} htmlFor={resultControl.id} required error={form.error("result")}>
                                    <Select {...resultControl} value={result} onChange={(event) => setResult(event.target.value)}>
                                        <option value="">{t("boutDetail.common.choose")}</option>
                                        {BOUT_RESULTS.map((value) => (
                                            <option key={value} value={value}>
                                                {t(`boutLabel.result.${value}`)}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                                <Field label={t("boutDetail.result.method")} htmlFor={methodControl.id} required error={form.error("method")}>
                                    <Select {...methodControl} value={method} onChange={(event) => setMethod(event.target.value)}>
                                        <option value="">{t("boutDetail.common.choose")}</option>
                                        {methods.map((value) => (
                                            <option key={value} value={value}>
                                                {t(`boutLabel.method.${value}`)}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            </div>
                            <Field label={t("boutDetail.result.round")} htmlFor={round.id} optional error={form.error("round")} hint={t("boutDetail.result.roundHint")}>
                                <Input {...round} inputMode="numeric" className="w-28" />
                            </Field>
                            {asksLossOfConsciousness(result, method) && (
                                <Field label={t("boutDetail.result.lostConsciousness")} htmlFor={loc.id} required error={form.error("lossOfConsciousness")}>
                                    <Select {...loc} defaultValue="">
                                        <option value="">{t("boutDetail.common.choose")}</option>
                                        {LOSS_OF_CONSCIOUSNESS.map((value) => (
                                            <option key={value} value={value}>
                                                {t(`boutLabel.loc.${value}`)}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            )}
                            {asksHeadStrikes(result, method) && (
                                <Field label={t("boutDetail.result.headStrikes")} htmlFor={head.id} required error={form.error("stoppedByHeadStrikes")}>
                                    <Select {...head} defaultValue="">
                                        <option value="">{t("boutDetail.common.choose")}</option>
                                        <option value="yes">{t("boutDetail.common.yes")}</option>
                                        <option value="no">{t("boutDetail.common.no")}</option>
                                    </Select>
                                </Field>
                            )}
                            <Checkbox
                                id={knockedDown.id}
                                name="knockedDown"
                                value="yes"
                                label={t("boutDetail.result.knockedDown")}
                                description={t("boutDetail.result.knockedDownDescription")}
                            />
                            <Field label={t("boutDetail.result.injuries")} htmlFor={injury.id} optional error={form.error("injuryNote")} hint={t("boutDetail.result.injuriesHint")}>
                                <Textarea {...injury} rows={2} maxLength={500} />
                            </Field>
                            <Field label={t("boutDetail.common.notes")} htmlFor={notes.id} optional error={form.error("notes")}>
                                <Textarea {...notes} rows={2} maxLength={500} />
                            </Field>
                        </>
                    );
                }}
            </ActionDialog>
        </>
    );
}
