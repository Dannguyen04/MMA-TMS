"use client";

import { CheckCheck, Clock, Plus, SkipForward, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { TermHint } from "@/components/domain/term-hint";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Checkbox, Field, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { SuggestionChips } from "@/components/ui/suggestion-chips";
import type { ActionForm, ActionFormControl } from "@/components/ui/use-action-form";
import type { GlossaryTerm } from "@/lib/domain/glossary";
import { SCAT6, SCAT6_LISTS } from "@/lib/domain/scat6";
import { ageFromBirthDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { QuickFill } from "./quick-fill";
import {
    anyGaitTrialIncomplete,
    BACKGROUND_CONDITIONS,
    canFillNoBackground,
    canFillNoSymptoms,
    delayedRecallEarliest,
    digitTestContinues,
    emptyScat6Draft,
    fillNoBackground,
    fillNoSymptoms,
    fillToggleRow,
    problemSentence,
    problemsByPath,
    scat6FromDraft,
    scat6Problems,
    skipPart,
    stampNow,
    toggleRows,
    toggleValues,
    type QuickFillResult,
    type Scat6Draft,
    type Scat6Step,
    type StancesDraft,
    type YesNo,
} from "./scat6-draft";

type FormControls = Pick<ActionForm<unknown>, "error" | "control" | "markEdited">;

const LIST_OPTIONS = SCAT6_LISTS.map((value) => ({ value, label: `List ${value}` }));
const numbered = (count: number) => Array.from({ length: count }, (_, index) => index);

/*
 * The SCAT6 a baseline examination carries, entered item by item as numbered on the official paper form (the form's own
 * wording is never shown). One draft (`useScat6Draft`) feeds three groups of parts, so the examination form can give
 * each its own step and the demo form can show them in a row. Nothing is assumed normal or skipped: every quick fill is
 * a button the doctor clicks, and the medical service computes the scores.
 */

/* ─── State ───────────────────────────────────────────────────────────────── */

export interface Scat6Controller {
    draft: Scat6Draft;
    /** Applies a change and hides the server error of the field (or group) it touched. */
    change: (edit: (next: Scat6Draft) => void, path?: string) => void;
    /** Runs a quick fill the doctor clicked and keeps its note under `key`. */
    quick: (key: string, compute: (draft: Scat6Draft) => QuickFillResult | null, path: string) => void;
    notes: Record<string, string>;
    /** The server's error for a record path, or the form's own once the doctor tried to leave that step. */
    error: (path: string) => string | undefined;
    id: (path: string) => string;
    form: FormControls;
    /** YYYY-MM-DDTHH:mm in the academy timezone, when the page loaded. */
    nowInput: string;
    tooYoung: boolean;
    underAgeOn: (value: string) => boolean;
    /** Checks one step before leaving it: shows its problems in place and returns a sentence for the footer, or null. */
    validate: (step: Scat6Step) => string | null;
    /** Every problem, keyed by form field name (`scat6.<path>`), for a last check before sending; null when there are none. */
    validateAll: () => Record<string, string> | null;
}

export interface UseScat6DraftOptions {
    form: FormControls;
    nowInput: string;
    /** The athlete's date of birth, when known: a SCAT6 is only administered from age 13. */
    dateOfBirth: string | null;
}

/** The SCAT6's working state for one examination form. It lives as long as the form, never in browser storage. */
export function useScat6Draft({ form, nowInput, dateOfBirth }: UseScat6DraftOptions): Scat6Controller {
    /** Whether the athlete was under 13 on that day (datetime-local value), when the date of birth is known. */
    const underAgeOn = (value: string) => dateOfBirth !== null && value !== "" && ageFromBirthDate(dateOfBirth, value.slice(0, 10)) < SCAT6.MIN_AGE_YEARS;
    const tooYoung = underAgeOn(nowInput);
    const [draft, setDraft] = useState(() => ({ ...emptyScat6Draft(nowInput), ...(tooYoung ? { status: "NOT_ADMINISTERED" as const } : {}) }));
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [attempted, setAttempted] = useState<ReadonlySet<Scat6Step>>(() => new Set());
    const problems = useMemo(() => scat6Problems(draft), [draft]);
    const byPath = useMemo(() => problemsByPath(problems), [problems]);

    const change: Scat6Controller["change"] = (edit, path) => {
        setDraft((current) => {
            const next = structuredClone(current);
            edit(next);
            return next;
        });
        if (path) form.markEdited(`scat6.${path}`);
    };

    const quick: Scat6Controller["quick"] = (key, compute, path) => {
        const result = compute(draft);
        if (!result) return;
        setDraft(result.draft);
        setNotes((current) => ({ ...current, [key]: result.filled }));
        form.markEdited(`scat6.${path}`);
    };

    const error = (path: string) => {
        const server = form.error(`scat6.${path}`);
        if (server) return server;
        const problem = byPath[path];
        return problem && attempted.has(problem.step) ? problem.message : undefined;
    };

    const validate = (step: Scat6Step) => {
        setAttempted((current) => new Set(current).add(step));
        const found = problems.filter((problem) => problem.step === step);
        if (found.length === 0) return null;
        return found.length === 1 ? problemSentence(found[0]) : `${found.length} answers on this step need attention, starting with ${problemSentence(found[0]).replace(/\.$/, "")}. Each is marked in place.`;
    };

    const validateAll = () => {
        setAttempted(new Set<Scat6Step>(["history", "memory", "balance"]));
        if (problems.length === 0) return null;
        return Object.fromEntries(problems.map((problem) => [`scat6.${problem.path}`, problem.message]));
    };

    return { draft, change, quick, notes, error, id: (path) => form.control(`scat6.${path}`).id, form, nowInput, tooYoung, underAgeOn, validate, validateAll };
}

/** The serialized record the action reads; sent only while the examination carries a SCAT6. */
export function Scat6RecordInput({ scat6 }: { scat6: Scat6Controller }) {
    return <input type="hidden" name="scat6" value={JSON.stringify(scat6FromDraft(scat6.draft))} />;
}

/* ─── Step 1: status, history and symptoms ────────────────────────────────── */

/** Whether it was administered, the athlete's background, the immediate assessment and the symptoms. */
export function Scat6HistoryFields({ scat6 }: { scat6: Scat6Controller }) {
    const { draft, change, tooYoung } = scat6;
    return (
        <>
            <FormSection
                title="SCAT6"
                info={<TermHint term="scat6" />}
                description="Record it by item number, reading the wording from the official paper form. The medical service calculates the scores."
            >
                <ChoiceGroup
                    id={scat6.id("status")}
                    name="scat6.status"
                    legend="SCAT6 at this baseline"
                    columns={2}
                    variant="compact"
                    options={[
                        { value: "ADMINISTERED", label: "Administered", description: tooYoung ? "Not before age 13: the athlete is younger." : "Athlete is 13 or older.", disabled: tooYoung },
                        { value: "NOT_ADMINISTERED", label: "Not administered", description: "For example under 13, or not clinically appropriate." },
                    ]}
                    value={draft.status}
                    onChange={(status) => change((next) => { next.status = status; })}
                />
                {draft.status === "NOT_ADMINISTERED" ? (
                    <TextArea scat6={scat6} path="reason" label="Why it wasn't administered" value={draft.notAdministeredReason} max={2_000} onChange={(value) => change((next) => { next.notAdministeredReason = value; }, "reason")} />
                ) : (
                    <>
                        <DateTime scat6={scat6} path="administeredAt" label="Started" value={draft.administeredAt} onChange={(value) => change((next) => { next.administeredAt = value; }, "administeredAt")} />
                        {scat6.underAgeOn(draft.administeredAt) && <ErrorText message="The athlete was under 13 on that day. Record the SCAT6 as not administered." />}
                        <Checkbox
                            id={scat6.id("examinerAttestation")}
                            name="scat6.examinerAttestation"
                            checked={draft.examinerAttestation}
                            onChange={(event) => change((next) => { next.examinerAttestation = event.target.checked; }, "examinerAttestation")}
                            label="I'm a healthcare professional and administered or supervised this SCAT6"
                            info={<TermHint term="examinerAttestation" />}
                            aria-invalid={scat6.error("examinerAttestation") ? true : undefined}
                        />
                        <ErrorText message={scat6.error("examinerAttestation")} />
                    </>
                )}
            </FormSection>
            {draft.status === "ADMINISTERED" && (
                <>
                    <AthleteFields scat6={scat6} />
                    <ImmediateAssessmentFields scat6={scat6} />
                    <BackgroundFields scat6={scat6} />
                    <SymptomFields scat6={scat6} />
                </>
            )}
        </>
    );
}

function AthleteFields({ scat6 }: { scat6: Scat6Controller }) {
    const { draft, change } = scat6;
    const history = draft.concussionHistory;
    return (
        <FormSection title="Athlete background" info={<TermHint term="athleteBackground" />} description="What the form asks before testing.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Dominant hand" htmlFor={scat6.id("athlete.dominantHand")} error={scat6.error("athlete.dominantHand")} required>
                    <Select
                        id={scat6.id("athlete.dominantHand")}
                        name="scat6.athlete.dominantHand"
                        value={draft.athlete.dominantHand}
                        onChange={(event) => change((next) => { next.athlete.dominantHand = event.target.value as Scat6Draft["athlete"]["dominantHand"]; }, "athlete.dominantHand")}
                    >
                        <option value="">Choose…</option>
                        <option value="LEFT">Left</option>
                        <option value="RIGHT">Right</option>
                        <option value="AMBIDEXTROUS">Ambidextrous</option>
                    </Select>
                </Field>
                <Text scat6={scat6} path="athlete.sportTeamSchool" label="Sport, team or school" value={draft.athlete.sportTeamSchool} max={200} optional onChange={(value) => change((next) => { next.athlete.sportTeamSchool = value; })} />
                <Text scat6={scat6} path="athlete.currentSchoolYear" label="Current school year" value={draft.athlete.currentSchoolYear} max={50} optional onChange={(value) => change((next) => { next.athlete.currentSchoolYear = value; })} />
                <NumberField scat6={scat6} path="athlete.yearsOfEducation" label="Years of education" value={draft.athlete.yearsOfEducation} min={0} max={40} optional onChange={(value) => change((next) => { next.athlete.yearsOfEducation = value; })} />
                <Text scat6={scat6} path="athlete.firstLanguage" label="First language" value={draft.athlete.firstLanguage} max={100} optional onChange={(value) => change((next) => { next.athlete.firstLanguage = value; })} />
                <Text scat6={scat6} path="athlete.preferredLanguage" label="Preferred language" value={draft.athlete.preferredLanguage} max={100} optional onChange={(value) => change((next) => { next.athlete.preferredLanguage = value; })} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <NumberField
                        scat6={scat6}
                        path="concussionHistory.priorDiagnosedConcussions"
                        label="Diagnosed concussions before"
                        value={history.priorDiagnosedConcussions}
                        min={0}
                        max={100}
                        onChange={(value) => change((next) => { next.concussionHistory.priorDiagnosedConcussions = value; }, "concussionHistory.priorDiagnosedConcussions")}
                    />
                    {history.priorDiagnosedConcussions.trim() === "" && (
                        <SuggestionChips
                            label="Quick pick"
                            suggestions={[{ label: "None", value: "0" }]}
                            onPick={(value) => change((next) => { next.concussionHistory.priorDiagnosedConcussions = value; }, "concussionHistory.priorDiagnosedConcussions")}
                        />
                    )}
                </div>
                <NumberField
                    scat6={scat6}
                    path="concussionHistory.mostRecentRecoveryDays"
                    label="Days to recover from the last one"
                    value={history.mostRecentRecoveryDays}
                    min={0}
                    max={3_650}
                    optional
                    onChange={(value) => change((next) => { next.concussionHistory.mostRecentRecoveryDays = value; })}
                />
                <Text scat6={scat6} path="concussionHistory.mostRecentConcussion" label="Most recent concussion" value={history.mostRecentConcussion} max={200} optional onChange={(value) => change((next) => { next.concussionHistory.mostRecentConcussion = value; })} />
            </div>
            <TextArea scat6={scat6} path="concussionHistory.primarySymptoms" label="Primary symptoms" value={history.primarySymptoms} max={1_000} optional onChange={(value) => change((next) => { next.concussionHistory.primarySymptoms = value; })} />
        </FormSection>
    );
}

function ImmediateAssessmentFields({ scat6 }: { scat6: Scat6Controller }) {
    const { draft, change } = scat6;
    const ia = draft.immediateAssessment;
    const yesNo = (path: string, label: string, value: YesNo, set: (next: Scat6Draft, value: boolean) => void) => (
        <YesNoField scat6={scat6} path={path} label={label} value={value} onChange={(answer) => change((next) => set(next, answer), path)} />
    );
    return (
        <OptionalPart scat6={scat6} part="immediateAssessment" title="Immediate assessment" term="immediateAssessment" description="The on-field screen after a suspected head injury." skipLabel="Not performed — baseline, no injury">
            <div className="grid gap-3 sm:grid-cols-2">
                {yesNo("immediateAssessment.observableSigns.witnessed", "Signs witnessed", ia.witnessed, (next, value) => { next.immediateAssessment.witnessed = value; })}
                {yesNo("immediateAssessment.observableSigns.observedOnVideo", "Observed on video", ia.observedOnVideo, (next, value) => { next.immediateAssessment.observedOnVideo = value; })}
            </div>
            <Toggles scat6={scat6} path="immediateAssessment.observableSigns.signs" legend="Observable signs present" term="observableSigns" values={ia.signs} />
            <GcsRows scat6={scat6} />
            <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-fg">Cervical spine</p>
                <TermHint term="cervicalSpine" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                {yesNo("immediateAssessment.cervicalSpine.neckPainAtRest", "Neck pain at rest", ia.neckPainAtRest, (next, value) => { next.immediateAssessment.neckPainAtRest = value; })}
                {yesNo("immediateAssessment.cervicalSpine.tendernessToPalpation", "Tenderness to palpation", ia.tendernessToPalpation, (next, value) => { next.immediateAssessment.tendernessToPalpation = value; })}
                {ia.neckPainAtRest === false &&
                    ia.tendernessToPalpation === false &&
                    yesNo("immediateAssessment.cervicalSpine.fullActiveRangeOfMotion", "Full active range of motion", ia.fullActiveRangeOfMotion, (next, value) => { next.immediateAssessment.fullActiveRangeOfMotion = value; })}
                {yesNo("immediateAssessment.cervicalSpine.limbStrengthAndSensationNormal", "Limb strength and sensation normal", ia.limbStrengthAndSensationNormal, (next, value) => {
                    next.immediateAssessment.limbStrengthAndSensationNormal = value;
                })}
                {yesNo("immediateAssessment.coordinationOcularMotor.fingerToNoseNormal", "Finger-to-nose normal", ia.fingerToNoseNormal, (next, value) => { next.immediateAssessment.fingerToNoseNormal = value; })}
                {yesNo("immediateAssessment.coordinationOcularMotor.ocularMotorWithoutDoubleVision", "No double vision", ia.ocularMotorWithoutDoubleVision, (next, value) => {
                    next.immediateAssessment.ocularMotorWithoutDoubleVision = value;
                })}
                {yesNo("immediateAssessment.coordinationOcularMotor.extraocularMovementsNormal", "Extraocular movements normal", ia.extraocularMovementsNormal, (next, value) => {
                    next.immediateAssessment.extraocularMovementsNormal = value;
                })}
            </div>
            {ia.extraocularMovementsNormal === false && (
                <TextArea
                    scat6={scat6}
                    path="immediateAssessment.coordinationOcularMotor.extraocularDescription"
                    label="Describe the extraocular movements"
                    value={ia.extraocularDescription}
                    max={1_000}
                    onChange={(value) => change((next) => { next.immediateAssessment.extraocularDescription = value; }, "immediateAssessment.coordinationOcularMotor.extraocularDescription")}
                />
            )}
            <Toggles scat6={scat6} path="immediateAssessment.maddocks" legend="Maddocks questions answered correctly" term="maddocks" values={ia.maddocks} />
        </OptionalPart>
    );
}

function BackgroundFields({ scat6 }: { scat6: Scat6Controller }) {
    const { draft, change } = scat6;
    return (
        <FormSection title="Medical background" info={<TermHint term="athleteBackground" />} description="Conditions that can affect the results. Answer each one.">
            <QuickFill label="None apply" icon={CheckCheck} available={canFillNoBackground(draft)} note={scat6.notes.background} onClick={() => scat6.quick("background", fillNoBackground, "background")} />
            <div className="grid gap-3 sm:grid-cols-2">
                {BACKGROUND_CONDITIONS.map(([key, label]) => (
                    <YesNoField key={key} scat6={scat6} path={`background.${key}`} label={label} value={draft.background[key]} onChange={(value) => change((next) => { next.background[key] = value; }, `background.${key}`)} />
                ))}
            </div>
            <TextArea scat6={scat6} path="background.notes" label="Notes" value={draft.background.notes} max={2_000} optional onChange={(value) => change((next) => { next.background.notes = value; })} />
            <TextArea scat6={scat6} path="background.currentMedications" label="Current medications" value={draft.background.currentMedications} max={2_000} optional onChange={(value) => change((next) => { next.background.currentMedications = value; })} />
        </FormSection>
    );
}

function SymptomFields({ scat6 }: { scat6: Scat6Controller }) {
    const { draft, change } = scat6;
    const symptoms = draft.symptoms;
    const rated = symptoms.ratings.filter((rating) => rating.trim() !== "").length;
    const percent = symptoms.percentOfNormal.trim();
    const ratingsError = symptoms.ratings.map((_, index) => scat6.error(`symptoms.ratings.${index}`)).find(Boolean);
    return (
        <Part scat6={scat6} path="symptoms" title="Symptom evaluation" term="symptomEvaluation" description="The athlete rates each item 0–6, in form order.">
            <QuickFill label="No symptoms" icon={CheckCheck} available={canFillNoSymptoms(draft)} note={scat6.notes.symptoms} onClick={() => scat6.quick("symptoms", fillNoSymptoms, "symptoms")} />
            <fieldset className="flex flex-col gap-2" aria-invalid={ratingsError ? true : undefined}>
                <legend className="mb-1 text-sm font-medium text-fg">
                    Ratings by item{" "}
                    <span className="font-normal text-fg-subtle">
                        ({rated} of {symptoms.ratings.length} rated)
                    </span>
                </legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-8">
                    {symptoms.ratings.map((rating, index) => {
                        const path = `symptoms.ratings.${index}`;
                        const id = scat6.id(path);
                        return (
                            <div key={index} className="flex min-w-0 flex-col gap-1">
                                <label htmlFor={id} className="text-xs text-fg-muted">
                                    Item {index + 1}
                                </label>
                                <Select
                                    id={id}
                                    name={`scat6.${path}`}
                                    value={rating}
                                    onChange={(event) => change((next) => { next.symptoms.ratings[index] = event.target.value; }, path)}
                                    aria-invalid={scat6.error(path) ? true : undefined}
                                >
                                    <option value="">–</option>
                                    {numbered(SCAT6.SYMPTOM_MAX_RATING + 1).map((value) => (
                                        <option key={value} value={value}>
                                            {value}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        );
                    })}
                </div>
                <ErrorText message={ratingsError} />
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
                <YesNoField scat6={scat6} path="symptoms.worseWithPhysicalActivity" label="Worse with physical activity" value={symptoms.worseWithPhysicalActivity} onChange={(value) => change((next) => { next.symptoms.worseWithPhysicalActivity = value; }, "symptoms.worseWithPhysicalActivity")} />
                <YesNoField scat6={scat6} path="symptoms.worseWithMentalActivity" label="Worse with mental activity" value={symptoms.worseWithMentalActivity} onChange={(value) => change((next) => { next.symptoms.worseWithMentalActivity = value; }, "symptoms.worseWithMentalActivity")} />
            </div>
            <div className="flex flex-col gap-2">
                <NumberField
                    scat6={scat6}
                    path="symptoms.percentOfNormal"
                    label="Percent of normal"
                    info={<TermHint term="percentOfNormal" />}
                    value={symptoms.percentOfNormal}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(value) => change((next) => { next.symptoms.percentOfNormal = value; }, "symptoms.percentOfNormal")}
                />
                {percent === "" && (
                    <SuggestionChips label="Athlete said" suggestions={[{ label: "100%", value: "100" }]} onPick={(value) => change((next) => { next.symptoms.percentOfNormal = value; }, "symptoms.percentOfNormal")} />
                )}
            </div>
            {percent !== "" && percent !== "100" && (
                <TextArea scat6={scat6} path="symptoms.notNormalReason" label="Why not 100%" value={symptoms.notNormalReason} max={1_000} optional onChange={(value) => change((next) => { next.symptoms.notNormalReason = value; })} />
            )}
        </Part>
    );
}

/* ─── Step 2: memory and concentration ────────────────────────────────────── */

/** Orientation, immediate memory, digits backward and months in reverse. */
export function Scat6MemoryFields({ scat6 }: { scat6: Scat6Controller }) {
    const { draft, change } = scat6;
    const memory = draft.immediateMemory;
    const months = draft.monthsReverse;
    return (
        <>
            <Part scat6={scat6} path="orientation" title="Orientation" term="orientation">
                <Toggles scat6={scat6} path="orientation.answers" legend="Questions answered correctly" values={draft.orientation.answers} />
            </Part>

            <Part scat6={scat6} path="immediateMemory" title="Immediate memory" term="immediateMemory" description="Three trials of the same word list; tick each word recalled.">
                <ListChoice scat6={scat6} path="immediateMemory.wordList" value={memory.wordList} onChange={(value) => change((next) => { next.immediateMemory.wordList = value; }, "immediateMemory.wordList")} />
                {memory.trials.map((trial, trialIndex) => (
                    <Toggles key={trialIndex} scat6={scat6} path={`immediateMemory.trials.${trialIndex}`} legend={`Trial ${trialIndex + 1}: words recalled`} values={trial} itemLabel="Word" />
                ))}
                <StampedTime scat6={scat6} field="immediateMemory.lastTrialCompletedAt" label="Last trial completed" value={memory.lastTrialCompletedAt} hint="Delayed recall starts at least 5 minutes after this." />
            </Part>

            <Part
                scat6={scat6}
                path="digitsBackward"
                title="Digits backward"
                term="digitsBackward"
                description="Strings by length, shortest first. Trial 2 only after a wrong trial 1; the test ends when both trials of a length are wrong."
            >
                <ListChoice scat6={scat6} path="digitsBackward.digitList" value={draft.digitsBackward.digitList} onChange={(value) => change((next) => { next.digitsBackward.digitList = value; }, "digitsBackward.digitList")} />
                <DigitStrings scat6={scat6} />
            </Part>

            <Part scat6={scat6} path="monthsReverse" title="Months in reverse order" term="monthsReverse" description="Tick each response given correctly, in the form's order.">
                <Toggles scat6={scat6} path="monthsReverse.correctResponses" legend="Correct responses" values={months.correct} />
                <div className="grid grid-cols-1 gap-4 sm:max-w-md sm:grid-cols-2">
                    <NumberField scat6={scat6} path="monthsReverse.timeSeconds" label="Time" value={months.timeSeconds} min={0} max={3_600} step="0.1" suffix="s" onChange={(value) => change((next) => { next.monthsReverse.timeSeconds = value; }, "monthsReverse.timeSeconds")} />
                    <div className="flex flex-col gap-2">
                        <NumberField scat6={scat6} path="monthsReverse.errors" label="Errors" value={months.errors} min={0} max={SCAT6.MONTHS} onChange={(value) => change((next) => { next.monthsReverse.errors = value; }, "monthsReverse.errors")} />
                        {months.errors.trim() === "" && draft.marked["monthsReverse.correctResponses"] && months.correct.every(Boolean) && (
                            <SuggestionChips label="Quick pick" suggestions={[{ label: "No errors", value: "0" }]} onPick={(value) => change((next) => { next.monthsReverse.errors = value; }, "monthsReverse.errors")} />
                        )}
                    </div>
                </div>
            </Part>
        </>
    );
}

/* ─── Step 3: balance, delayed recall and the SCAT6 decision ──────────────── */

const SURFACES = [{ label: "Firm floor" }, { label: "Mat" }];
const FOOTWEAR = [{ label: "Barefoot" }, { label: "Shoes" }];

/** mBESS, tandem and dual-task gait, delayed recall and the doctor's reading of the SCAT6. */
export function Scat6BalanceFields({ scat6 }: { scat6: Scat6Controller }) {
    const { draft, change } = scat6;
    const dual = draft.dualTaskGait;
    const earliest = delayedRecallEarliest(draft);
    const pick = (field: "testingSurface" | "footwear", options: { label: string }[]) => (value: string) =>
        change((next) => {
            const current = next.mbess[field].trim();
            // A chip fills a blank field or switches between chips; it never replaces something typed.
            if (current === "" || options.some((option) => option.label === current)) next.mbess[field] = value;
        }, `mbess.${field}`);
    return (
        <>
            <Part scat6={scat6} path="mbess" title="Balance (mBESS)" term="mbess" description="Errors per 20-second stance. A stance not held for 5 seconds at the start scores the maximum.">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Foot tested" htmlFor={scat6.id("mbess.footTested")} error={scat6.error("mbess.footTested")} required hint="Usually the non-dominant foot.">
                        <Select
                            id={scat6.id("mbess.footTested")}
                            name="scat6.mbess.footTested"
                            value={draft.mbess.footTested}
                            onChange={(event) => change((next) => { next.mbess.footTested = event.target.value as Scat6Draft["mbess"]["footTested"]; }, "mbess.footTested")}
                        >
                            <option value="">Choose…</option>
                            <option value="LEFT">Left</option>
                            <option value="RIGHT">Right</option>
                        </Select>
                    </Field>
                    <div className="flex flex-col gap-2">
                        <Text scat6={scat6} path="mbess.testingSurface" label="Testing surface" value={draft.mbess.testingSurface} max={200} onChange={(value) => change((next) => { next.mbess.testingSurface = value; }, "mbess.testingSurface")} />
                        <SuggestionChips label="Quick pick" suggestions={SURFACES} onPick={pick("testingSurface", SURFACES)} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Text scat6={scat6} path="mbess.footwear" label="Footwear" value={draft.mbess.footwear} max={200} onChange={(value) => change((next) => { next.mbess.footwear = value; }, "mbess.footwear")} />
                        <SuggestionChips label="Quick pick" suggestions={FOOTWEAR} onPick={pick("footwear", FOOTWEAR)} />
                    </div>
                </div>
                <Stances scat6={scat6} surface="firm" stances={draft.mbess.firm} />
                <Checkbox
                    id={scat6.id("mbess.foam.performed")}
                    name="scat6.mbess.foam.performed"
                    checked={draft.mbess.foamPerformed}
                    onChange={(event) => change((next) => { next.mbess.foamPerformed = event.target.checked; })}
                    label="Also tested on foam"
                />
                {draft.mbess.foamPerformed && <Stances scat6={scat6} surface="foam" stances={draft.mbess.foam} />}
            </Part>

            <Part scat6={scat6} path="tandemGait" title="Timed tandem gait" term="tandemGait" description="Three trials. Tick “Stopped early” for a trial the athlete didn't complete.">
                <GaitTrials scat6={scat6} />
            </Part>

            <OptionalPart scat6={scat6} part="dualTaskGait" title="Dual-task gait" term="dualTaskGait" description="Optional. Needs all three tandem gait trials completed first." skipLabel="Not done at this baseline">
                <NumberField
                    scat6={scat6}
                    path="dualTaskGait.subtractionStep"
                    label="Subtraction step"
                    value={dual.subtractionStep}
                    min={1}
                    max={20}
                    hint="7 unless the practice couldn't be completed with 7s."
                    onChange={(value) => change((next) => { next.dualTaskGait.subtractionStep = value; })}
                />
                <Toggles scat6={scat6} path="dualTaskGait.practice.correctResponses" legend="Practice: correct responses" values={dual.practice.correct} />
                <div className="grid grid-cols-1 gap-4 sm:max-w-md sm:grid-cols-2">
                    <NumberField scat6={scat6} path="dualTaskGait.practice.errors" label="Practice errors" value={dual.practice.errors} min={0} max={100} onChange={(value) => change((next) => { next.dualTaskGait.practice.errors = value; })} />
                    <NumberField scat6={scat6} path="dualTaskGait.practice.timeSeconds" label="Practice time" value={dual.practice.timeSeconds} min={0} max={3_600} step="0.1" suffix="s" optional onChange={(value) => change((next) => { next.dualTaskGait.practice.timeSeconds = value; })} />
                </div>
                <ChoiceGroup
                    id={scat6.id("dualTaskGait.sequence.kind")}
                    name="scat6.dualTaskGait.sequence.kind"
                    legend="Trials used"
                    columns={2}
                    variant="compact"
                    options={[
                        { value: "PRINTED", label: "Printed sequences", description: "The three printed rows, counting down by 7." },
                        { value: "ALTERNATE", label: "Alternate row", description: "Another starting number or step." },
                    ]}
                    value={dual.kind}
                    onChange={(kind) => change((next) => { next.dualTaskGait.kind = kind; }, "dualTaskGait.sequence")}
                    error={scat6.error("dualTaskGait.sequence")}
                />
                {dual.kind === "PRINTED" ? <PrintedTrials scat6={scat6} /> : <AlternateTrial scat6={scat6} />}
            </OptionalPart>

            {anyGaitTrialIncomplete(draft) && (
                <FormSection title="Gait trials not completed">
                    <TextArea scat6={scat6} path="gaitIncompleteReason" label="Why a gait trial wasn't completed" value={draft.gaitIncompleteReason} max={1_000} onChange={(value) => change((next) => { next.gaitIncompleteReason = value; }, "gaitIncompleteReason")} />
                </FormSection>
            )}

            <Part scat6={scat6} path="delayedRecall" title="Delayed recall" term="delayedRecall" description="The immediate memory list again, at least 5 minutes after its last trial.">
                <StampedTime
                    scat6={scat6}
                    field="delayedRecall.startedAt"
                    label="Started"
                    value={draft.delayedRecall.startedAt}
                    hint={earliest ? `Can start from ${earliest.slice(11)} (5 minutes after the last memory trial).` : "Record when the last memory trial ended first."}
                />
                <Toggles scat6={scat6} path="delayedRecall.words" legend="Words recalled" values={draft.delayedRecall.words} itemLabel="Word" />
            </Part>

            <FormSection title="SCAT6 decision" description="Your overall reading of the SCAT6.">
                <ChoiceGroup
                    id={scat6.id("differentFromUsualSelf")}
                    name="scat6.differentFromUsualSelf"
                    legend="Different from their usual self?"
                    required
                    columns={3}
                    variant="compact"
                    options={[
                        { value: "NO", label: "No" },
                        { value: "YES", label: "Yes" },
                        { value: "NOT_APPLICABLE", label: "Not applicable" },
                    ]}
                    value={draft.differentFromUsualSelf}
                    onChange={(value) => change((next) => { next.differentFromUsualSelf = value; }, "differentFromUsualSelf")}
                    error={scat6.error("differentFromUsualSelf")}
                />
                <Field label="Concussion diagnosed" htmlFor={scat6.id("concussionDiagnosed")} error={scat6.error("concussionDiagnosed")} optional>
                    <Select
                        id={scat6.id("concussionDiagnosed")}
                        name="scat6.concussionDiagnosed"
                        value={draft.concussionDiagnosed}
                        onChange={(event) => change((next) => { next.concussionDiagnosed = event.target.value as Scat6Draft["concussionDiagnosed"]; })}
                        className="sm:w-56"
                    >
                        <option value="">Not recorded</option>
                        <option value="NO">No</option>
                        <option value="YES">Yes</option>
                        <option value="DEFERRED">Deferred</option>
                    </Select>
                </Field>
                <TextArea scat6={scat6} path="clinicalNotes" label="Clinical notes" value={draft.clinicalNotes} max={4_000} optional onChange={(value) => change((next) => { next.clinicalNotes = value; })} />
            </FormSection>
        </>
    );
}

/* ─── Parts ───────────────────────────────────────────────────────────────── */

type PartPath = "symptoms" | "orientation" | "immediateMemory" | "digitsBackward" | "monthsReverse" | "mbess" | "tandemGait" | "delayedRecall";

/** A part every baseline performs unless the doctor says otherwise, with the reason. */
function Part({ scat6, path, title, term, description, children }: { scat6: Scat6Controller; path: PartPath; title: string; term: GlossaryTerm; description?: ReactNode; children: ReactNode }) {
    const part = scat6.draft[path];
    const message = scat6.error(path);
    return (
        <FormSection title={title} info={<TermHint term={term} />} description={description}>
            <div data-invalid={message ? "true" : undefined} className="flex flex-col gap-1">
                <Checkbox
                    id={scat6.id(`${path}.performed`)}
                    name={`scat6.${path}.performed`}
                    checked={!part.performed}
                    onChange={(event) => scat6.change((next) => { next[path].performed = !event.target.checked; }, path)}
                    label="Not performed"
                />
                <ErrorText message={message} />
            </div>
            {part.performed ? (
                children
            ) : (
                <TextArea scat6={scat6} path={`${path}.reason`} label="Why it wasn't performed" value={part.reason} max={1_000} onChange={(value) => scat6.change((next) => { next[path].reason = value; }, `${path}.reason`)} />
            )}
        </FormSection>
    );
}

/** A part a baseline often skips: the doctor says whether it was performed, with a one-click "not performed" for the usual reason. */
function OptionalPart({
    scat6,
    part,
    title,
    term,
    description,
    skipLabel,
    children,
}: {
    scat6: Scat6Controller;
    part: "immediateAssessment" | "dualTaskGait";
    title: string;
    term: GlossaryTerm;
    description: string;
    skipLabel: string;
    children: ReactNode;
}) {
    const { performed, reason } = scat6.draft[part];
    const message = scat6.error(`${part}.performed`) ?? scat6.error(part);
    return (
        <FormSection title={title} info={<TermHint term={term} />} description={description}>
            <ChoiceGroup
                id={scat6.id(`${part}.performed`)}
                name={`scat6.${part}.performed`}
                legend="Performed at this visit?"
                required
                columns={2}
                variant="compact"
                options={[
                    { value: "YES", label: "Performed" },
                    { value: "NO", label: "Not performed" },
                ]}
                value={performed === null ? "" : performed ? "YES" : "NO"}
                onChange={(value) => scat6.change((next) => { next[part].performed = value === "YES"; }, part)}
                error={message}
            />
            <QuickFill label={skipLabel} icon={SkipForward} available={performed === null} note={scat6.notes[part]} onClick={() => scat6.quick(part, (draft) => skipPart(draft, part), part)} />
            {performed === false && (
                <TextArea scat6={scat6} path={`${part}.reason`} label="Why it wasn't performed" value={reason} max={1_000} onChange={(value) => scat6.change((next) => { next[part].reason = value; }, `${part}.reason`)} />
            )}
            {performed === true && children}
        </FormSection>
    );
}

function GcsRows({ scat6 }: { scat6: Scat6Controller }) {
    const rows = scat6.draft.immediateAssessment.gcs;
    const scale = (row: number, key: "eye" | "verbal" | "motor", label: string, max: number) => {
        const path = `immediateAssessment.glasgowComaScale.${row}.${key}`;
        const id = scat6.id(path);
        return (
            <div className="flex flex-col gap-1">
                <label htmlFor={id} className="text-xs text-fg-muted">
                    {label}
                </label>
                <Select
                    id={id}
                    name={`scat6.${path}`}
                    value={rows[row][key]}
                    onChange={(event) => scat6.change((next) => { next.immediateAssessment.gcs[row][key] = event.target.value; }, path)}
                    aria-invalid={scat6.error(path) ? true : undefined}
                >
                    <option value="">–</option>
                    {numbered(max).map((index) => (
                        <option key={index} value={index + 1}>
                            {index + 1}
                        </option>
                    ))}
                </Select>
                <ErrorText message={scat6.error(path)} />
            </div>
        );
    };
    return (
        <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 flex items-center gap-1.5 text-sm font-medium text-fg">
                Glasgow Coma Scale <TermHint term="gcs" />
            </legend>
            {rows.map((row, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,14rem)_repeat(3,5rem)_auto]">
                    <DateTime
                        scat6={scat6}
                        path={`immediateAssessment.glasgowComaScale.${index}.assessedAt`}
                        label={`Assessment ${index + 1}`}
                        value={row.assessedAt}
                        onChange={(value) => scat6.change((next) => { next.immediateAssessment.gcs[index].assessedAt = value; }, `immediateAssessment.glasgowComaScale.${index}.assessedAt`)}
                    />
                    {scale(index, "eye", "Eye", 4)}
                    {scale(index, "verbal", "Verbal", 5)}
                    {scale(index, "motor", "Motor", 6)}
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={rows.length === 1}
                        aria-label={`Remove assessment ${index + 1}`}
                        onClick={() => scat6.change((next) => { next.immediateAssessment.gcs.splice(index, 1); }, "immediateAssessment.glasgowComaScale")}
                    >
                        <X />
                    </Button>
                </div>
            ))}
            {rows.length < SCAT6.GCS_MAX_ASSESSMENTS && (
                <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    onClick={() => scat6.change((next) => { next.immediateAssessment.gcs.push({ assessedAt: "", eye: "", verbal: "", motor: "" }); })}
                >
                    <Plus aria-hidden />
                    Add assessment
                </Button>
            )}
        </fieldset>
    );
}

function DigitStrings({ scat6 }: { scat6: Scat6Controller }) {
    const strings = scat6.draft.digitsBackward.strings;
    const answer = (index: number, trial: "trial1" | "trial2", value: boolean) =>
        scat6.change((next) => {
            const entries = next.digitsBackward.strings;
            entries[index][trial] = value;
            if (trial === "trial1" && value) entries[index].trial2 = null;
            // A changed answer drops the lengths after it; the next one appears once this one is settled.
            entries.splice(index + 1);
            if (digitTestContinues(entries)) entries.push({ trial1: null, trial2: null });
        }, "digitsBackward.strings");
    return (
        <div className="flex flex-col gap-2">
            <ErrorText message={scat6.error("digitsBackward.strings")} />
            {strings.map((entry, index) => (
                <div key={index} className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border px-3 py-2.5">
                    <span className="w-28 text-sm font-medium text-fg">String length {index + 1}</span>
                    <YesNoField scat6={scat6} path={`digitsBackward.strings.${index}.trial1Correct`} label="Trial 1 correct" value={entry.trial1} inline onChange={(value) => answer(index, "trial1", value)} />
                    {entry.trial1 === false && (
                        <YesNoField scat6={scat6} path={`digitsBackward.strings.${index}.trial2Correct`} label="Trial 2 correct" value={entry.trial2} inline onChange={(value) => answer(index, "trial2", value)} />
                    )}
                </div>
            ))}
        </div>
    );
}

function Stances({ scat6, surface, stances }: { scat6: Scat6Controller; surface: "firm" | "foam"; stances: StancesDraft }) {
    const base = surface === "firm" ? "mbess.firm" : "mbess.foam.stances";
    return (
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-medium text-fg">{surface === "firm" ? "Firm surface" : "Foam surface"}</legend>
            {(
                [
                    ["doubleLeg", "Double leg"],
                    ["singleLeg", "Single leg"],
                    ["tandem", "Tandem"],
                ] as const
            ).map(([key, label]) => (
                <div key={key} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-fg">{label}</p>
                    {stances[key].held && (
                        <NumberField
                            scat6={scat6}
                            path={`${base}.${key}.errors`}
                            label="Errors"
                            value={stances[key].errors}
                            min={0}
                            max={SCAT6.MBESS_MAX_ERRORS}
                            onChange={(value) => scat6.change((next) => { next.mbess[surface][key].errors = value; }, `${base}.${key}.errors`)}
                        />
                    )}
                    <Checkbox
                        id={scat6.id(`${base}.${key}.unableToHoldFiveSeconds`)}
                        name={`scat6.${base}.${key}.unableToHoldFiveSeconds`}
                        checked={!stances[key].held}
                        onChange={(event) => scat6.change((next) => { next.mbess[surface][key].held = !event.target.checked; }, `${base}.${key}`)}
                        label="Couldn't hold for 5 seconds"
                        description={stances[key].held ? undefined : "Scores the maximum of 10 errors."}
                    />
                </div>
            ))}
        </fieldset>
    );
}

function GaitTrials({ scat6 }: { scat6: Scat6Controller }) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {scat6.draft.tandemGait.trials.map((trial, index) => (
                <div key={index} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-fg">Trial {index + 1}</p>
                    {trial.completed && (
                        <NumberField
                            scat6={scat6}
                            path={`tandemGait.trials.${index}.timeSeconds`}
                            label="Time"
                            value={trial.timeSeconds}
                            min={0}
                            max={3_600}
                            step="0.1"
                            suffix="s"
                            onChange={(value) => scat6.change((next) => { next.tandemGait.trials[index].timeSeconds = value; }, `tandemGait.trials.${index}.timeSeconds`)}
                        />
                    )}
                    <Checkbox
                        id={scat6.id(`tandemGait.trials.${index}.completed`)}
                        name={`scat6.tandemGait.trials.${index}.completed`}
                        checked={!trial.completed}
                        onChange={(event) => scat6.change((next) => { next.tandemGait.trials[index].completed = !event.target.checked; }, `tandemGait.trials.${index}`)}
                        label="Stopped early"
                    />
                </div>
            ))}
        </div>
    );
}

