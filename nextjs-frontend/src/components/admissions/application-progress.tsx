import { CircleCheck, CircleDashed, CircleDot, CircleX, Clock, MailCheck, type LucideIcon } from "lucide-react";

import { TermHint } from "@/components/domain/term-hint";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { applicantJourney, type JourneyStep, type JourneyStepId, type JourneyStepState, type OwnApplication } from "@/lib/domain/admissions";
import type { GlossaryTerm } from "@/lib/domain/glossary";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey, type Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { ActivateAccountForm } from "./activate-account-form";

/** What happens next, for an application in progress. */
function NextStep({ application, t }: { application: OwnApplication; t: Translator }) {
    if (application.status === "submitted") {
        return (
            <Callout tone="info" icon={Clock} title={t("applicant.next.submittedTitle")}>
                {t("applicant.next.submittedBody")}
            </Callout>
        );
    }
    if (application.status === "passed") {
        return (
            <Callout tone="info" icon={CircleCheck} title={t("applicant.next.passedTitle")}>
                {t("applicant.next.passedBody")}
            </Callout>
        );
    }
    if (application.activation === "password_set") {
        return (
            <Callout tone="success" icon={CircleCheck} title={t("applicant.next.passwordSetTitle")} action={<ActivateAccountForm />}>
                {t("screens.misc.progress.passwordSetBody")}
            </Callout>
        );
    }
    return (
        <Callout tone="success" icon={MailCheck} title={t("applicant.next.approvedTitle")}>
            {t("screens.misc.progress.approvedBody")}
        </Callout>
    );
}

const STATE_ICON: Record<JourneyStepState, LucideIcon> = { done: CircleCheck, current: CircleDot, upcoming: CircleDashed, ended: CircleX };
const STATE_ICON_TONE: Record<JourneyStepState, string> = {
    done: "text-success-fg",
    current: "text-primary-soft-fg",
    upcoming: "text-fg-subtle",
    ended: "text-danger-fg",
};
const STATE_TEXT: Record<JourneyStepState, MessageKey | null> = { done: "applicant.stepDone", current: "applicant.stepInProgress", upcoming: "applicant.stepToCome", ended: null };

/** Steps whose name is academy jargon get an explanation. */
const STEP_TERMS: Partial<Record<JourneyStepId, GlossaryTerm>> = { assessment: "entranceAssessment", activation: "activation", baseline: "baselineExam" };

function StepRow({ step, locale, t }: { step: JourneyStep; locale: Locale; t: Translator }) {
    const Icon = STATE_ICON[step.state];
    const term = STEP_TERMS[step.id];
    const strong = step.state !== "upcoming";
    const stateText = STATE_TEXT[step.state];
    // An ended step shows the status that closed the application: a failed assessment or a rejection.
    const outcome = step.outcome && t(step.id === "assessment" ? "screens.misc.applicationStatus.failed" : "screens.misc.applicationStatus.rejected");
    return (
        <li className="flex min-h-7 items-center gap-3" aria-current={step.state === "current" ? "step" : undefined}>
            <Icon aria-hidden className={cn("size-5 shrink-0", STATE_ICON_TONE[step.state])} />
            <span className="flex min-w-0 items-center gap-1">
                <span className={cn("text-sm", strong ? "font-medium text-fg" : "text-fg-muted")}>{t(`screens.misc.journey.${step.id}`)}</span>
                {term && <TermHint term={term} />}
            </span>
            <span className="sr-only">{outcome ? `(${outcome.toLowerCase()})` : stateText ? t(stateText) : ""}</span>
            {outcome ? (
                <span className="ml-auto text-[13px] font-medium text-danger-fg">{outcome}</span>
            ) : (
                step.date && <span className="ml-auto shrink-0 text-[13px] text-fg-muted">{formatDate(step.date, locale)}</span>
            )}
        </li>
    );
}

/** The application's progress, from the verified email to being cleared to train. `locale` is the viewer's language; English when omitted. */
export function ApplicationProgress({ application, locale = "en" }: { application: OwnApplication; locale?: Locale }) {
    const t = createTranslator(locale);
    const steps = applicantJourney(application);
    const admission = steps.filter((step) => step.phase === "admission");
    const fighter = steps.filter((step) => step.phase === "fighter");

    return (
        <Card>
            <CardHeader title={t("applicant.progressTitle")} description={t("applicant.progressSent", { date: formatDate(application.submittedAt, locale) })} />
            <CardContent className="flex flex-col gap-5">
                <NextStep application={application} t={t} />
                <div className="flex flex-col gap-4">
                    <ol className="flex flex-col gap-2" aria-label={t("screens.misc.progress.steps")}>
                        {admission.map((step) => (
                            <StepRow key={step.id} step={step} locale={locale} t={t} />
                        ))}
                    </ol>
                    {fighter.length > 0 && (
                        <div className="flex flex-col gap-2 border-t border-border pt-4">
                            <p id="fighter-steps" className="text-[13px] text-fg-muted">
                                {t("screens.misc.progress.afterActivate")}
                            </p>
                            <ol className="flex flex-col gap-2" aria-labelledby="fighter-steps">
                                {fighter.map((step) => (
                                    <StepRow key={step.id} step={step} locale={locale} t={t} />
                                ))}
                            </ol>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
