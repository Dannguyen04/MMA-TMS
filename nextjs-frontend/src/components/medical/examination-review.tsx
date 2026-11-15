"use client";

import { PenLine } from "lucide-react";
import type { ReactNode } from "react";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { useFormSteps } from "@/components/ui/form-steps";
import { BODY_JOINT_LABELS, SESSION_TYPE_LABELS, TECHNIQUE_TYPE_LABELS, type ExaminationDecision, type ExaminationScope } from "@/lib/domain/medical-contract";
import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import type { ExaminationType } from "@/lib/domain/types";
import { academyWallClockToIso, formatDate, formatDateTime, isDateKey, isDateTimeInputValue } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import type { AssessmentRow, VitalsDraft } from "./examination-details-fields";
import { localLabel } from "./examination-presets";
import { scat6ReviewLines, type Scat6Draft, type Scat6Step } from "./scat6-draft";

/** The restriction lists as the form holds them when the review opens. Null lists mean "no limit". */
export interface ReviewRestrictions {
    sessions: string[] | null;
    techniques: string[] | null;
    joints: string[];
    notes: string;
}

export interface ExaminationReviewProps {
    scope: ExaminationScope;
    type: ExaminationType | "";
    /** YYYY-MM-DDTHH:mm in the academy timezone. */
    examinedAt: string;
    correcting: boolean;
    vitals: VitalsDraft;
    rows: AssessmentRow[];
    /** Null when the examination carries no SCAT6. */
    scat6: Scat6Draft | null;
    decision: ExaminationDecision | "";
    reason: string;
    validUntil: string;
    recommendations: string;
    followUpDate: string;
    restrictions: ReviewRestrictions | null;
    reviewRequests: { answered: number; open: number };
}

const SCAT6_STEP: Record<Scat6Step, string> = { history: "scat6-history", memory: "scat6-memory", balance: "scat6-balance" };

function NotEntered() {
    const t = useT();
    return <span className="font-normal text-fg-subtle">{t("doctorMedical.review.notEntered")}</span>;
}
const notEntered = <NotEntered />;

const when = (value: string, locale: Locale) => (isDateTimeInputValue(value) ? formatDateTime(academyWallClockToIso(...(value.split("T") as [string, string])), locale) : null);
const day = (value: string, locale: Locale) => (isDateKey(value) ? formatDate(academyWallClockToIso(value, "12:00"), locale) : null);
const hydrationLabels: Readonly<Record<string, MessageKey>> = { good: "doctorMedical.hydration.good", fair: "doctorMedical.hydration.fair", poor: "doctorMedical.hydration.poor" };

/**
 * The last step: what will be sent, as entered, with a way back to each step. The SCAT6 shows raw answers only; the
 * medical service computes its scores after the examination is recorded.
 */
