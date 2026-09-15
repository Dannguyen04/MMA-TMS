import { Bandage } from "lucide-react";
import Link from "next/link";

import { InjurySeverityBadge, InjuryStatusBadge } from "@/components/domain/status-badges";
import { EmptyState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BODY_REGION_LABELS, INJURY_MECHANISM_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import type { Injury } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";

/** Every injury recorded for a fighter, open and resolved, most recent first. */
export function InjuryHistory({ injuries }: { injuries: Injury[] }) {
    if (injuries.length === 0) {
        return (
            <EmptyState
                compact
                icon={<Bandage />}
                title="No injuries recorded"
                description="Injuries you record, including resolved ones, stay in this history."
            />
        );
    }

    return (
        <Table caption="Injury history">
            <THead>
                <tr>
                    <TH>Injury</TH>
                    <TH>Severity</TH>
                    <TH>Status</TH>
                    <TH>Occurred</TH>
                    <TH>Return / resolved</TH>
                    <TH>Mechanism</TH>
                </tr>
            </THead>
            <TBody>
                {injuries.map((injury) => (
                    <TR key={injury.id}>
                        <TD className="min-w-52">
                            <Link href={routes.doctor.injury(injury.id)} className="rounded-sm font-medium text-fg hover:underline">
                                {INJURY_TYPE_LABELS[injury.type]}
                            </Link>
                            <span className="block text-xs text-fg-muted">{BODY_REGION_LABELS[injury.bodyRegion]}</span>
                        </TD>
                        <TD>
                            <InjurySeverityBadge severity={injury.severity} size="sm" />
                        </TD>
                        <TD>
                            <InjuryStatusBadge status={injury.status} size="sm" />
                        </TD>
                        <TD className="whitespace-nowrap text-[13px]">
                            <time dateTime={injury.occurredAt}>{formatDate(injury.occurredAt)}</time>
                        </TD>
                        <TD className="whitespace-nowrap text-[13px]">
                            {injury.resolvedAt ? (
                                <span>
                                    Resolved <time dateTime={injury.resolvedAt}>{formatDate(injury.resolvedAt)}</time>
                                </span>
                            ) : injury.expectedReturnAt ? (
                                <span>
                                    Expected <time dateTime={injury.expectedReturnAt}>{formatDate(injury.expectedReturnAt)}</time>
                                </span>
                            ) : (
                                <span className="text-fg-muted">To be assessed</span>
                            )}
                        </TD>
                        <TD className="whitespace-nowrap text-[13px]">{INJURY_MECHANISM_LABELS[injury.mechanism]}</TD>
                    </TR>
                ))}
            </TBody>
        </Table>
    );
}