function PrintedTrials({ scat6 }: { scat6: Scat6Controller }) {
    return (
        <div className="flex flex-col gap-3">
            {scat6.draft.dualTaskGait.printed.map((trial, index) => {
                const path = `dualTaskGait.sequence.trials.${index}`;
                return (
                    <div key={index} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                        <p className="text-sm font-medium text-fg">Trial {index + 1}</p>
                        <Toggles scat6={scat6} path={`${path}.correctResponses`} legend="Correct responses" values={trial.correct} />
                        {trial.completed && (
                            <div className="grid grid-cols-1 gap-4 sm:max-w-md sm:grid-cols-2">
                                <NumberField scat6={scat6} path={`${path}.errors`} label="Errors" value={trial.errors} min={0} max={100} onChange={(value) => scat6.change((next) => { next.dualTaskGait.printed[index].errors = value; })} />
                                <NumberField
                                    scat6={scat6}
                                    path={`${path}.timeSeconds`}
                                    label="Time"
                                    value={trial.timeSeconds}
                                    min={0}
                                    max={3_600}
                                    step="0.1"
                                    suffix="s"
                                    onChange={(value) => scat6.change((next) => { next.dualTaskGait.printed[index].timeSeconds = value; })}
                                />
                            </div>
                        )}
                        <Checkbox
                            id={scat6.id(`${path}.completed`)}
                            name={`scat6.${path}.completed`}
                            checked={!trial.completed}
                            onChange={(event) => scat6.change((next) => { next.dualTaskGait.printed[index].completed = !event.target.checked; }, path)}
                            label="Stopped early"
                        />
                    </div>
                );
            })}
        </div>
    );
}

