import { Brain } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SCAT6_SCORE_ROWS, type Scat6Record } from "@/lib/domain/scat6";
import { formatNumber } from "@/lib/format";

/** A baseline's SCAT6 as the medical service scored it. Scores describe the athlete's baseline; none is a diagnosis. */
export function Scat6Summary({ record }: { record: Scat6Record }) {
    const { responses, scores } = record;
    const notAdministered = responses.status === "NOT_ADMINISTERED";
    return (
        <Card>
            <CardHeader
                title="SCAT6 baseline"
                icon={<Brain />}
                description={`${record.formVersion}${record.scoringVersion !== null ? ` · scoring v${record.scoringVersion}` : ""}`}
                action={notAdministered ? <Badge tone="neutral">Not administered</Badge> : scores && <Badge tone={scores.complete ? "success" : "warning"}>{scores.complete ? "Complete" : "Partial"}</Badge>}
            />
            <CardContent>
                {notAdministered ? (
                    <p className="text-sm text-pretty whitespace-pre-line text-fg">{responses.reason ?? "No reason recorded."}</p>
                ) : scores ? (
                    <>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                            {SCAT6_SCORE_ROWS.map(({ key, label, max, unit }) => {
                                const value = scores[key];
                                return (
                                    <div key={key} className="flex min-w-0 flex-col">
                                        <dt className="text-[13px] text-fg-muted">{label}</dt>
                                        <dd className="text-sm font-medium text-fg tabular-nums">
                                            {value === null ? <span className="font-normal text-fg-subtle">Not scored</span> : unit === "s" ? `${formatNumber(value, 2)} s` : max === null ? value : `${value} / ${max}`}
                                        </dd>
                                    </div>
                                );
                            })}
                        </dl>
                        {SCAT6_SCORE_ROWS.some(({ key }) => scores[key] === null) && (
                            <p className="mt-3 text-[13px] text-fg-muted">Not scored: the part wasn&apos;t performed, or wasn&apos;t completed enough to score.</p>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-fg-muted">The medical service hasn&apos;t scored this record.</p>
                )}
            </CardContent>
        </Card>
    );
}
