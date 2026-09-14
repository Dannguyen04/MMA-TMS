"use client";

import { Info, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { ClearanceCard } from "@/components/domain/clearance-card";
import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { ClearanceBadge, HealthStatusBadge } from "@/components/domain/status-badges";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { grantClearanceAction } from "@/lib/actions/medical";
import { CLEARANCE_LEVEL_LABELS, EXAMINATION_OUTCOME_LABELS, EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import { clearanceState, type ClearanceState } from "@/lib/domain/rules";
import type { ClearanceLevel, ExaminationOutcome, ExaminationType, MedicalClearance } from "@/lib/domain/types";
import { addDaysToKey, daysBetween, formatDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { CLEARANCE_LEVEL_FOR_OUTCOME, ExaminationOutcomeBadge } from "./clinical-badges";
import { ClearanceValidity } from "@/components/domain/clearance-validity";
import { RestrictionBuilder, type RestrictionDraft } from "./restriction-builder";
import { RestrictionSummary } from "./restriction-summary";

export interface ClearanceExaminationOption {
    id: string;
    date: string;
    type: ExaminationType;
    outcome: ExaminationOutcome;
    summary: string;
}

export interface ClearanceFighterContext extends FighterIdentityData {
    id: string;
    clearance: MedicalClearance | null;
    state: ClearanceState;
    issuedByName: string | null;
    /** Open injuries as short labels, e.g. "Concussion — head (active)". */
    openInjuries: string[];
    /** Recent examinations, newest first. */
    examinations: ClearanceExaminationOption[];
}

export interface GrantClearanceFormProps {
    fighters: ClearanceFighterContext[];
    defaultFighterId: string;
    defaultExaminationId: string;
    /** Today in the academy timezone, YYYY-MM-DD. */
    today: string;
    /** Server time (ISO). */
    now: string;
    doctorName: string;
    warningDays: number;
}

const VALIDITY_PICKS = [30, 60, 90, 180];

const LEVEL_OPTIONS: ChoiceOption<ClearanceLevel>[] = [
    {
        value: "full",
        label: CLEARANCE_LEVEL_LABELS.full,
        icon: ShieldCheck,
        tone: "success",
        description: "Can take part in all training and competition. Coaches can plan any session.",
    },
    {
        value: "restricted",
        label: CLEARANCE_LEVEL_LABELS.restricted,
        icon: ShieldAlert,
        tone: "warning",
        description: "Can train within the limits you set. Sessions that break a limit are blocked or flagged when coaches plan them.",
    },
    {
        value: "not_cleared",
        label: CLEARANCE_LEVEL_LABELS.not_cleared,
        icon: ShieldX,
        tone: "danger",
        description: "Must not train. Planned sessions are blocked until you issue a new clearance.",
    },
];

const draftsFrom = (clearance: MedicalClearance | null): RestrictionDraft[] =>
    clearance?.level === "restricted" && clearance.status === "active"
        ? clearance.restrictions.map((restriction, index) => ({
              key: index + 1,
              label: restriction.label,
              blockedTrainingTypes: restriction.blockedTrainingTypes,
              blockedTechniques: restriction.blockedTechniques,
              blockedRegions: restriction.blockedRegions,
              maxRpe: restriction.maxRpe,
          }))
        : [];

/** Issues a Medical Clearance: decision, validity, restrictions and clinical reason, with a live coach preview. */
export function GrantClearanceForm({ fighters, defaultFighterId, defaultExaminationId, today, now, doctorName, warningDays }: GrantClearanceFormProps) {
    const form = useActionForm(grantClearanceAction, { id: "clearance" });
    const { control, error } = form;

    const initialFighter = fighters.find((fighter) => fighter.id === defaultFighterId) ?? null;
    const initialExam = initialFighter?.examinations.find((exam) => exam.id === defaultExaminationId) ?? null;

    const [fighterId, setFighterId] = useState(initialFighter?.id ?? "");
    const [level, setLevel] = useState<ClearanceLevel | "">(initialExam ? CLEARANCE_LEVEL_FOR_OUTCOME[initialExam.outcome] : "");
    const [validUntil, setValidUntil] = useState("");
    const [reason, setReason] = useState("");
    const [examinationId, setExaminationId] = useState(initialExam?.id ?? initialFighter?.examinations[0]?.id ?? "");
    const [drafts, setDrafts] = useState<RestrictionDraft[]>(() => draftsFrom(initialFighter?.clearance ?? null));
    const [copiedRestrictions, setCopiedRestrictions] = useState(() => draftsFrom(initialFighter?.clearance ?? null).length > 0);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const fighter = fighters.find((candidate) => candidate.id === fighterId) ?? null;
    const linkedExam = fighter?.examinations.find((exam) => exam.id === examinationId) ?? null;
    const examMismatch = linkedExam && level ? CLEARANCE_LEVEL_FOR_OUTCOME[linkedExam.outcome] !== level : false;
    const validDays = validUntil ? daysBetween(`${today}T12:00:00Z`, `${validUntil}T12:00:00Z`) : null;

    const changeFighter = (nextId: string) => {
        const next = fighters.find((candidate) => candidate.id === nextId) ?? null;
        const copied = draftsFrom(next?.clearance ?? null);
        setFighterId(nextId);
        setExaminationId(next?.examinations[0]?.id ?? "");
        setDrafts(copied);
        setCopiedRestrictions(copied.length > 0);
        form.markEdited("restrictions");
    };

    const preview: MedicalClearance | null =
        fighter && level
            ? {
                  id: "preview",
                  fighterId: fighter.id,
                  doctorId: "",
                  level,
                  status: "active",
                  issuedAt: now,
                  validUntil: level !== "not_cleared" && validUntil ? `${validUntil}T12:00:00.000Z` : null,
                  reason,
                  restrictions:
                      level === "restricted" ? drafts.map(({ key, ...restriction }) => ({ ...restriction, id: `preview-${key}`, label: restriction.label || "Untitled restriction" })) : [],
                  examinationId: examinationId || null,
                  revokedAt: null,
                  revokedReason: null,
              }
            : null;

    const submitLabel = level === "restricted" ? "Issue restricted clearance" : level === "not_cleared" ? "Set as not cleared…" : "Issue clearance";

    return (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
            <form
                {...form.formProps}
                onSubmit={(event) => {
                    if (level !== "not_cleared") return form.formProps.onSubmit(event);
                    event.preventDefault();
                    setConfirmOpen(true);
                }}
                className="min-w-0"
            >
                <input
                    type="hidden"
                    name="restrictions"
                    value={JSON.stringify(
                        level === "restricted"
                            ? drafts.map(({ label, blockedTrainingTypes, blockedTechniques, blockedRegions, maxRpe }) => ({
                                  label,
                                  blockedTrainingTypes,
                                  blockedTechniques,
                                  blockedRegions,
                                  maxRpe,
                              }))
                            : [],
                    )}
                />
                <Card className="flex flex-col divide-y divide-border">
                    <Section title="Fighter" description="Clearance applies to one fighter and replaces their current clearance.">
                        <Field label="Fighter" htmlFor={control("fighterId").id} error={error("fighterId")} required className="sm:max-w-sm">
                            <Select {...control("fighterId", { required: true })} value={fighterId} onChange={(event) => changeFighter(event.target.value)}>
                                <option value="">Choose a fighter…</option>
                                {fighters.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </Section>

                    <Section title="Decision" description="What the fighter may do from now on. The consequence is shown under each option.">
                        <div>
                            <ChoiceGroup
                                id={control("level").id}
                                name="level"
                                legend="Clearance level"
                                legendVisuallyHidden
                                required
                                options={LEVEL_OPTIONS}
                                value={level}
                                onChange={setLevel}
                                error={error("level")}
                            />
                            <div aria-live="polite">
                                {linkedExam && level && (
                                    <InlineNote icon={Info} tone={examMismatch ? "warning" : "neutral"} className="mt-2">
                                        {examMismatch
                                            ? `The linked ${EXAMINATION_TYPE_LABELS[linkedExam.type].toLowerCase()} concluded “${EXAMINATION_OUTCOME_LABELS[linkedExam.outcome]}”. Explain the difference in the clinical reason.`
                                            : `Matches the outcome of the linked ${EXAMINATION_TYPE_LABELS[linkedExam.type].toLowerCase()}.`}
                                    </InlineNote>
                                )}
                            </div>
                        </div>
                    </Section>

                    {level !== "not_cleared" ? (
                        <Section title="Validity" description="Clearances lapse on this date and training is blocked until renewed.">
                            <Field
                                label="Valid until"
                                htmlFor={control("validUntil").id}
                                error={error("validUntil")}
                                required
                                hint={
                                    validDays !== null && validDays >= 0
                                        ? `Valid for ${pluralize(validDays, "day")}. Coaches see a warning ${warningDays} days before it lapses.`
                                        : "Up to 12 months. Match it to your next planned examination."
                                }
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="w-44">
                                        <Input
                                            {...control("validUntil", { hint: true, required: true })}
                                            type="date"
                                            value={validUntil}
                                            min={today}
                                            max={addDaysToKey(today, 365)}
                                            onChange={(event) => setValidUntil(event.target.value)}
                                        />
                                    </div>
                                    <span className="text-[13px] text-fg-muted" aria-hidden>
                                        or
                                    </span>
                                    {VALIDITY_PICKS.map((days) => {
                                        const date = addDaysToKey(today, days);
                                        return (
                                            <Button
                                                key={days}
                                                variant={validUntil === date ? "primary" : "secondary"}
                                                size="sm"
                                                aria-pressed={validUntil === date}
                                                onClick={() => {
                                                    setValidUntil(date);
                                                    form.markEdited("validUntil");
                                                }}
                                            >
                                                {days} days
                                            </Button>
                                        );
                                    })}
                                </div>
                            </Field>
                        </Section>
                    ) : (
                        <Section title="Validity" description="A not cleared decision has no end date.">
                            <InlineNote icon={Info}>It stays in force until you examine the fighter again and issue a new clearance.</InlineNote>
                        </Section>
                    )}

                    {level === "restricted" && (
                        <Section
                            title="Restrictions"
                            description="Word each one the way a coach should read it. Limits underneath are enforced when sessions are planned."
                        >
                            {copiedRestrictions && drafts.length > 0 && (
                                <InlineNote icon={Info} tone="info">
                                    Copied from the current clearance — review each one before issuing.
                                </InlineNote>
                            )}
                            <RestrictionBuilder drafts={drafts} onChange={setDrafts} error={error} markEdited={form.markEdited} />
                        </Section>
                    )}

                    <Section title="Clinical reason & evidence" description="Why you made this decision, and the examination it rests on.">
                        <Field
                            label="Clinical reason"
                            htmlFor={control("reason").id}
                            error={error("reason")}
                            required
                            hint="Doctors only. Coaches and the fighter see the level, restrictions and validity — never this reason."
                        >
                            <Textarea
                                {...control("reason", { hint: true, required: true })}
                                rows={4}
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                placeholder="e.g. Pain-free full range and 90% strength symmetry on dynamometry. Cleared for technical work; no contact until graded exposure is complete."
                            />
                        </Field>
                        <Field
                            label="Linked examination"
                            htmlFor={control("examinationId").id}
                            error={error("examinationId")}
                            optional
                            hint={fighter && fighter.examinations.length === 0 ? "No examinations recorded for this fighter yet." : "The examination this decision is based on."}
                            className="sm:max-w-lg"
                        >
                            <Select {...control("examinationId", { hint: true })} value={examinationId} onChange={(event) => setExaminationId(event.target.value)} disabled={!fighter}>
                                <option value="">No linked examination</option>
                                {fighter?.examinations.map((exam) => (
                                    <option key={exam.id} value={exam.id}>
                                        {EXAMINATION_TYPE_LABELS[exam.type]} · {formatDate(exam.date)} · {EXAMINATION_OUTCOME_LABELS[exam.outcome]}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </Section>

                    <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
                        <FormMessage {...form.message} />
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <Link href={fighter ? routes.doctor.fighter(fighter.id) : routes.doctor.clearance} className={buttonClasses({ variant: "secondary" })}>
                                Cancel
                            </Link>
                            <Button type="submit" variant={level === "not_cleared" ? "danger" : "primary"} loading={form.pending}>
                                {form.pending ? "Issuing clearance…" : submitLabel}
                            </Button>
                        </div>
                    </div>
                </Card>
            </form>

            <aside aria-label="Context and preview" className="flex min-w-0 flex-col gap-6">
                <Card>
                    <CardHeader title="Current status" />
                    <CardContent>
                        <CurrentStatus fighter={fighter} now={now} warningDays={warningDays} />
                    </CardContent>
                </Card>

                <section aria-labelledby="clearance-preview-heading" className="flex flex-col gap-2">
                    <div>
                        <h2 id="clearance-preview-heading" className="text-[15px] font-semibold text-fg">
                            How coaches and the fighter will see it
                        </h2>
                        <p className="text-[13px] text-fg-muted">Live preview. The clinical reason stays private to doctors.</p>
                    </div>
                    {preview ? (
                        <ClearanceCard clearance={preview} state={clearanceState(preview, now)} doctorName={doctorName} now={now} variant="summary" warningDays={warningDays} />
                    ) : (
                        <p className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-fg-muted">
                            {fighter ? "Choose a clearance level to preview the clearance." : "Choose a fighter and a clearance level to preview the clearance."}
                        </p>
                    )}
                </section>
            </aside>

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={() => {
                    setConfirmOpen(false);
                    form.submit({ confirmNotCleared: "yes" });
                }}
                title={`Set ${fighter?.name ?? "this fighter"} as not cleared?`}
                description="Coaches and the fighter are notified immediately, and every planned session is blocked until you issue a new clearance."
                confirmLabel="Set as not cleared"
            />
        </div>
    );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    const headingId = useId();
    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-4 px-5 py-5 sm:px-6">
            <div>
                <h2 id={headingId} className="text-[15px] font-semibold text-fg">
                    {title}
                </h2>
                <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>
            </div>
            {children}
        </section>
    );
}

function CurrentStatus({ fighter, now, warningDays }: { fighter: ClearanceFighterContext | null; now: string; warningDays: number }) {
    if (!fighter) return <p className="text-sm text-fg-muted">Choose a fighter to see their current clearance and latest examination.</p>;
    const latest = fighter.examinations[0];
    return (
        <div className="flex flex-col gap-4">
            <FighterIdentity fighter={fighter} size="sm" href={routes.doctor.fighter(fighter.id)} />
            <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-fg-muted">Current Medical Clearance</p>
                <div className="flex flex-wrap items-center gap-1.5">
                    <ClearanceBadge state={fighter.state} size="sm" />
                    <HealthStatusBadge status={fighter.healthStatus} size="sm" />
                </div>
                <ClearanceValidity clearance={fighter.clearance} state={fighter.state} now={now} warningDays={warningDays} />
                {fighter.clearance && fighter.issuedByName && (
                    <p className="text-xs text-fg-muted">
                        Issued by {fighter.issuedByName} on {formatDate(fighter.clearance.issuedAt)}
                    </p>
                )}
                {fighter.state === "restricted" && fighter.clearance && <RestrictionSummary restrictions={fighter.clearance.restrictions} />}
            </div>
            {fighter.openInjuries.length > 0 && (
                <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium text-fg-muted">Open injuries</p>
                    <ul className="text-[13px] text-fg">
                        {fighter.openInjuries.map((injury) => (
                            <li key={injury}>{injury}</li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="flex flex-col gap-1.5 border-t border-border pt-4">
                <p className="text-xs font-medium text-fg-muted">Latest examination</p>
                {latest ? (
                    <>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                            <Link href={routes.doctor.examination(latest.id)} className="font-medium text-fg hover:underline">
                                {EXAMINATION_TYPE_LABELS[latest.type]}
                            </Link>
                            <span className="text-fg-muted">{formatDate(latest.date)}</span>
                        </p>
                        <ExaminationOutcomeBadge outcome={latest.outcome} size="sm" className="self-start" />
                        <p className="line-clamp-4 text-[13px] text-pretty text-fg-muted">{latest.summary}</p>
                    </>
                ) : (
                    <p className="text-[13px] text-fg-muted">
                        No examinations yet.{" "}
                        <Link href={`${routes.doctor.newExamination}?fighter=${fighter.id}&type=baseline`} className="font-medium text-primary-soft-fg hover:underline">
                            Record a baseline physical
                        </Link>{" "}
                        before issuing a clearance.
                    </p>
                )}
            </div>
        </div>
    );
}