function AlternateTrial({ scat6 }: { scat6: Scat6Controller }) {
    const alternate = scat6.draft.dualTaskGait.alternate;
    const path = "dualTaskGait.sequence";
    return (
        <div className="flex flex-col gap-4 rounded-lg border border-border p-3">
            <NumberField scat6={scat6} path={`${path}.startingInteger`} label="Starting number" value={alternate.startingInteger} min={1} max={1_000} onChange={(value) => scat6.change((next) => { next.dualTaskGait.alternate.startingInteger = value; })} />
            <Text
                scat6={scat6}
                path={`${path}.responses`}
                label="Numbers said, in order"
                value={alternate.responses}
                max={400}
                optional
                hint="Separate them with commas or spaces, up to 30."
                onChange={(value) => scat6.change((next) => { next.dualTaskGait.alternate.responses = value; })}
            />
            {alternate.completed && (
                <div className="grid grid-cols-1 gap-4 sm:max-w-md sm:grid-cols-2">
                    <NumberField scat6={scat6} path={`${path}.trial.errors`} label="Errors" value={alternate.errors} min={0} max={100} onChange={(value) => scat6.change((next) => { next.dualTaskGait.alternate.errors = value; })} />
                    <NumberField scat6={scat6} path={`${path}.trial.timeSeconds`} label="Time" value={alternate.timeSeconds} min={0} max={3_600} step="0.1" suffix="s" onChange={(value) => scat6.change((next) => { next.dualTaskGait.alternate.timeSeconds = value; })} />
                </div>
            )}
            <Checkbox
                id={scat6.id(`${path}.trial.completed`)}
                name={`scat6.${path}.trial.completed`}
                checked={!alternate.completed}
                onChange={(event) => scat6.change((next) => { next.dualTaskGait.alternate.completed = !event.target.checked; }, `${path}.trial`)}
                label="Stopped early"
            />
        </div>
    );
}

