import { CircleCheck, CircleDashed, Clock, MailCheck } from "lucide-react";

import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { OwnApplication } from "@/lib/domain/admissions";
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
                Activate your fighter account. Next, the academy assigns your sports doctor, who records your baseline examination before you
                train.
            </Callout>
        );
    }
    return (
        <Callout tone="success" icon={MailCheck} title="You're in! Check your email">
            We&apos;ve sent you a link to set your password. Once it&apos;s set, sign in again and activate your fighter account here. No email?
            Use &ldquo;Forgot password&rdquo; on the sign-in page with this address.
        </Callout>
    );
}

/** The application's progress from sending it to the fighter account. */
export function ApplicationProgress({ application }: { application: OwnApplication }) {
    const steps = [
        { title: "Application sent", date: application.submittedAt, done: true },
        { title: "Entrance assessment", date: application.assessedAt, done: application.assessedAt !== null },
        { title: "Academy decision", date: application.decidedAt, done: application.decidedAt !== null },
        { title: "Fighter account activated", date: null, done: application.activation === "completed" },
    ];
    const current = steps.findIndex((step) => !step.done);

    return (
        <Card>
            <CardHeader title="Your application" description={`Sent ${formatDate(application.submittedAt)}`} />
            <CardContent className="flex flex-col gap-5">
                <ol className="flex flex-col gap-3">
                    {steps.map((step, index) => {
                        const Icon = step.done ? CircleCheck : CircleDashed;
                        return (
                            <li key={step.title} className="flex items-center gap-3" aria-current={index === current ? "step" : undefined}>
                                <Icon aria-hidden className={cn("size-5 shrink-0", step.done ? "text-success-fg" : index === current ? "text-primary-soft-fg" : "text-fg-subtle")} />
                                <span className={cn("text-sm", step.done || index === current ? "font-medium text-fg" : "text-fg-muted")}>{step.title}</span>
                                {step.date && <span className="ml-auto text-[13px] text-fg-muted">{formatDate(step.date)}</span>}
                                <span className="sr-only">{step.done ? "(done)" : index === current ? "(in progress)" : "(to come)"}</span>
                            </li>
                        );
                    })}
                </ol>
                <NextStep application={application} />
            </CardContent>
        </Card>
    );
}
