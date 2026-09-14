import { ShieldCheck, ShieldX } from "lucide-react";

import { ClearanceBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { TONE_SOFT } from "@/components/ui/tone";
import { CLEARANCE_LEVEL_LABELS } from "@/lib/domain/labels";
import type { MedicalClearance } from "@/lib/domain/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface RevokedClearanceCardProps {
    clearance: MedicalClearance;
    fighterName: string;
    issuedByName?: string;
    grantHref: string;
    className?: string;
}

/** Clinical view of a revoked clearance: the fighter is Not Cleared until a new clearance is issued. */
export function RevokedClearanceCard({ clearance, fighterName, issuedByName, grantHref, className }: RevokedClearanceCardProps) {
    return (
        <Card className={className}>
            <CardHeader
                title="Medical Clearance"
                icon={<ShieldCheck />}
                action={
                    <ButtonLink href={grantHref} variant="secondary" size="sm">
                        <ShieldCheck aria-hidden />
                        Issue new clearance
                    </ButtonLink>
                }
            />
            <CardContent className="flex flex-col gap-5">
                <div className={cn("flex items-start gap-4 rounded-lg px-4 py-3.5 ring-1 ring-inset", TONE_SOFT.danger)}>
                    <span aria-hidden className="octagon flex size-11 shrink-0 items-center justify-center bg-surface">
                        <ShieldX className="size-5 text-danger-fg" strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0">
                        <ClearanceBadge state="not_cleared" size="sm" />
                        <p className="mt-1.5 text-base leading-snug font-semibold text-fg">Clearance revoked — no training permitted</p>
                        <p className="mt-0.5 text-sm text-pretty text-fg-muted">
                            {fighterName} must not train until you examine them and issue a new clearance.
                        </p>
                    </div>
                </div>
                <DescriptionList
                    items={[
                        {
                            label: "Revoked",
                            value: clearance.revokedAt ? <time dateTime={clearance.revokedAt}>{formatDateTime(clearance.revokedAt)}</time> : "Date not recorded",
                        },
                        {
                            label: "Revoked clearance",
                            value: (
                                <span className="flex flex-col gap-0.5">
                                    {CLEARANCE_LEVEL_LABELS[clearance.level]}
                                    <span className="text-[13px] font-normal text-fg-muted">
                                        Issued {formatDate(clearance.issuedAt)}
                                        {issuedByName ? ` by ${issuedByName}` : ""}
                                    </span>
                                </span>
                            ),
                        },
                        { label: "Reason for revoking", value: <span className="font-normal">{clearance.revokedReason ?? "No reason recorded"}</span>, wide: true },
                    ]}
                />
            </CardContent>
        </Card>
    );
}