/* ─── Controls ────────────────────────────────────────────────────────────── */

function ErrorText({ message }: { message?: string }) {
    return message ? <p className="text-[13px] font-medium text-danger-fg">{message}</p> : null;
}

/**
 * Numbered tick boxes for a row of the form (signs, questions, words, responses), in form order. Until the doctor
 * ticks an item or chooses all or none, the row reads "not marked" and isn't sent as "none ticked".
 */
function Toggles({ scat6, path, legend, values, itemLabel = "Item", term }: { scat6: Scat6Controller; path: string; legend: string; values: boolean[]; itemLabel?: string; term?: GlossaryTerm }) {
    const message = scat6.error(path);
    const marked = Boolean(scat6.draft.marked[path]);
    const rule = toggleRows(scat6.draft).find((candidate) => candidate.path === path);
    const ticked = values.filter(Boolean).length;
    return (
        <fieldset className="flex min-w-0 flex-col gap-1.5" aria-invalid={message ? true : undefined}>
            <legend className="mb-1 flex flex-wrap items-center gap-x-1.5 text-sm font-medium text-fg">
                {legend}
                {term && <TermHint term={term} />}
                <span className="font-normal text-fg-subtle">{marked ? `(${ticked} of ${values.length})` : "(not marked yet)"}</span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
                {values.map((checked, index) => (
                    <label
                        key={index}
                        className={cn(
                            "inline-flex h-8 min-w-11 cursor-pointer items-center justify-center rounded-md border px-2 text-[13px] font-medium tabular-nums transition-colors",
                            "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-ring",
                            checked ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border text-fg-muted hover:bg-surface-hover",
                        )}
                    >
                        <input
                            type="checkbox"
                            name={`scat6.${path}.${index}`}
                            checked={checked}
                            onChange={(event) => {
                                const value = event.target.checked;
                                scat6.change((next) => {
                                    const row = toggleValues(next, path);
                                    if (row) row[index] = value;
                                    next.marked[path] = true;
                                }, path);
                            }}
                            className="sr-only"
                            aria-label={`${itemLabel} ${index + 1}`}
                        />
                        {index + 1}
                    </label>
                ))}
            </div>
            {rule && !marked && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => scat6.quick(path, (draft) => fillToggleRow(draft, path, true), path)}>
                        <CheckCheck aria-hidden />
                        {rule.all}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => scat6.quick(path, (draft) => fillToggleRow(draft, path, false), path)}>
                        {rule.none}
                    </Button>
                </div>
            )}
            <p aria-live="polite" className="text-[13px] text-fg-muted">
                {marked ? scat6.notes[path] : null}
            </p>
            <ErrorText message={message} />
        </fieldset>
    );
}

