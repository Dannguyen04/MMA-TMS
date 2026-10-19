"use client";

import { Ban, CalendarPlus, Flag, Link2, Pencil, Scale, ShieldAlert, Trophy } from "lucide-react";
import { useState } from "react";

import { Callout } from "@/components/training/callout";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import {
    cancelBoutAction,
    enterFightWeekAction,
    linkCampAction,
    recordResultAction,
    recordWeighInAction,
    updateBoutAction,
} from "@/lib/actions/bouts";
import type { ActionState } from "@/lib/actions/state";
import { CANCEL_REASONS, type CampBout, type CompetitionRuleset } from "@/lib/domain/bout";
import { asksHeadStrikes, asksLossOfConsciousness, BOUT_RESULTS, HYDRATION_CHECKS, LOSS_OF_CONSCIOUSNESS, madeWeight, methodsFor } from "@/lib/domain/bout-rules";
import {
    BOUT_METHOD_LABELS,
    BOUT_RESULT_LABELS,
    CANCEL_REASON_LABELS,
    HYDRATION_CHECK_LABELS,
    LOSS_OF_CONSCIOUSNESS_LABELS,
} from "@/lib/domain/labels";
import { formatNumber, toDateTimeInputValue } from "@/lib/format";
import { routes } from "@/lib/routes";
import { EventFields, RulesetNote, ScheduleFields, WeightClassField } from "../bout-schedule-fields";

function useNotify() {
    const toast = useToast();
    return (state: ActionState<unknown>) => toast({ title: state.message ?? "Saved", tone: "success" });
}

/* ─── Header: edit and cancel ─────────────────────────────────────────────── */

