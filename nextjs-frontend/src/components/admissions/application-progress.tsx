import { CircleCheck, CircleDashed, CircleDot, CircleX, Clock, MailCheck, type LucideIcon } from "lucide-react";

import { TermHint } from "@/components/domain/term-hint";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { applicantJourney, type JourneyStep, type JourneyStepId, type JourneyStepState, type OwnApplication } from "@/lib/domain/admissions";
import type { GlossaryTerm } from "@/lib/domain/glossary";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ActivateAccountForm } from "./activate-account-form";

/** What happens next, for an application in progress. */
function NextStep({ application }: { application: OwnApplication }) {
    if (application.status === "submitted") {
        return (
            <Callout tone="info" icon={Clock} title="A coach will assess you">
                The academy is assigning a coach to run your entrance assessment. They&apos;ll get in touch to arrange it.
            </Callout>
        );
    }
    if (application.status === "passed") {
        return (
            <Callout tone="info" icon={CircleCheck} title="You passed the assessment">
                The academy will make the final decision soon.
            </Callout>
        );
    }
    if (application.activation === "password_set") {
        return (
            <Callout tone="success" icon={CircleCheck} title="Your password is set" action={<ActivateAccountForm />}>
                Activate your fighter account. Next, the academy assigns your sports doctor, who records your baseline exam before you train.
            </Callout>
        );
    }
    return (
        <Callout tone="success" icon={MailCheck} title="You're in! Check your email">
            We&apos;ve sent you an email to set your password. Set it, sign in with it, then activate your fighter account here.
            Didn&apos;t get the set-up email? Ask the academy to resend it.
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
const STATE_TEXT: Record<JourneyStepState, string> = { done: "(done)", current: "(in progress)", upcoming: "(to come)", ended: "" };

/** Steps whose name is academy jargon get an explanation. */
const STEP_TERMS: Partial<Record<JourneyStepId, GlossaryTerm>> = { assessment: "entranceAssessment", activation: "activation", baseline: "baselineExam" };

function StepRow({ step }: { step: JourneyStep }) {
    const Icon = STATE_ICON[step.state];
    const term = STEP_TERMS[step.id];
    const strong = step.state !== "upcoming";
    return (
        <li className="flex min-h-7 items-center gap-3" aria-current={step.state === "current" ? "step" : undefined}>
            <Icon aria-hidden className={cn("size-5 shrink-0", STATE_ICON_TONE[step.state])} />
            <span className="flex min-w-0 items-center gap-1">
                <span className={cn("text-sm", strong ? "font-medium text-fg" : "text-fg-muted")}>{step.label}</span>
                {term && <TermHint term={term} />}
            </span>
            <span className="sr-only">{step.outcome ? `(${step.outcome.toLowerCase()})` : STATE_TEXT[step.state]}</span>
            {step.outcome ? (
                <span className="ml-auto text-[13px] font-medium text-danger-fg">{step.outcome}</span>
            ) : (
                step.date && <span className="ml-auto shrink-0 text-[13px] text-fg-muted">{formatDate(step.date)}</span>
            )}
        </li>
    );
}

/** The application's progress, from the verified email to being cleared to train. */
export function ApplicationProgress({ application }: { application: OwnApplication }) {
    const steps = applicantJourney(application);
    const admission = steps.filter((step) => step.phase === "admission");
    const fighter = steps.filter((step) => step.phase === "fighter");

    return (
        <Card>
            <CardHeader title="Your application" description={`Sent ${formatDate(application.submittedAt)}`} />
            <CardContent className="flex flex-col gap-5">
                <NextStep application={application} />
                <div className="flex flex-col gap-4">
                    <ol className="flex flex-col gap-2" aria-label="Admission steps">
                        {admission.map((step) => (
                            <StepRow key={step.id} step={step} />
                        ))}
                    </ol>
                    {fighter.length > 0 && (
                        <div className="flex flex-col gap-2 border-t border-border pt-4">
                            <p id="fighter-steps" className="text-[13px] text-fg-muted">
                                After you activate, in your fighter account
                            </p>
                            <ol className="flex flex-col gap-2" aria-labelledby="fighter-steps">
                                {fighter.map((step) => (
                                    <StepRow key={step.id} step={step} />
                                ))}
                            </ol>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