/** A yes/no answer that starts unanswered. */
function YesNoField({ scat6, path, label, value, inline, onChange }: { scat6: Scat6Controller; path: string; label: string; value: YesNo; inline?: boolean; onChange: (value: boolean) => void }) {
    const message = scat6.error(path);
    const name = `scat6.${path}`;
    return (
        <fieldset
            role="radiogroup"
            aria-label={label}
            aria-required
            aria-invalid={message ? true : undefined}
            className={cn("flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1", !inline && "rounded-lg border px-3 py-2", !inline && (message ? "border-danger-border" : "border-border"))}
        >
            <span aria-hidden className={cn("text-[13px]", inline ? "text-fg-muted" : "min-w-0 flex-1 text-fg")}>
                {label}
            </span>
            <span className="flex items-center gap-3">
                {(
                    [
                        [true, "Yes"],
                        [false, "No"],
                    ] as const
                ).map(([option, text]) => (
                    <label key={text} className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
                        <input type="radio" name={name} required checked={value === option} onChange={() => onChange(option)} className="size-4 accent-[var(--primary)]" />
                        {text}
                    </label>
                ))}
            </span>
            {message && <p className="w-full text-[13px] font-medium text-danger-fg">{message}</p>}
        </fieldset>
    );
}

function ListChoice({ scat6, path, value, onChange }: { scat6: Scat6Controller; path: string; value: string; onChange: (value: "A" | "B" | "C") => void }) {
    return <ChoiceGroup id={scat6.id(path)} name={`scat6.${path}`} legend="List used" required columns={3} variant="compact" options={LIST_OPTIONS} value={value as "A" | "B" | "C" | ""} onChange={onChange} error={scat6.error(path)} />;
}