/** F8: event details, dates, class and the documents deadline. A class change needs a reason. */
export function EditBoutButton({ bout, ruleset, todayOn }: { bout: CampBout; ruleset: CompetitionRuleset | null; todayOn: string }) {
    const [open, setOpen] = useState(false);
    const notify = useNotify();
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
                Edit
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title="Edit bout"
                description="Changing a date moves the documents deadline and may change the acute-loss limit."
                size="lg"
                action={updateBoutAction}
                submitLabel="Save changes"
                pendingLabel="Saving"
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
                            <Field label="Reason for a class change" htmlFor={reason.id} optional error={form.error("changeReason")} hint="Needed only when the weight class changes.">
                                <Input {...reason} maxLength={300} />
                            </Field>
                            <ScheduleFields form={form} ruleset={ruleset} defaults={defaults} todayOn={todayOn} />
                            <Field label="Documents due, days before weigh-in" htmlFor={due.id} required error={form.error("requirementsDueDays")} hint="From the ruleset; change it to match the event's notice.">
                                <Input {...due} inputMode="numeric" defaultValue={String(bout.requirementsDueDays)} className="w-28" />
                            </Field>
                            <Field label="Notes" htmlFor={notes.id} optional error={form.error("notes")}>
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
    return (
        <>
            <Button variant="danger-soft" onClick={() => setOpen(true)}>
                <Ban aria-hidden />
                Cancel bout
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title="Cancel this bout?"
                description="The bout ends here and can't be reopened; create a new bout if it comes back. The camp plan and its sessions stay as they are, and no suspension is created."
                action={cancelBoutAction}
                submitLabel="Cancel bout"
                pendingLabel="Cancelling"
                submitVariant="danger"
                onSuccess={notify}
            >
                {(form) => {
                    const reason = form.control("reason", { required: true });
                    const note = form.control("note", { hint: true });
                    return (
                        <>
                            <input type="hidden" name="boutId" value={bout.id} />
                            <Field label="Reason" htmlFor={reason.id} required error={form.error("reason")}>
                                <Select {...reason} defaultValue="">
                                    <option value="">Choose a reason</option>
                                    {CANCEL_REASONS.map((value) => (
                                        <option key={value} value={value}>
                                            {CANCEL_REASON_LABELS[value]}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label="Note" htmlFor={note.id} error={form.error("note")} hint="Required for “Other”, such as a failed pre-bout medical with the organiser.">
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
    if (plans.length === 0) {
        return (
            <div className="flex flex-col gap-3">
                <p className="text-sm text-fg-muted">{fighterName} has no fight-camp plan to link yet. Create one, then come back to start the camp.</p>
                <ButtonLink href={`${routes.coach.newPlan}?fighter=${encodeURIComponent(bout.fighterId)}`} className="self-start">
                    <CalendarPlus aria-hidden />
                    Create a camp plan
                </ButtonLink>
            </div>
        );
    }
    return (
        <>
            <Button onClick={() => setOpen(true)} className="self-start">
                <Link2 aria-hidden />
                Link camp plan
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title="Link a camp plan"
                description="The bout moves to camp, and the weight chart starts on the plan's first day. A fighter can have one bout in camp at a time."
                action={linkCampAction}
                submitLabel="Start camp"
                pendingLabel="Starting camp"
                onSuccess={notify}
            >
                {(form) => {
                    const plan = form.control("trainingPlanId", { required: true });
                    return (
                        <>
                            <input type="hidden" name="boutId" value={bout.id} />
                            <Field label="Fight-camp plan" htmlFor={plan.id} required error={form.error("trainingPlanId")}>
                                <Select {...plan} defaultValue={plans.length === 1 ? plans[0].id : ""}>
                                    {plans.length > 1 && <option value="">Choose a plan</option>}
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
    const blocked = form.state.status === "error" ? form.state : null;
    return (
        <form {...form.formProps} className="flex flex-col gap-3">
            <input type="hidden" name="boutId" value={boutId} />
            {blocked && (
                <Callout tone="warning" icon={ShieldAlert} role="alert" title={blocked.message ?? "Fight week is blocked."}>
                    {blocked.data?.lines.length ? (
                        <ul className="mt-1 list-disc pl-5">
                            {blocked.data.lines.map((line) => (
                                <li key={line}>{line}</li>
                            ))}
                        </ul>
                    ) : null}
                </Callout>
            )}
            <SubmitButton pending={form.pending} pendingLabel="Checking Gate 1" className="self-start">
                <Flag aria-hidden />
                Enter fight week
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
    const limit = bout.catchweightKg ?? bout.limitKg;
    const kg = Number(weight.trim().replace(",", "."));
    const missed = weight.trim() !== "" && Number.isFinite(kg) && !madeWeight(kg, limit);

    return (
        <>
            <Button onClick={() => setOpen(true)} className="self-start">
                <Scale aria-hidden />
                Record official weigh-in
            </Button>
            <ActionDialog
                open={open}
                onClose={() => {
                    setOpen(false);
                    setWeight("");
                    setDecision("");
                    setHydration("");
                }}
                title="Official weigh-in"
                description={limit === null ? "Open class: there is no limit to make." : `The limit is ${formatNumber(limit, 1)} kg. The official weight is also saved as today's weight.`}
                action={recordWeighInAction}
                submitLabel={missed && decision === "CANCEL" ? "Cancel bout" : "Save weigh-in"}
                submitVariant={missed && decision === "CANCEL" ? "danger" : "primary"}
                pendingLabel="Saving"
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
                            <Field label="Official weight" htmlFor={weightControl.id} required error={form.error("weightKg")}>
                                <Input {...weightControl} inputMode="decimal" autoComplete="off" suffix="kg" value={weight} onChange={(event) => setWeight(event.target.value)} />
                            </Field>
                            {weight.trim() !== "" && Number.isFinite(kg) && limit !== null && (
                                <p role="status" className={missed ? "text-sm font-medium text-danger-fg" : "text-sm font-medium text-success-fg"}>
                                    {missed ? `Over the limit by ${formatNumber(kg - limit, 1)} kg.` : "Made weight."}
                                </p>
                            )}
                            <Field label="Hydration check" htmlFor={hydrationControl.id} optional error={form.error("hydrationCheck")} hint="Only when the event tests it.">
                                <Select {...hydrationControl} value={hydration} onChange={(event) => setHydration(event.target.value)}>
                                    <option value="">Not recorded</option>
                                    {HYDRATION_CHECKS.map((value) => (
                                        <option key={value} value={value}>
                                            {HYDRATION_CHECK_LABELS[value]}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            {missed && (
                                <>
                                    <ChoiceGroup
                                        id={`${form.formProps.id}-decision`}
                                        name="decision"
                                        legend="Missed the limit. What happens now?"
                                        required
                                        options={[
                                            { value: "CATCHWEIGHT", label: "Go on at a catchweight", description: "Record the new limit the two corners agreed." },
                                            { value: "CANCEL", label: "Cancel the bout", description: "Cancelled with the reason “Missed weight”." },
                                        ]}
                                        value={decision}
                                        onChange={setDecision}
                                        error={form.error("decision")}
                                    />
                                    {decision === "CATCHWEIGHT" && (
                                        <Field label="Catchweight" htmlFor={catchweight.id} required error={form.error("catchweightKg")}>
                                            <Input {...catchweight} inputMode="decimal" autoComplete="off" suffix="kg" />
                                        </Field>
                                    )}
                                    <Field label="Note" htmlFor={note.id} required={decision === "CATCHWEIGHT"} optional={decision !== "CATCHWEIGHT"} error={form.error("note")}>
                                        <Textarea {...note} rows={2} maxLength={300} placeholder={decision === "CATCHWEIGHT" ? "Such as a 20% purse penalty" : undefined} />
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
    const methods = methodsFor(bout.sport);

    return (
        <>
            <Button onClick={() => setOpen(true)} className="self-start">
                <Trophy aria-hidden />
                Record result
            </Button>
            <ActionDialog
                open={open}
                onClose={() => {
                    setOpen(false);
                    setResult("");
                    setMethod("");
                }}
                title="Record the result"
                description="The bout is completed once saved. A knockout loss suggests a suspension next."
                size="lg"
                action={recordResultAction}
                submitLabel="Save result"
                pendingLabel="Saving"
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
                                <Field label="Result" htmlFor={resultControl.id} required error={form.error("result")}>
                                    <Select {...resultControl} value={result} onChange={(event) => setResult(event.target.value)}>
                                        <option value="">Choose</option>
                                        {BOUT_RESULTS.map((value) => (
                                            <option key={value} value={value}>
                                                {BOUT_RESULT_LABELS[value]}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                                <Field label="Method" htmlFor={methodControl.id} required error={form.error("method")}>
                                    <Select {...methodControl} value={method} onChange={(event) => setMethod(event.target.value)}>
                                        <option value="">Choose</option>
                                        {methods.map((value) => (
                                            <option key={value} value={value}>
                                                {BOUT_METHOD_LABELS[value]}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            </div>
                            <Field label="Round" htmlFor={round.id} optional error={form.error("round")} hint="Leave empty for a decision.">
                                <Input {...round} inputMode="numeric" className="w-28" />
                            </Field>
                            {asksLossOfConsciousness(result, method) && (
                                <Field label="Lost consciousness?" htmlFor={loc.id} required error={form.error("lossOfConsciousness")}>
                                    <Select {...loc} defaultValue="">
                                        <option value="">Choose</option>
                                        {LOSS_OF_CONSCIOUSNESS.map((value) => (
                                            <option key={value} value={value}>
                                                {LOSS_OF_CONSCIOUSNESS_LABELS[value]}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            )}
                            {asksHeadStrikes(result, method) && (
                                <Field label="Was the bout stopped for strikes to the head?" htmlFor={head.id} required error={form.error("stoppedByHeadStrikes")}>
                                    <Select {...head} defaultValue="">
                                        <option value="">Choose</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </Select>
                                </Field>
                            )}
                            <Checkbox id={knockedDown.id} name="knockedDown" value="yes" label="Knocked down during the bout" description="Kept for reference; it does not create a suspension on its own." />
                            <Field label="Injuries seen after the bout" htmlFor={injury.id} optional error={form.error("injuryNote")} hint="What you saw. This is not a medical record.">
                                <Textarea {...injury} rows={2} maxLength={500} />
                            </Field>
                            <Field label="Notes" htmlFor={notes.id} optional error={form.error("notes")}>
                                <Textarea {...notes} rows={2} maxLength={500} />
                            </Field>
                        </>
                    );
                }}
            </ActionDialog>
        </>
    );
}