export function ExaminationReview(props: ExaminationReviewProps) {
    const t = useT();
    const locale = useLocale();
    const { vitals } = props;
    const vitalsEntered = Object.values(vitals).some((value) => value.trim() !== "");
    const lines = props.scat6 ? scat6ReviewLines(props.scat6, t) : [];
    return (
        <div className="flex flex-col divide-y divide-border">
            <Group title={t("doctorMedical.review.visitAndVitals")} step="visit">
                <Facts
                    items={[
                        [t("doctorMedical.decision.scope"), t(`doctorMedical.scope.${props.scope}`)],
                        [t("doctorMedical.issue.type"), props.type ? localLabel(t, `examinationType.${props.type}`, EXAMINATION_TYPE_LABELS[props.type]) : null],
                        [t("doctorMedical.decision.examinedAt"), when(props.examinedAt, locale)],
                        ...(props.correcting ? ([[t("doctorMedical.review.correction"), t("doctorMedical.review.correctionValue")]] as const) : []),
                        [
                            t("doctorMedical.progress.vitals"),
                            vitalsEntered
                                ? [
                                      vitals.weightKg && `${vitals.weightKg} kg`,
                                      vitals.restingHeartRate && t("doctorMedical.review.heartRate", { value: vitals.restingHeartRate }),
                                      (vitals.bloodPressureSystolic || vitals.bloodPressureDiastolic) &&
                                          t("doctorMedical.review.bloodPressure", { systolic: vitals.bloodPressureSystolic || "–", diastolic: vitals.bloodPressureDiastolic || "–" }),
                                      vitals.temperatureC && `${vitals.temperatureC} °C`,
                                      vitals.spo2Pct && `SpO₂ ${vitals.spo2Pct}%`,
                                      hydrationLabels[vitals.hydration] && t("doctorMedical.review.hydration", { value: t(hydrationLabels[vitals.hydration]) }),
                                  ]
                                      .filter(Boolean)
                                      .join(" · ")
                                : null,
                        ],
                    ]}
                />
            </Group>

            <Group title={t("doctorMedical.review.physical")} step="physical">
                {props.rows.length === 0 ? (
                    <p className="text-sm text-fg-subtle">{t("doctorMedical.review.noAreas")}</p>
                ) : (
                    <ul className="flex flex-col gap-1.5 text-sm">
                        {props.rows.map((row) => (
                            <li key={row.key} className="flex min-w-0 flex-wrap gap-x-2">
                                <span className="font-medium text-fg">{row.area.trim() || t("doctorMedical.review.unnamedArea")}</span>
                                <span className={cn(row.result ? "text-fg-muted" : "text-danger-fg")}>{row.result ? t(`doctorMedical.result.${row.result}`) : t("doctorMedical.review.noResult")}</span>
                                {row.note.trim() && <span className="min-w-0 text-fg-muted">— {row.note.trim()}</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </Group>

            {props.scat6 &&
                (["history", "memory", "balance"] as const)
                    .filter((step) => lines.some((line) => line.step === step))
                    .map((step) => (
                        <Group key={step} title={scat6Title(t, step, props.scat6?.status === "ADMINISTERED")} step={SCAT6_STEP[step]}>
                            <Facts items={lines.filter((line) => line.step === step).map((line) => [line.label, line.value])} />
                        </Group>
                    ))}

            <Group title={t("doctorMedical.decision.title")} step="decision">
                <Facts
                    items={[
                        [t("doctorMedical.decision.title"), props.decision ? t(`doctorMedical.decision.${props.decision}`) : null],
                        ...(props.decision !== "NOT_ELIGIBLE" ? ([[t("doctorMedical.grant.validUntil"), day(props.validUntil, locale) ?? t("doctorMedical.decision.noEnd")]] as const) : []),
                        [t("doctorMedical.review.followUp"), day(props.followUpDate, locale) ?? t("doctorMedical.review.none")],
                        ...(props.restrictions ? ([[t("doctorMedical.decision.restrictions"), restrictionsText(t, props.restrictions)]] as const) : []),
                        ...(props.reviewRequests.open > 0 ? ([[t("doctorMedical.decision.requestsLegend"), `${props.reviewRequests.answered}/${props.reviewRequests.open}`]] as const) : []),
                    ]}
                />
                <Prose label={t("doctorMedical.decision.reasonLabel")} text={props.reason} />
                <Prose label={t("doctorMedical.exam.recommendationsLabel")} text={props.recommendations} />
            </Group>
        </div>
    );
}

function scat6Title(t: Translator, step: Scat6Step, administered: boolean): string {
    if (!administered) return "SCAT6";
    return step === "history" ? t("doctorMedical.review.scat6History") : step === "memory" ? t("doctorMedical.review.scat6Memory") : t("doctorMedical.review.scat6Balance");
}

/** Whether a value sent back is one the labels know (an unknown one is shown as sent). */
const known = <T extends string>(value: string, labels: Record<T, string>): value is T => value in labels;

function restrictionsText(t: Translator, restrictions: ReviewRestrictions): string {
    const parts = [
        restrictions.sessions === null
            ? null
            : t("doctorMedical.review.sessions", { list: restrictions.sessions.map((value) => (known(value, SESSION_TYPE_LABELS) ? t(`doctorMedical.sessionType.${value}`) : value)).join(", ") || t("doctorMedical.review.noneChosen") }),
        restrictions.techniques === null
            ? null
            : t("doctorMedical.review.techniques", { list: restrictions.techniques.map((value) => (known(value, TECHNIQUE_TYPE_LABELS) ? t(`doctorMedical.techniqueType.${value}`) : value)).join(", ") || t("doctorMedical.review.noneChosen") }),
        restrictions.joints.length > 0 ? t("doctorMedical.review.avoid", { list: restrictions.joints.map((value) => (known(value, BODY_JOINT_LABELS) ? t(`doctorMedical.joint.${value}`) : value)).join(", ") }) : null,
        restrictions.notes.trim() ? t("doctorMedical.review.notes", { notes: restrictions.notes.trim() }) : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : t("doctorMedical.review.notSet");
}

function Group({ title, step, children }: { title: string; step: string; children: ReactNode }) {
    const t = useT();
    const { goTo } = useFormSteps();
    return (
        <section className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-fg">{title}</h3>
                <Button variant="ghost" size="sm" onClick={() => goTo(step)} aria-label={t("doctorMedical.review.editLabel", { title: title.toLowerCase() })}>
                    <PenLine aria-hidden />
                    {t("doctorMedical.review.edit")}
                </Button>
            </div>
            {children}
        </section>
    );
}

function Facts({ items }: { items: readonly (readonly [string, ReactNode])[] }) {
    return (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {items.map(([label, value]) => (
                <div key={label} className="min-w-0">
                    <dt className="text-[13px] text-fg-muted">{label}</dt>
                    <dd className="text-sm font-medium break-words text-fg">{value ?? notEntered}</dd>
                </div>
            ))}
        </dl>
    );
}

function Prose({ label, text }: { label: string; text: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[13px] text-fg-muted">{label}</p>
            <p className="mt-0.5 text-sm text-pretty whitespace-pre-line text-fg">{text.trim() || notEntered}</p>
        </div>
    );
}