/** A time the doctor stamps with one click when the step happens, or types. A time already entered is never replaced. */
function StampedTime({ scat6, field, label, value, hint }: { scat6: Scat6Controller; field: "immediateMemory.lastTrialCompletedAt" | "delayedRecall.startedAt"; label: string; value: string; hint: string }) {
    const set = (next: Scat6Draft, time: string) => {
        if (field === "immediateMemory.lastTrialCompletedAt") next.immediateMemory.lastTrialCompletedAt = time;
        else next.delayedRecall.startedAt = time;
    };
    return (
        <div className="flex flex-col gap-2">
            <DateTime scat6={scat6} path={field} label={label} value={value} hint={hint} onChange={(time) => scat6.change((next) => set(next, time), field)} />
            <QuickFill
                label="Stamp now"
                icon={Clock}
                available={value === ""}
                note={value ? scat6.notes[field] : undefined}
                onClick={() => scat6.quick(field, (draft) => stampNow(draft, field, new Date()), field)}
            />
        </div>
    );
}

function Text({ scat6, path, label, value, max, optional, hint, onChange }: { scat6: Scat6Controller; path: string; label: string; value: string; max: number; optional?: boolean; hint?: string; onChange: (value: string) => void }) {
    const control = scat6.form.control(`scat6.${path}`, { required: !optional, hint });
    const message = scat6.error(path);
    return (
        <Field label={label} htmlFor={control.id} error={message} required={!optional} optional={optional} hint={hint}>
            <Input {...wired(control, message)} value={value} maxLength={max} onChange={(event) => onChange(event.target.value)} />
        </Field>
    );
}

