"use client";

import { ArrowRight, Info, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useT } from "@/components/i18n/locale-provider";
import { ClearanceCard } from "@/components/domain/clearance-card";
import type { FighterIdentityData } from "@/components/domain/fighter-identity";
import { ClearanceBadge } from "@/components/domain/status-badges";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/ui/use-action-form";
import { grantClearanceAction } from "@/lib/actions/medical";
import { CLEARANCE_LEVEL_LABELS, EXAMINATION_OUTCOME_LABELS } from "@/lib/domain/labels";
import { clearanceState, type ClearanceState } from "@/lib/domain/rules";
import type { ClearanceLevel, ExaminationOutcome, ExaminationType, MedicalClearance } from "@/lib/domain/types";
import { addDaysToKey, daysBetween, formatDate } from "@/lib/format";
import { plural, type Translator } from "@/lib/i18n/translate-client";
import { routes } from "@/lib/routes";
import { CLEARANCE_LEVEL_FOR_OUTCOME } from "./clinical-badges";
import type { ProgressStep } from "./exam-progress";
import { ExamProgressRail } from "./exam-progress-rail";
import { badgeLocale, localExaminationTitle, localLabel } from "./examination-presets";
import { DemoFillBar, DoctorsOnly, FormPart } from "./form-parts";
import { RestrictionBuilder, type RestrictionDraft } from "./restriction-builder";

export interface ClearanceExaminationOption {
    id: string;
    date: string;
    type: ExaminationType | null;
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
    /** Opened from the fighter's profile: the fighter is fixed, so there is nothing to choose. */
    fighterLocked?: boolean;
    /** Demo mode: offer a one-click fill with a plausible sample decision. */
    demoFill?: boolean;
}

const VALIDITY_PICKS = [30, 60, 90, 180];
/** A new clearance starts valid for this many days; "not cleared" has no end date. */
const DEFAULT_VALIDITY_DAYS = 90;

function defaultValidUntil(level: ClearanceLevel | "", today: string): string {
    return level && level !== "not_cleared" ? addDaysToKey(today, DEFAULT_VALIDITY_DAYS) : "";
}

/** A clearance level's name in the viewer's language. */
const levelLabel = (t: Translator, level: ClearanceLevel) => localLabel(t, `clearanceLevel.${level}`, CLEARANCE_LEVEL_LABELS[level]);

