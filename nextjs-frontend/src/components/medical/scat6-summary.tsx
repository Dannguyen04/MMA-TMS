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
                title="SCAT6 nền"
                icon={<Brain />}
                description={`${record.formVersion}${record.scoringVersion !== null ? ` · cách tính điểm v${record.scoringVersion}` : ""}`}
                action={notAdministered ? <Badge tone="neutral">Không thực hiện</Badge> : scores && <Badge tone={scores.complete ? "success" : "warning"}>{scores.complete ? "Đầy đủ" : "Một phần"}</Badge>}
            />
            <CardContent>
                {notAdministered ? (
                    <p className="text-sm text-pretty whitespace-pre-line text-fg">{responses.reason ?? "Chưa ghi lý do."}</p>
                ) : scores ? (
                    <>
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                            {SCAT6_SCORE_ROWS.map(({ key, label, max, unit }) => {
                                const value = scores[key];
                                return (
                                    <div key={key} className="flex min-w-0 flex-col">
                                        <dt className="text-[13px] text-fg-muted">{label}</dt>
                                        <dd className="text-sm font-medium text-fg tabular-nums">
                                            {value === null ? <span className="font-normal text-fg-subtle">Chưa tính điểm</span> : unit === "s" ? `${formatNumber(value, 2)} s` : max === null ? value : `${value} / ${max}`}
                                        </dd>
                                    </div>
                                );
                            })}
                        </dl>
                        {SCAT6_SCORE_ROWS.some(({ key }) => scores[key] === null) && (
                            <p className="mt-3 text-[13px] text-fg-muted">Chưa tính điểm: phần này không được thực hiện hoặc chưa đủ để tính.</p>
                        )}
                    </>
                ) : (
                    <p className="text-sm text-fg-muted">Dịch vụ y tế chưa tính điểm hồ sơ này.</p>
                )}
            </CardContent>
        </Card>
    );
}
