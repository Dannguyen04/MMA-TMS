"use client";

import { Brain } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SCAT6_SCORE_ROWS, type Scat6Record } from "@/lib/domain/scat6";
import { formatNumber } from "@/lib/format";

/**
 * A baseline's SCAT6 as the medical service scored it. Scores describe the athlete's baseline; none is a diagnosis.
 * A client component so it reads the viewer's language both on server pages and inside client forms.
 */
export function Scat6Summary({ record }: { record: Scat6Record }) {
    const t = useT();
    const { responses, scores } = record;
    const notAdministered = responses.status === "NOT_ADMINISTERED";
    return (
        <Card>
            <CardHeader
                title={t("doctorScat6.summary.title")}
                icon={<Brain />}
                description={`${record.formVersion}${record.scoringVersion !== null ? t("doctorScat6.summary.scoringVersion", { n: record.scoringVersion }) : ""}`}
                action={notAdministered ? <Badge tone="neutral">{t("doctorScat6.common.notPerformed")}</Badge> : scores && <Badge tone={scores.complete ? "success" : "warning"}>{scores.complete ? t("doctorScat6.summary.complete") : t("doctorScat6.summary.partial")}</Badge>}
            />
            <CardContent>
                {notAdministered ? (
                    <p className="text-sm text-pretty whitespace-pre-line text-fg">{responses.reason ?? t("doctorScat6.summary.noReason")}</p>
                ) : scores ? (
                    <>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                            {SCAT6_SCORE_ROWS.map(({ key, label, max, unit }) => {
                                const value = scores[key];
                                return (
                                    <div key={key} className="flex min-w-0 flex-col">
                                        <dt className="text-[13px] text-fg-muted">{t(label)}</dt>
                                        <dd className="text-sm font-medium text-fg tabular-nums">
                                            {value === null ? <span className="font-normal text-fg-subtle">{t("doctorScat6.summary.notScored")}</span> : unit === "s" ? `${formatNumber(value, 2)} s` : max === null ? value : `${value} / ${max}`}
                                        </dd>
                                    </div>
                                );
                            })}
                        </dl>
                        {SCAT6_SCORE_ROWS.some(({ key }) => scores[key] === null) && (
                            <p className="mt-3 text-[13px] text-fg-muted">{t("doctorScat6.summary.notScoredNote")}</p>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-fg-muted">{t("doctorScat6.summary.noScores")}</p>
                )}
            </CardContent>
        </Card>
    );
}