const levelOptions = (t: Translator): ChoiceOption<ClearanceLevel>[] => [
    {
        value: "full",
        label: levelLabel(t, "full"),
        icon: ShieldCheck,
        tone: "success",
        description: t("doctorMedical.grant.fullDescription"),
    },
    {
        value: "restricted",
        label: levelLabel(t, "restricted"),
        icon: ShieldAlert,
        tone: "warning",
        description: t("doctorMedical.grant.restrictedDescription"),
    },
    {
        value: "not_cleared",
        label: levelLabel(t, "not_cleared"),
        icon: ShieldX,
        tone: "danger",
        description: t("doctorMedical.grant.notClearedDescription"),
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
export function GrantClearanceForm({
    fighters,
    defaultFighterId,
    defaultExaminationId,
    today,
    now,
    doctorName,
    warningDays,
    fighterLocked = false,
    demoFill = false,
}: GrantClearanceFormProps) {
    const t = useT();
    const form = useActionForm(grantClearanceAction, { id: "clearance" });
    const { control, error } = form;

    const initialFighter = fighters.find((fighter) => fighter.id === defaultFighterId) ?? null;
    // The linked examination, or else the fighter's latest: its conclusion sets the starting level.
    const initialExam = initialFighter?.examinations.find((exam) => exam.id === defaultExaminationId) ?? initialFighter?.examinations[0] ?? null;

    const [fighterId, setFighterId] = useState(initialFighter?.id ?? "");
    const [level, setLevel] = useState<ClearanceLevel | "">(initialExam ? CLEARANCE_LEVEL_FOR_OUTCOME[initialExam.outcome] : "");
    const [validUntil, setValidUntil] = useState(() => defaultValidUntil(initialExam ? CLEARANCE_LEVEL_FOR_OUTCOME[initialExam.outcome] : "", today));
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
        const latest = next?.examinations[0] ?? null;
        const nextLevel = latest ? CLEARANCE_LEVEL_FOR_OUTCOME[latest.outcome] : "";
        setFighterId(nextId);
        setExaminationId(latest?.id ?? "");
        setLevel(nextLevel);
        setValidUntil(defaultValidUntil(nextLevel, today));
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
                      level === "restricted" ? drafts.map(({ key, ...restriction }) => ({ ...restriction, id: `preview-${key}`, label: restriction.label || t("doctorMedical.grant.unnamedRestriction") })) : [],
                  examinationId: examinationId || null,
                  revokedAt: null,
                  revokedReason: null,
              }
            : null;

    const submitLabel =
        level === "restricted" ? t("doctorMedical.grant.submitRestricted") : level === "not_cleared" ? t("doctorMedical.grant.submitNotCleared") : t("doctorMedical.grant.submit");

    const steps: ProgressStep[] = [
        {
            key: "decide",
            label: t("doctorMedical.decision.title"),
            pct: !level ? 0 : level === "restricted" && drafts.length === 0 ? 0.5 : 1,
            state: !level ? "todo" : level === "restricted" && drafts.length === 0 ? "part" : "done",
            text: !level ? t("doctorMedical.progress.notChosen") : level === "restricted" && drafts.length === 0 ? t("doctorMedical.grant.addRestrictions") : levelLabel(t, level),
        },
        {
            key: "validity",
            label: t("doctorMedical.grant.validity"),
            pct: level === "not_cleared" || validUntil ? 1 : 0,
            state: level === "not_cleared" || validUntil ? "done" : "todo",
            text:
                level === "not_cleared"
                    ? t("doctorMedical.decision.noEnd")
                    : validDays !== null && validDays >= 0
                      ? plural(t, "doctorMedical.days", validDays)
                      : t("doctorMedical.grant.noDate"),
        },
        {
            key: "basis",
            label: t("doctorMedical.grant.basis"),
            pct: (reason.trim() ? 0.5 : 0) + (examinationId ? 0.5 : 0),
            state: reason.trim() ? "done" : examinationId ? "part" : "todo",
            text: reason.trim() ? (linkedExam ? formatDate(linkedExam.date) : t("doctorMedical.grant.reasonGiven")) : t("doctorMedical.grant.reasonMissing"),
        },
    ];

    /** Demo only: a plausible decision the doctor can still edit; "Xóa hết" empties it again. */
    const fillSample = () => {
        setLevel("full");
        setValidUntil(addDaysToKey(today, DEFAULT_VALIDITY_DAYS));
        setExaminationId(fighter?.examinations[0]?.id ?? "");
        setReason(t("doctorMedical.grant.sampleReason"));
        ["level", "validUntil", "reason", "examinationId"].forEach((name) => form.markEdited(name));
    };
    const clearAll = () => {
        setLevel("");
        setValidUntil("");
        setReason("");
        setDrafts([]);
    };

    return (
        <>
            <form
                {...form.formProps}
                onSubmit={(event) => {
                    if (level !== "not_cleared") return form.formProps.onSubmit(event);
                    event.preventDefault();
                    setConfirmOpen(true);
                }}
                className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
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
                {fighterLocked && <input type="hidden" name="fighterId" value={fighterId} />}
                {demoFill && (
                    <DemoFillBar
                        className="xl:col-span-2"
                        onFill={fillSample}
                        onClear={clearAll}
                    />
                )}

                <Card className="flex min-w-0 flex-col divide-y divide-border">
                    <FormPart prefix="clr-" id="decide" title={t("doctorMedical.decision.title")}>
                        {!fighterLocked && (
                            <Field label={t("doctorMedical.exam.fighter")} htmlFor={control("fighterId").id} error={error("fighterId")} required className="sm:max-w-sm">
                                <Select {...control("fighterId", { required: true })} value={fighterId} onChange={(event) => changeFighter(event.target.value)}>
                                    <option value="">{t("doctorMedical.exam.chooseFighter")}</option>
                                    {fighters.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.name}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        )}
                        <div>
                            <ChoiceGroup
                                id={control("level").id}
                                name="level"
                                legend={t("doctorMedical.grant.level")}
                                legendVisuallyHidden
                                required
                                columns={3}
                                options={levelOptions(t)}
                                value={level}
                                onChange={setLevel}
                                error={error("level")}
                            />
                            <div aria-live="polite">
                                {linkedExam && level && (
                                    <InlineNote icon={Info} tone={examMismatch ? "warning" : "neutral"} className="mt-2">
                                        {examMismatch
                                            ? t("doctorMedical.grant.examMismatch", {
                                                  exam: localExaminationTitle(t, linkedExam).toLowerCase(),
                                                  outcome: localLabel(t, `examinationOutcome.${linkedExam.outcome}`, EXAMINATION_OUTCOME_LABELS[linkedExam.outcome]),
                                              })
                                            : t("doctorMedical.grant.examMatches", { exam: localExaminationTitle(t, linkedExam).toLowerCase() })}
                                    </InlineNote>
                                )}
                            </div>
                        </div>
                    </FormPart>

                    <FormPart
                        prefix="clr-"
                        id="validity"
                        title={t("doctorMedical.grant.validity")}
                        description={level === "not_cleared" ? t("doctorMedical.grant.validityNotCleared") : t("doctorMedical.grant.validityDescription")}
                    >
                        {level !== "not_cleared" ? (
                            <Field
                                label={t("doctorMedical.grant.validUntil")}
                                htmlFor={control("validUntil").id}
                                error={error("validUntil")}
                                required
                                hint={
                                    validDays !== null && validDays >= 0
                                        ? t("doctorMedical.grant.validForHint", { days: plural(t, "doctorMedical.days", validDays), warning: warningDays })
                                        : t("doctorMedical.grant.validityMax")
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
                                                {plural(t, "doctorMedical.days", days)}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </Field>
                        ) : (
                            <InlineNote icon={Info}>{t("doctorMedical.grant.notClearedUntil")}</InlineNote>
                        )}
                    </FormPart>

                    {level === "restricted" && (
                        <FormPart prefix="clr-" id="limits" title={t("doctorMedical.decision.restrictions")} description={t("doctorMedical.grant.limitsDescription")}>
                            {copiedRestrictions && drafts.length > 0 && (
                                <InlineNote icon={Info} tone="info">
                                    {t("doctorMedical.grant.copied")}
                                </InlineNote>
                            )}
                            <RestrictionBuilder drafts={drafts} onChange={setDrafts} error={error} markEdited={form.markEdited} />
                        </FormPart>
                    )}

                    <FormPart
                        prefix="clr-"
                        id="basis"
                        title={t("doctorMedical.grant.basis")}
                        aside={<DoctorsOnly>{t("doctorMedical.grant.reasonDoctorsOnly")}</DoctorsOnly>}
                    >
                        <Field
                            label={t("doctorMedical.grant.linkedExam")}
                            htmlFor={control("examinationId").id}
                            error={error("examinationId")}
                            optional
                            hint={fighter && fighter.examinations.length === 0 ? t("doctorMedical.grant.noExams") : t("doctorMedical.grant.linkedExamHint")}
                            className="sm:max-w-lg"
                        >
                            <Select {...control("examinationId", { hint: true })} value={examinationId} onChange={(event) => setExaminationId(event.target.value)} disabled={!fighter}>
                                <option value="">{t("doctorMedical.grant.noLink")}</option>
                                {fighter?.examinations.map((exam) => (
                                    <option key={exam.id} value={exam.id}>
                                        {localExaminationTitle(t, exam)} · {formatDate(exam.date)} · {localLabel(t, `examinationOutcome.${exam.outcome}`, EXAMINATION_OUTCOME_LABELS[exam.outcome])}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field
                            label={t("doctorMedical.grant.reason")}
                            htmlFor={control("reason").id}
                            error={error("reason")}
                            required
                            hint={t("doctorMedical.grant.reasonHint")}
                        >
                            <Textarea
                                {...control("reason", { hint: true, required: true })}
                                rows={4}
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                placeholder={t("doctorMedical.grant.reasonPlaceholder")}
                            />
                        </Field>
                    </FormPart>
                </Card>

                <div className="xl:sticky xl:top-32">
                    <ExamProgressRail
                        steps={steps}
                        title={t("doctorMedical.grant.progressTitle")}
                        label={t("doctorMedical.grant.progressLabel")}
                        anchorPrefix="clr-"
                        top={
                            <div className="flex flex-col gap-4 px-5 py-4">
                                <div className="flex flex-col gap-2">
                                    <h2 className="text-[13px] font-semibold text-fg-muted">{t("doctorMedical.grant.change")}</h2>
                                    <div className="flex flex-col items-stretch gap-1.5">
                                        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2">
                                            <span className="text-xs text-fg-subtle">{t("doctorMedical.grant.current")}</span>
                                            {fighter ? <ClearanceBadge locale={badgeLocale(t)} state={fighter.state} size="sm" /> : <span className="text-sm text-fg-muted">—</span>}
                                            <span className="ml-auto text-xs text-fg-subtle">
                                                {fighter?.clearance?.validUntil && fighter.state !== "not_cleared"
                                                    ? t("doctorMedical.grant.until", { date: formatDate(fighter.clearance.validUntil) })
                                                    : t("doctorMedical.grant.noEnd")}
                                            </span>
                                        </div>
                                        <ArrowRight aria-hidden className="size-4 rotate-90 self-center text-fg-subtle" />
                                        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2">
                                            <span className="text-xs text-fg-subtle">{t("doctorMedical.grant.after")}</span>
                                            {level ? (
                                                <ClearanceBadge locale={badgeLocale(t)} state={level} size="sm" />
                                            ) : (
                                                <span className="text-sm text-fg-muted">{t("doctorMedical.progress.notChosen")}</span>
                                            )}
                                            <span className="ml-auto text-xs text-fg-subtle">
                                                {level && level !== "not_cleared" && validUntil
                                                    ? t("doctorMedical.grant.until", { date: formatDate(`${validUntil}T12:00:00.000Z`) })
                                                    : t("doctorMedical.grant.noEnd")}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <h2 className="text-[13px] font-semibold text-fg-muted">{t("doctorMedical.grant.preview")}</h2>
                                    {preview ? (
                                        <ClearanceCard clearance={preview} state={clearanceState(preview, now)} doctorName={doctorName} now={now} variant="summary" warningDays={warningDays} />
                                    ) : (
                                        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[13px] text-fg-muted">{t("doctorMedical.grant.previewEmpty")}</p>
                                    )}
                                </div>
                            </div>
                        }
                        actions={
                            <>
                                <FormMessage {...form.message} />
                                <Button type="submit" variant={level === "not_cleared" ? "danger" : "primary"} loading={form.pending} className="w-full">
                                    {form.pending ? t("doctorMedical.grant.submitting") : submitLabel}
                                </Button>
                                <Link
                                    href={fighter ? (fighterLocked ? routes.doctor.fighterClearance(fighter.id) : routes.doctor.fighter(fighter.id)) : routes.doctor.clearance}
                                    className={buttonClasses({ variant: "secondary", className: "w-full" })}
                                >
                                    {t("doctorMedical.cancel")}
                                </Link>
                            </>
                        }
                    />
                </div>
            </form>

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={() => {
                    setConfirmOpen(false);
                    form.submit({ confirmNotCleared: "yes" });
                }}
                title={t("doctorMedical.grant.confirmTitle", { name: fighter?.name ?? t("doctorMedical.grant.thisFighter") })}
                description={t("doctorMedical.grant.confirmDescription")}
                confirmLabel={t("doctorMedical.grant.confirm")}
            />
        </>
    );
}

