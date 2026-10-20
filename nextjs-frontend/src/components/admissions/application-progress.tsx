import { CircleCheck, CircleDashed, Clock, MailCheck } from "lucide-react";

import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { OwnApplication } from "@/lib/domain/admissions";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { ActivateAccountForm } from "./activate-account-form";

/** What happens next, for an application in progress. */
function NextStep({ application, locale }: { application: OwnApplication; locale?: Locale }) {
    const t = createTranslator(locale ?? "en");
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
                {t("applicant.next.passwordSetBody")}
            </Callout>
        );
    }
    return (
        <Callout tone="success" icon={MailCheck} title={t("applicant.next.approvedTitle")}>
            {t("applicant.next.approvedBody")}
        </Callout>
    );
}

/** The application's progress from sending it to the fighter account. */
export function ApplicationProgress({ application, locale }: { application: OwnApplication; locale?: Locale }) {
    const t = createTranslator(locale ?? "en");
    const steps = [
        { title: t("applicant.step.submitted"), date: application.submittedAt, done: true },
        { title: t("applicant.step.assessment"), date: application.assessedAt, done: application.assessedAt !== null },
        { title: t("applicant.step.decision"), date: application.decidedAt, done: application.decidedAt !== null },
        { title: t("applicant.step.activated"), date: null, done: application.activation === "completed" },
    ];
    const current = steps.findIndex((step) => !step.done);

    return (
        <Card>
            <CardHeader title={t("applicant.progressTitle")} description={t("applicant.progressSent", { date: formatDate(application.submittedAt, locale) })} />
            <CardContent className="flex flex-col gap-5">
                <ol className="flex flex-col gap-3">
                    {steps.map((step, index) => {
                        const Icon = step.done ? CircleCheck : CircleDashed;
                        return (
                            <li key={step.title} className="flex items-center gap-3" aria-current={index === current ? "step" : undefined}>
                                <Icon aria-hidden className={cn("size-5 shrink-0", step.done ? "text-success-fg" : index === current ? "text-primary-soft-fg" : "text-fg-subtle")} />
                                <span className={cn("text-sm", step.done || index === current ? "font-medium text-fg" : "text-fg-muted")}>{step.title}</span>
                                {step.date && <span className="ml-auto text-[13px] text-fg-muted">{formatDate(step.date, locale)}</span>}
                                <span className="sr-only">{step.done ? t("applicant.stepDone") : index === current ? t("applicant.stepInProgress") : t("applicant.stepToCome")}</span>
                            </li>
                        );
                    })}
                </ol>
                <NextStep application={application} locale={locale} />
            </CardContent>
        </Card>
    );
}