function TextArea({ scat6, path, label, value, max, optional, onChange }: { scat6: Scat6Controller; path: string; label: string; value: string; max: number; optional?: boolean; onChange: (value: string) => void }) {
    const control = scat6.form.control(`scat6.${path}`, { required: !optional });
    const message = scat6.error(path);
    return (
        <Field label={label} htmlFor={control.id} error={message} required={!optional} optional={optional}>
            <Textarea {...wired(control, message)} rows={2} value={value} maxLength={max} onChange={(event) => onChange(event.target.value)} />
        </Field>
    );
}

function NumberField({
    scat6,
    path,
    label,
    value,
    min,
    max,
    step,
    suffix,
    hint,
    optional,
    info,
    onChange,
}: {
    scat6: Scat6Controller;
    path: string;
    label: string;
    value: string;
    min: number;
    max: number;
    step?: string;
    suffix?: string;
    hint?: string;
    optional?: boolean;
    info?: ReactNode;
    onChange: (value: string) => void;
}) {
    const control = scat6.form.control(`scat6.${path}`, { required: !optional, hint });
    const message = scat6.error(path);
    return (
        <Field label={label} htmlFor={control.id} error={message} required={!optional} optional={optional} hint={hint} info={info}>
            <Input
                {...wired(control, message)}
                type="number"
                inputMode="decimal"
                min={min}
                max={max}
                step={step ?? "1"}
                suffix={suffix}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="sm:w-36"
            />
        </Field>
    );
}

function DateTime({ scat6, path, label, value, hint, onChange }: { scat6: Scat6Controller; path: string; label: string; value: string; hint?: string; onChange: (value: string) => void }) {
    const control = scat6.form.control(`scat6.${path}`, { required: true, hint: true });
    const message = scat6.error(path);
    return (
        <Field label={label} htmlFor={control.id} error={message} required hint={hint ?? "Academy time (Ho Chi Minh City)"}>
            <Input {...wired(control, message)} type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="sm:w-64" />
        </Field>
    );
}

/** A control's wiring with the form's own problem shown like a server error. */
function wired(control: ActionFormControl, message: string | undefined): ActionFormControl {
    return { ...control, "aria-invalid": message ? true : undefined, "aria-describedby": message ? `${control.id}-error` : control["aria-describedby"] };
}
