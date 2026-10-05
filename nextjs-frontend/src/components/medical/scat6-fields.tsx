"use client";

import { Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Checkbox, Field, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import type { ActionForm } from "@/components/ui/use-action-form";
import { SCAT6, SCAT6_LISTS } from "@/lib/domain/scat6";
import { ageFromBirthDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { anyGaitTrialIncomplete, digitTestContinues, emptyScat6Draft, scat6FromDraft, type Scat6Draft, type StancesDraft } from "./scat6-draft";

type FormControls = Pick<ActionForm<unknown>, "error" | "control" | "markEdited">;

export interface Scat6FieldsProps {
    form: FormControls;
    /** YYYY-MM-DDTHH:mm in the academy timezone; also the latest time a field accepts. */
    nowInput: string;
    /** Only a baseline carries a SCAT6. While inactive the answers are kept but hidden and not sent. */
    active: boolean;
    /** The athlete's date of birth, when known: a SCAT6 is only administered from age 13. */
    dateOfBirth: string | null;
}

const LIST_OPTIONS = SCAT6_LISTS.map((value) => ({ value, label: `List ${value}` }));
const numbered = (count: number) => Array.from({ length: count }, (_, index) => index);

/**
 * The SCAT6 a baseline examination carries, entered item by item as numbered on the official paper form (the form's own
 * wording is never shown here). Each part can be marked as not performed with the reason; nothing is assumed normal.
 * The record travels as one serialized field and the medical service computes the scores.
 */
export function Scat6Fields({ form, nowInput, active, dateOfBirth }: Scat6FieldsProps) {
    /** Whether the athlete was under 13 on that day (datetime-local value), when the date of birth is known. */
    const underAgeOn = (value: string) => dateOfBirth !== null && value !== "" && ageFromBirthDate(dateOfBirth, value.slice(0, 10)) < SCAT6.MIN_AGE_YEARS;
    const tooYoung = underAgeOn(nowInput);
    const [draft, setDraft] = useState(() => ({ ...emptyScat6Draft(nowInput), ...(tooYoung ? { status: "NOT_ADMINISTERED" as const } : {}) }));
    /** Applies a change and hides the error of the field (or group) it touched. */
    const change = (edit: (next: Scat6Draft) => void, path?: string) => {
        setDraft((current) => {
            const next = structuredClone(current);
            edit(next);
            return next;
        });
        if (path) form.markEdited(`scat6.${path}`);
    };
    const error = (path: string) => form.error(`scat6.${path}`);
    const id = (path: string) => form.control(`scat6.${path}`).id;
    const kit: Kit = { draft, change, error, id, form, nowInput };

    return (
        <fieldset disabled={!active} hidden={!active} className="contents">
            <input type="hidden" name="scat6" value={JSON.stringify(scat6FromDraft(draft))} />
            <FormSection title="SCAT6" description="Record it by item number, reading the wording from the official paper form. The medical service calculates the scores.">
                <ChoiceGroup
                    id={id("status")}
                    name="scat6.status"
                    legend="SCAT6 at this baseline"
                    columns={2}
                    variant="compact"
                    options={[
                        { value: "ADMINISTERED", label: "Administered", description: tooYoung ? "Not before age 13: the athlete is younger." : "Athlete is 13 or older.", disabled: tooYoung },
                        { value: "NOT_ADMINISTERED", label: "Not administered", description: "e.g. under 13 or not clinically appropriate." },
                    ]}
                    value={draft.status}
                    onChange={(status) => change((next) => { next.status = status; })}
                />
                {draft.status === "NOT_ADMINISTERED" ? (
                    <TextArea kit={kit} path="reason" label="Why it wasn't administered" value={draft.notAdministeredReason} max={2_000} onChange={(value) => change((next) => { next.notAdministeredReason = value; }, "reason")} />
                ) : (
                    <>
                        <DateTime kit={kit} path="administeredAt" label="Administered" value={draft.administeredAt} onChange={(value) => change((next) => { next.administeredAt = value; }, "administeredAt")} />
                        {underAgeOn(draft.administeredAt) && <ErrorText message="The athlete was under 13 on that day. Record the SCAT6 as not administered." />}
                        <Checkbox
                            id={id("examinerAttestation")}
                            name="scat6.examinerAttestation"
                            checked={draft.examinerAttestation}
                            onChange={(event) => change((next) => { next.examinerAttestation = event.target.checked; })}
                            label="I'm a healthcare professional and administered or supervised this SCAT6"
                            aria-invalid={error("examinerAttestation") ? true : undefined}
                        />
                        <ErrorText message={error("examinerAttestation")} />
                    </>
                )}
            </FormSection>
            {draft.status === "ADMINISTERED" && <AdministeredSections kit={kit} />}
        </fieldset>
    );
}

interface Kit {
    draft: Scat6Draft;
    change: (edit: (next: Scat6Draft) => void, path?: string) => void;
    error: (path: string) => string | undefined;
    id: (path: string) => string;
    form: FormControls;
    nowInput: string;
}

function AdministeredSections({ kit }: { kit: Kit }) {
    const { draft, change } = kit;
    const ia = draft.immediateAssessment;
    const dual = draft.dualTaskGait;
    return (
        <>
            <FormSection title="Athlete" description="Background the form asks for before testing.">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Dominant hand" htmlFor={kit.id("athlete.dominantHand")} error={kit.error("athlete.dominantHand")} required>
                        <Select
                            id={kit.id("athlete.dominantHand")}
                            name="scat6.athlete.dominantHand"
                            value={draft.athlete.dominantHand}
                            onChange={(event) => change((next) => { next.athlete.dominantHand = event.target.value as Scat6Draft["athlete"]["dominantHand"]; })}
                        >
                            <option value="">Choose…</option>
                            <option value="LEFT">Left</option>
                            <option value="RIGHT">Right</option>
                            <option value="AMBIDEXTROUS">Ambidextrous</option>
                        </Select>
                    </Field>
                    <Text kit={kit} path="athlete.sportTeamSchool" label="Sport, team or school" value={draft.athlete.sportTeamSchool} max={200} optional onChange={(value) => change((next) => { next.athlete.sportTeamSchool = value; })} />
                    <Text kit={kit} path="athlete.currentSchoolYear" label="Current school year" value={draft.athlete.currentSchoolYear} max={50} optional onChange={(value) => change((next) => { next.athlete.currentSchoolYear = value; })} />
                    <NumberField kit={kit} path="athlete.yearsOfEducation" label="Years of education" value={draft.athlete.yearsOfEducation} min={0} max={40} optional onChange={(value) => change((next) => { next.athlete.yearsOfEducation = value; })} />
                    <Text kit={kit} path="athlete.firstLanguage" label="First language" value={draft.athlete.firstLanguage} max={100} optional onChange={(value) => change((next) => { next.athlete.firstLanguage = value; })} />
                    <Text kit={kit} path="athlete.preferredLanguage" label="Preferred language" value={draft.athlete.preferredLanguage} max={100} optional onChange={(value) => change((next) => { next.athlete.preferredLanguage = value; })} />
                </div>
            </FormSection>

            <FormSection title="Concussion history">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <NumberField
                        kit={kit}
                        path="concussionHistory.priorDiagnosedConcussions"
                        label="Diagnosed concussions before"
                        value={draft.concussionHistory.priorDiagnosedConcussions}
                        min={0}
                        max={100}
                        onChange={(value) => change((next) => { next.concussionHistory.priorDiagnosedConcussions = value; })}
                    />
                    <NumberField
                        kit={kit}
                        path="concussionHistory.mostRecentRecoveryDays"
                        label="Days to recover from the last one"
                        value={draft.concussionHistory.mostRecentRecoveryDays}
                        min={0}
                        max={3_650}
                        optional
                        onChange={(value) => change((next) => { next.concussionHistory.mostRecentRecoveryDays = value; })}
                    />
                    <Text kit={kit} path="concussionHistory.mostRecentConcussion" label="Most recent concussion" value={draft.concussionHistory.mostRecentConcussion} max={200} optional onChange={(value) => change((next) => { next.concussionHistory.mostRecentConcussion = value; })} />
                </div>
                <TextArea kit={kit} path="concussionHistory.primarySymptoms" label="Primary symptoms" value={draft.concussionHistory.primarySymptoms} max={1_000} optional onChange={(value) => change((next) => { next.concussionHistory.primarySymptoms = value; })} />
            </FormSection>

            <Part kit={kit} path="immediateAssessment" title="Immediate assessment" description="The on-field screen. Usually not performed at a baseline.">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Flag kit={kit} path="immediateAssessment.observableSigns.witnessed" label="Signs witnessed" checked={ia.witnessed} onChange={(value) => change((next) => { next.immediateAssessment.witnessed = value; })} />
                    <Flag kit={kit} path="immediateAssessment.observableSigns.observedOnVideo" label="Observed on video" checked={ia.observedOnVideo} onChange={(value) => change((next) => { next.immediateAssessment.observedOnVideo = value; })} />
                </div>
                <Toggles kit={kit} path="immediateAssessment.observableSigns.signs" legend="Observable signs present" values={ia.signs} onToggle={(index, value) => change((next) => { next.immediateAssessment.signs[index] = value; })} />
                <GcsRows kit={kit} />
                <div className="grid gap-3 sm:grid-cols-2">
                    <Flag kit={kit} path="immediateAssessment.cervicalSpine.neckPainAtRest" label="Neck pain at rest" checked={ia.neckPainAtRest} onChange={(value) => change((next) => { next.immediateAssessment.neckPainAtRest = value; })} />
                    <Flag kit={kit} path="immediateAssessment.cervicalSpine.tendernessToPalpation" label="Tenderness to palpation" checked={ia.tendernessToPalpation} onChange={(value) => change((next) => { next.immediateAssessment.tendernessToPalpation = value; })} />
                    {!ia.neckPainAtRest && !ia.tendernessToPalpation && (
                        <Flag
                            kit={kit}
                            path="immediateAssessment.cervicalSpine.fullActiveRangeOfMotion"
                            label="Full active range of motion"
                            checked={ia.fullActiveRangeOfMotion}
                            onChange={(value) => change((next) => { next.immediateAssessment.fullActiveRangeOfMotion = value; })}
                        />
                    )}
                    <Flag
                        kit={kit}
                        path="immediateAssessment.cervicalSpine.limbStrengthAndSensationNormal"
                        label="Limb strength and sensation normal"
                        checked={ia.limbStrengthAndSensationNormal}
                        onChange={(value) => change((next) => { next.immediateAssessment.limbStrengthAndSensationNormal = value; })}
                    />
                    <Flag kit={kit} path="immediateAssessment.coordinationOcularMotor.fingerToNoseNormal" label="Finger-to-nose normal" checked={ia.fingerToNoseNormal} onChange={(value) => change((next) => { next.immediateAssessment.fingerToNoseNormal = value; })} />
                    <Flag
                        kit={kit}
                        path="immediateAssessment.coordinationOcularMotor.ocularMotorWithoutDoubleVision"
                        label="No double vision"
                        checked={ia.ocularMotorWithoutDoubleVision}
                        onChange={(value) => change((next) => { next.immediateAssessment.ocularMotorWithoutDoubleVision = value; })}
                    />
                    <Flag
                        kit={kit}
                        path="immediateAssessment.coordinationOcularMotor.extraocularMovementsNormal"
                        label="Extraocular movements normal"
                        checked={ia.extraocularMovementsNormal}
                        onChange={(value) => change((next) => { next.immediateAssessment.extraocularMovementsNormal = value; })}
                    />
                </div>
                {!ia.extraocularMovementsNormal && (
                    <TextArea
                        kit={kit}
                        path="immediateAssessment.coordinationOcularMotor.extraocularDescription"
                        label="Describe the extraocular movements"
                        value={ia.extraocularDescription}
                        max={1_000}
                        onChange={(value) => change((next) => { next.immediateAssessment.extraocularDescription = value; }, "immediateAssessment.coordinationOcularMotor.extraocularDescription")}
                    />
                )}
                <Toggles kit={kit} path="immediateAssessment.maddocks" legend="Maddocks questions answered correctly" values={ia.maddocks} onToggle={(index, value) => change((next) => { next.immediateAssessment.maddocks[index] = value; })} />
            </Part>

            <FormSection title="Background" description="Conditions that can affect the results.">
                <div className="grid gap-3 sm:grid-cols-2">
                    {(
                        [
                            ["hospitalisedForHeadInjury", "Hospitalised for a head injury"],
                            ["headacheDisorderOrMigraine", "Headache disorder or migraine"],
                            ["learningDisabilityOrDyslexia", "Learning disability or dyslexia"],
                            ["adhd", "ADHD"],
                            ["depressionAnxietyOrOtherPsychological", "Depression, anxiety or other psychological disorder"],
                        ] as const
                    ).map(([key, label]) => (
                        <Flag key={key} kit={kit} path={`background.${key}`} label={label} checked={draft.background[key]} onChange={(value) => change((next) => { next.background[key] = value; })} />
                    ))}
                </div>
                <TextArea kit={kit} path="background.notes" label="Notes" value={draft.background.notes} max={2_000} optional onChange={(value) => change((next) => { next.background.notes = value; })} />
                <TextArea kit={kit} path="background.currentMedications" label="Current medications" value={draft.background.currentMedications} max={2_000} optional onChange={(value) => change((next) => { next.background.currentMedications = value; })} />
            </FormSection>

            <Part kit={kit} path="symptoms" title="Symptoms" description="The athlete rates each item 0–6, in form order.">
                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm font-medium text-fg">Ratings by item</legend>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-8">
                        {draft.symptoms.ratings.map((rating, index) => (
                            <label key={index} className="flex flex-col gap-1 text-xs text-fg-muted">
                                Item {index + 1}
                                <Select
                                    id={kit.id(`symptoms.ratings.${index}`)}
                                    name={`scat6.symptoms.ratings.${index}`}
                                    value={rating}
                                    onChange={(event) => change((next) => { next.symptoms.ratings[index] = event.target.value; })}
                                    aria-invalid={kit.error(`symptoms.ratings.${index}`) ? true : undefined}
                                >
                                    {numbered(SCAT6.SYMPTOM_MAX_RATING + 1).map((value) => (
                                        <option key={value} value={value}>
                                            {value}
                                        </option>
                                    ))}
                                </Select>
                            </label>
                        ))}
                    </div>
                </fieldset>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Flag kit={kit} path="symptoms.worseWithPhysicalActivity" label="Worse with physical activity" checked={draft.symptoms.worseWithPhysicalActivity} onChange={(value) => change((next) => { next.symptoms.worseWithPhysicalActivity = value; })} />
                    <Flag kit={kit} path="symptoms.worseWithMentalActivity" label="Worse with mental activity" checked={draft.symptoms.worseWithMentalActivity} onChange={(value) => change((next) => { next.symptoms.worseWithMentalActivity = value; })} />
                </div>
                <NumberField kit={kit} path="symptoms.percentOfNormal" label="Percent of normal" value={draft.symptoms.percentOfNormal} min={0} max={100} suffix="%" onChange={(value) => change((next) => { next.symptoms.percentOfNormal = value; })} />
                {draft.symptoms.percentOfNormal.trim() !== "100" && (
                    <TextArea kit={kit} path="symptoms.notNormalReason" label="Why not 100%" value={draft.symptoms.notNormalReason} max={1_000} optional onChange={(value) => change((next) => { next.symptoms.notNormalReason = value; })} />
                )}
            </Part>

            <Part kit={kit} path="orientation" title="Orientation">
                <Toggles kit={kit} path="orientation.answers" legend="Questions answered correctly" values={draft.orientation.answers} onToggle={(index, value) => change((next) => { next.orientation.answers[index] = value; })} />
            </Part>

            <Part kit={kit} path="immediateMemory" title="Immediate memory" description="Three trials of the same word list; tick each word recalled.">
                <ListChoice kit={kit} path="immediateMemory.wordList" value={draft.immediateMemory.wordList} onChange={(value) => change((next) => { next.immediateMemory.wordList = value; }, "immediateMemory.wordList")} />
                {draft.immediateMemory.trials.map((trial, trialIndex) => (
                    <Toggles
                        key={trialIndex}
                        kit={kit}
                        path={`immediateMemory.trials.${trialIndex}`}
                        legend={`Trial ${trialIndex + 1}: words recalled`}
                        values={trial}
                        itemLabel="Word"
                        onToggle={(index, value) => change((next) => { next.immediateMemory.trials[trialIndex][index] = value; })}
                    />
                ))}
                <DateTime
                    kit={kit}
                    path="immediateMemory.lastTrialCompletedAt"
                    label="Last trial completed"
                    value={draft.immediateMemory.lastTrialCompletedAt}
                    onChange={(value) => change((next) => { next.immediateMemory.lastTrialCompletedAt = value; }, "immediateMemory.lastTrialCompletedAt")}
                />
            </Part>

            <Part kit={kit} path="digitsBackward" title="Digits backward" description="Strings by length, shortest first. Trial 2 only after a wrong trial 1; the test ends when both trials of a length are wrong.">
                <ListChoice kit={kit} path="digitsBackward.digitList" value={draft.digitsBackward.digitList} onChange={(value) => change((next) => { next.digitsBackward.digitList = value; }, "digitsBackward.digitList")} />
                <DigitStrings kit={kit} />
            </Part>

            <Part kit={kit} path="monthsReverse" title="Months in reverse order" description="Tick each response given correctly, in the form's order.">
                <Toggles kit={kit} path="monthsReverse.correctResponses" legend="Correct responses" values={draft.monthsReverse.correct} onToggle={(index, value) => change((next) => { next.monthsReverse.correct[index] = value; })} />
                <div className="grid grid-cols-2 gap-4 sm:max-w-md">
                    <NumberField kit={kit} path="monthsReverse.timeSeconds" label="Time" value={draft.monthsReverse.timeSeconds} min={0} max={3_600} step="0.1" suffix="s" onChange={(value) => change((next) => { next.monthsReverse.timeSeconds = value; })} />
                    <NumberField kit={kit} path="monthsReverse.errors" label="Errors" value={draft.monthsReverse.errors} min={0} max={SCAT6.MONTHS} onChange={(value) => change((next) => { next.monthsReverse.errors = value; })} />
                </div>
            </Part>

            <Part kit={kit} path="mbess" title="Balance (mBESS)" description="Errors per 20-second stance. A stance not held for 5 seconds at the start scores the maximum.">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Foot tested" htmlFor={kit.id("mbess.footTested")} error={kit.error("mbess.footTested")} required>
                        <Select
                            id={kit.id("mbess.footTested")}
                            name="scat6.mbess.footTested"
                            value={draft.mbess.footTested}
                            onChange={(event) => change((next) => { next.mbess.footTested = event.target.value as Scat6Draft["mbess"]["footTested"]; })}
                        >
                            <option value="">Choose…</option>
                            <option value="LEFT">Left</option>
                            <option value="RIGHT">Right</option>
                        </Select>
                    </Field>
                    <Text kit={kit} path="mbess.testingSurface" label="Testing surface" value={draft.mbess.testingSurface} max={200} onChange={(value) => change((next) => { next.mbess.testingSurface = value; })} />
                    <Text kit={kit} path="mbess.footwear" label="Footwear" value={draft.mbess.footwear} max={200} onChange={(value) => change((next) => { next.mbess.footwear = value; })} />
                </div>
                <Stances kit={kit} surface="firm" stances={draft.mbess.firm} />
                <Checkbox
                    id={kit.id("mbess.foam.performed")}
                    name="scat6.mbess.foam.performed"
                    checked={draft.mbess.foamPerformed}
                    onChange={(event) => change((next) => { next.mbess.foamPerformed = event.target.checked; })}
                    label="Also tested on foam"
                />
                {draft.mbess.foamPerformed && <Stances kit={kit} surface="foam" stances={draft.mbess.foam} />}
            </Part>

            <Part kit={kit} path="tandemGait" title="Timed tandem gait" description="Three trials. Untick a trial the athlete didn't complete.">
                <GaitTrials kit={kit} />
            </Part>

            <Part kit={kit} path="dualTaskGait" title="Dual-task gait" description="Optional. Needs all three tandem gait trials completed first.">
                <NumberField
                    kit={kit}
                    path="dualTaskGait.subtractionStep"
                    label="Subtraction step"
                    value={dual.subtractionStep}
                    min={1}
                    max={20}
                    hint="7 unless the practice couldn't be completed with 7s."
                    onChange={(value) => change((next) => { next.dualTaskGait.subtractionStep = value; })}
                />
                <Toggles kit={kit} path="dualTaskGait.practice.correctResponses" legend="Practice: correct responses" values={dual.practice.correct} onToggle={(index, value) => change((next) => { next.dualTaskGait.practice.correct[index] = value; })} />
                <div className="grid grid-cols-2 gap-4 sm:max-w-md">
                    <NumberField kit={kit} path="dualTaskGait.practice.errors" label="Practice errors" value={dual.practice.errors} min={0} max={100} onChange={(value) => change((next) => { next.dualTaskGait.practice.errors = value; })} />
                    <NumberField kit={kit} path="dualTaskGait.practice.timeSeconds" label="Practice time" value={dual.practice.timeSeconds} min={0} max={3_600} step="0.1" suffix="s" optional onChange={(value) => change((next) => { next.dualTaskGait.practice.timeSeconds = value; })} />
                </div>
                <ChoiceGroup
                    id={kit.id("dualTaskGait.sequence.kind")}
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
                    error={kit.error("dualTaskGait.sequence")}
                />
                {dual.kind === "PRINTED" ? <PrintedTrials kit={kit} /> : <AlternateTrial kit={kit} />}
            </Part>

            {anyGaitTrialIncomplete(draft) && (
                <FormSection title="Gait trials not completed">
                    <TextArea kit={kit} path="gaitIncompleteReason" label="Why a gait trial wasn't completed" value={draft.gaitIncompleteReason} max={1_000} onChange={(value) => change((next) => { next.gaitIncompleteReason = value; }, "gaitIncompleteReason")} />
                </FormSection>
            )}

            <Part kit={kit} path="delayedRecall" title="Delayed recall" description="The Immediate Memory list, at least 5 minutes after its last trial.">
                <DateTime kit={kit} path="delayedRecall.startedAt" label="Started" value={draft.delayedRecall.startedAt} onChange={(value) => change((next) => { next.delayedRecall.startedAt = value; }, "delayedRecall.startedAt")} />
                <Toggles kit={kit} path="delayedRecall.words" legend="Words recalled" values={draft.delayedRecall.words} itemLabel="Word" onToggle={(index, value) => change((next) => { next.delayedRecall.words[index] = value; })} />
            </Part>

            <FormSection title="Decision" description="Your overall reading of the SCAT6.">
                <ChoiceGroup
                    id={kit.id("differentFromUsualSelf")}
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
                    error={kit.error("differentFromUsualSelf")}
                />
                <Field label="Concussion diagnosed" htmlFor={kit.id("concussionDiagnosed")} error={kit.error("concussionDiagnosed")} optional>
                    <Select
                        id={kit.id("concussionDiagnosed")}
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
                <TextArea kit={kit} path="clinicalNotes" label="Clinical notes" value={draft.clinicalNotes} max={4_000} optional onChange={(value) => change((next) => { next.clinicalNotes = value; })} />
            </FormSection>
        </>
    );
}

/* ─── Parts ───────────────────────────────────────────────────────────────── */

type PartPath = "immediateAssessment" | "symptoms" | "orientation" | "immediateMemory" | "digitsBackward" | "monthsReverse" | "mbess" | "tandemGait" | "dualTaskGait" | "delayedRecall";

/** A part of the test, performed with its answers or not performed with the reason. */
function Part({ kit, path, title, description, children }: { kit: Kit; path: PartPath; title: string; description?: ReactNode; children: ReactNode }) {
    const part = kit.draft[path];
    return (
        <FormSection title={title} description={description}>
            <Checkbox
                id={kit.id(`${path}.performed`)}
                name={`scat6.${path}.performed`}
                checked={part.performed}
                onChange={(event) => kit.change((next) => { next[path].performed = event.target.checked; }, path)}
                label="Performed"
            />
            <ErrorText message={kit.error(path)} />
            {part.performed ? (
                children
            ) : (
                <TextArea kit={kit} path={`${path}.reason`} label="Why it wasn't performed" value={part.reason} max={1_000} onChange={(value) => kit.change((next) => { next[path].reason = value; }, `${path}.reason`)} />
            )}
        </FormSection>
    );
}

function GcsRows({ kit }: { kit: Kit }) {
    const rows = kit.draft.immediateAssessment.gcs;
    const scale = (row: number, key: "eye" | "verbal" | "motor", label: string, max: number) => {
        const path = `immediateAssessment.glasgowComaScale.${row}.${key}`;
        return (
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
                {label}
                <Select
                    id={kit.id(path)}
                    name={`scat6.${path}`}
                    value={rows[row][key]}
                    onChange={(event) => kit.change((next) => { next.immediateAssessment.gcs[row][key] = event.target.value; })}
                    aria-invalid={kit.error(path) ? true : undefined}
                >
                    <option value="">–</option>
                    {numbered(max).map((index) => (
                        <option key={index} value={index + 1}>
                            {index + 1}
                        </option>
                    ))}
                </Select>
                <ErrorText message={kit.error(path)} />
            </label>
        );
    };
    return (
        <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-medium text-fg">Glasgow Coma Scale</legend>
            {rows.map((row, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,14rem)_repeat(3,5rem)_auto]">
                    <DateTime
                        kit={kit}
                        path={`immediateAssessment.glasgowComaScale.${index}.assessedAt`}
                        label={`Assessment ${index + 1}`}
                        value={row.assessedAt}
                        onChange={(value) => kit.change((next) => { next.immediateAssessment.gcs[index].assessedAt = value; })}
                    />
                    {scale(index, "eye", "Eye", 4)}
                    {scale(index, "verbal", "Verbal", 5)}
                    {scale(index, "motor", "Motor", 6)}
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={rows.length === 1}
                        aria-label={`Remove assessment ${index + 1}`}
                        onClick={() => kit.change((next) => { next.immediateAssessment.gcs.splice(index, 1); }, "immediateAssessment.glasgowComaScale")}
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
                    onClick={() => kit.change((next) => { next.immediateAssessment.gcs.push({ assessedAt: kit.nowInput, eye: "", verbal: "", motor: "" }); })}
                >
                    <Plus aria-hidden />
                    Add assessment
                </Button>
            )}
        </fieldset>
    );
}

function DigitStrings({ kit }: { kit: Kit }) {
    const strings = kit.draft.digitsBackward.strings;
    const answer = (index: number, trial: "trial1" | "trial2", value: boolean) =>
        kit.change((next) => {
            const entries = next.digitsBackward.strings;
            entries[index][trial] = value;
            if (trial === "trial1" && value) entries[index].trial2 = null;
            // A changed answer drops the lengths after it; the next one appears once this one is settled.
            entries.splice(index + 1);
            if (digitTestContinues(entries)) entries.push({ trial1: null, trial2: null });
        }, "digitsBackward.strings");
    return (
        <div className="flex flex-col gap-2">
            <ErrorText message={kit.error("digitsBackward.strings")} />
            {strings.map((entry, index) => (
                <div key={index} className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border px-3 py-2.5">
                    <span className="w-28 text-sm font-medium text-fg">String length {index + 1}</span>
                    <YesNo kit={kit} path={`digitsBackward.strings.${index}.trial1Correct`} label="Trial 1 correct" value={entry.trial1} onChange={(value) => answer(index, "trial1", value)} />
                    {entry.trial1 === false && (
                        <YesNo kit={kit} path={`digitsBackward.strings.${index}.trial2Correct`} label="Trial 2 correct" value={entry.trial2} onChange={(value) => answer(index, "trial2", value)} />
                    )}
                </div>
            ))}
        </div>
    );
}

function Stances({ kit, surface, stances }: { kit: Kit; surface: "firm" | "foam"; stances: StancesDraft }) {
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
                    <Checkbox
                        id={kit.id(`${base}.${key}.held`)}
                        name={`scat6.${base}.${key}.held`}
                        checked={stances[key].held}
                        onChange={(event) => kit.change((next) => { next.mbess[surface][key].held = event.target.checked; })}
                        label="Held for 5 seconds"
                    />
                    {stances[key].held && (
                        <NumberField kit={kit} path={`${base}.${key}.errors`} label="Errors" value={stances[key].errors} min={0} max={SCAT6.MBESS_MAX_ERRORS} onChange={(value) => kit.change((next) => { next.mbess[surface][key].errors = value; })} />
                    )}
                </div>
            ))}
        </fieldset>
    );
}

function GaitTrials({ kit }: { kit: Kit }) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {kit.draft.tandemGait.trials.map((trial, index) => (
                <div key={index} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <Checkbox
                        id={kit.id(`tandemGait.trials.${index}.completed`)}
                        name={`scat6.tandemGait.trials.${index}.completed`}
                        checked={trial.completed}
                        onChange={(event) => kit.change((next) => { next.tandemGait.trials[index].completed = event.target.checked; })}
                        label={`Trial ${index + 1} completed`}
                    />
                    {trial.completed && (
                        <NumberField
                            kit={kit}
                            path={`tandemGait.trials.${index}.timeSeconds`}
                            label="Time"
                            value={trial.timeSeconds}
                            min={0}
                            max={3_600}
                            step="0.1"
                            suffix="s"
                            onChange={(value) => kit.change((next) => { next.tandemGait.trials[index].timeSeconds = value; })}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

function PrintedTrials({ kit }: { kit: Kit }) {
    return (
        <div className="flex flex-col gap-3">
            {kit.draft.dualTaskGait.printed.map((trial, index) => {
                const path = `dualTaskGait.sequence.trials.${index}`;
                return (
                    <div key={index} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                        <Checkbox
                            id={kit.id(`${path}.completed`)}
                            name={`scat6.${path}.completed`}
                            checked={trial.completed}
                            onChange={(event) => kit.change((next) => { next.dualTaskGait.printed[index].completed = event.target.checked; })}
                            label={`Trial ${index + 1} completed`}
                        />
                        <Toggles kit={kit} path={`${path}.correctResponses`} legend="Correct responses" values={trial.correct} onToggle={(item, value) => kit.change((next) => { next.dualTaskGait.printed[index].correct[item] = value; })} />
                        {trial.completed && (
                            <div className="grid grid-cols-2 gap-4 sm:max-w-md">
                                <NumberField kit={kit} path={`${path}.errors`} label="Errors" value={trial.errors} min={0} max={100} onChange={(value) => kit.change((next) => { next.dualTaskGait.printed[index].errors = value; })} />
                                <NumberField
                                    kit={kit}
                                    path={`${path}.timeSeconds`}
                                    label="Time"
                                    value={trial.timeSeconds}
                                    min={0}
                                    max={3_600}
                                    step="0.1"
                                    suffix="s"
                                    onChange={(value) => kit.change((next) => { next.dualTaskGait.printed[index].timeSeconds = value; })}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function AlternateTrial({ kit }: { kit: Kit }) {
    const alternate = kit.draft.dualTaskGait.alternate;
    const path = "dualTaskGait.sequence";
    return (
        <div className="flex flex-col gap-4 rounded-lg border border-border p-3">
            <NumberField kit={kit} path={`${path}.startingInteger`} label="Starting number" value={alternate.startingInteger} min={1} max={1_000} onChange={(value) => kit.change((next) => { next.dualTaskGait.alternate.startingInteger = value; })} />
            <Text
                kit={kit}
                path={`${path}.responses`}
                label="Numbers said, in order"
                value={alternate.responses}
                max={400}
                optional
                hint="Separate them with commas or spaces, up to 30."
                onChange={(value) => kit.change((next) => { next.dualTaskGait.alternate.responses = value; })}
            />
            <Checkbox
                id={kit.id(`${path}.trial.completed`)}
                name={`scat6.${path}.trial.completed`}
                checked={alternate.completed}
                onChange={(event) => kit.change((next) => { next.dualTaskGait.alternate.completed = event.target.checked; })}
                label="Trial completed"
            />
            {alternate.completed && (
                <div className="grid grid-cols-2 gap-4 sm:max-w-md">
                    <NumberField kit={kit} path={`${path}.trial.errors`} label="Errors" value={alternate.errors} min={0} max={100} onChange={(value) => kit.change((next) => { next.dualTaskGait.alternate.errors = value; })} />
                    <NumberField kit={kit} path={`${path}.trial.timeSeconds`} label="Time" value={alternate.timeSeconds} min={0} max={3_600} step="0.1" suffix="s" onChange={(value) => kit.change((next) => { next.dualTaskGait.alternate.timeSeconds = value; })} />
                </div>
            )}
        </div>
    );
}

/* ─── Controls ────────────────────────────────────────────────────────────── */

function ErrorText({ message }: { message?: string }) {
    return message ? <p className="text-[13px] font-medium text-danger-fg">{message}</p> : null;
}

/** Numbered tick boxes for a row of the form (signs, questions, words, responses), in form order. */
function Toggles({ kit, path, legend, values, itemLabel = "Item", onToggle }: { kit: Kit; path: string; legend: string; values: boolean[]; itemLabel?: string; onToggle: (index: number, value: boolean) => void }) {
    const message = kit.error(path);
    return (
        <fieldset className="flex flex-col gap-1.5" aria-invalid={message ? true : undefined}>
            <legend className="mb-1 text-sm font-medium text-fg">
                {legend} <span className="font-normal text-fg-subtle">({values.filter(Boolean).length} of {values.length})</span>
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
                        <input type="checkbox" name={`scat6.${path}.${index}`} checked={checked} onChange={(event) => onToggle(index, event.target.checked)} className="sr-only" aria-label={`${itemLabel} ${index + 1}`} />
                        {index + 1}
                    </label>
                ))}
            </div>
            <ErrorText message={message} />
        </fieldset>
    );
}

function Flag({ kit, path, label, checked, onChange }: { kit: Kit; path: string; label: string; checked: boolean; onChange: (value: boolean) => void }) {
    return <Checkbox id={kit.id(path)} name={`scat6.${path}`} checked={checked} onChange={(event) => onChange(event.target.checked)} label={label} />;
}

function YesNo({ kit, path, label, value, onChange }: { kit: Kit; path: string; label: string; value: boolean | null; onChange: (value: boolean) => void }) {
    const message = kit.error(path);
    return (
        <fieldset className="flex items-center gap-3" aria-invalid={message ? true : undefined}>
            <legend className="sr-only">{label}</legend>
            <span aria-hidden className="text-[13px] text-fg-muted">
                {label}
            </span>
            {(
                [
                    [true, "Yes"],
                    [false, "No"],
                ] as const
            ).map(([option, text]) => (
                <label key={text} className="inline-flex items-center gap-1.5 text-sm">
                    <input type="radio" name={`scat6.${path}`} checked={value === option} onChange={() => onChange(option)} className="accent-[var(--primary)]" />
                    {text}
                </label>
            ))}
            <ErrorText message={message} />
        </fieldset>
    );
}

function ListChoice({ kit, path, value, onChange }: { kit: Kit; path: string; value: string; onChange: (value: "A" | "B" | "C") => void }) {
    return <ChoiceGroup id={kit.id(path)} name={`scat6.${path}`} legend="List used" required columns={3} variant="compact" options={LIST_OPTIONS} value={value as "A" | "B" | "C" | ""} onChange={onChange} error={kit.error(path)} />;
}

function Text({ kit, path, label, value, max, optional, hint, onChange }: { kit: Kit; path: string; label: string; value: string; max: number; optional?: boolean; hint?: string; onChange: (value: string) => void }) {
    const control = kit.form.control(`scat6.${path}`, { required: !optional, hint });
    return (
        <Field label={label} htmlFor={control.id} error={kit.error(path)} required={!optional} optional={optional} hint={hint}>
            <Input {...control} value={value} maxLength={max} onChange={(event) => onChange(event.target.value)} />
        </Field>
    );
}

function TextArea({ kit, path, label, value, max, optional, onChange }: { kit: Kit; path: string; label: string; value: string; max: number; optional?: boolean; onChange: (value: string) => void }) {
    const control = kit.form.control(`scat6.${path}`, { required: !optional });
    return (
        <Field label={label} htmlFor={control.id} error={kit.error(path)} required={!optional} optional={optional}>
            <Textarea {...control} rows={2} value={value} maxLength={max} onChange={(event) => onChange(event.target.value)} />
        </Field>
    );
}

function NumberField({
    kit,
    path,
    label,
    value,
    min,
    max,
    step,
    suffix,
    hint,
    optional,
    onChange,
}: {
    kit: Kit;
    path: string;
    label: string;
    value: string;
    min: number;
    max: number;
    step?: string;
    suffix?: string;
    hint?: string;
    optional?: boolean;
    onChange: (value: string) => void;
}) {
    const control = kit.form.control(`scat6.${path}`, { required: !optional, hint });
    return (
        <Field label={label} htmlFor={control.id} error={kit.error(path)} required={!optional} optional={optional} hint={hint}>
            <Input {...control} type="number" inputMode="decimal" min={min} max={max} step={step ?? "1"} suffix={suffix} value={value} onChange={(event) => onChange(event.target.value)} className="sm:w-36" />
        </Field>
    );
}

function DateTime({ kit, path, label, value, onChange }: { kit: Kit; path: string; label: string; value: string; onChange: (value: string) => void }) {
    const control = kit.form.control(`scat6.${path}`, { required: true });
    return (
        <Field label={label} htmlFor={control.id} error={kit.error(path)} required hint="Academy time (Ho Chi Minh City)">
            <Input {...control} type="datetime-local" max={kit.nowInput} value={value} onChange={(event) => onChange(event.target.value)} className="sm:w-64" />
        </Field>
    );
}
