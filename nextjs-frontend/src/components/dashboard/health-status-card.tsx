import { HeartPulse } from "lucide-react";
import type { ReactNode } from "react";

import { HealthStatusBadge } from "@/components/domain/status-badges";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { HEALTH_STATUS_DESCRIPTIONS } from "@/lib/domain/labels";
import type { HealthStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export interface HealthStatusCardProps {
    status: HealthStatus;
    /** Rows under the description, e.g. next follow-up or who to talk to. */
    children?: ReactNode;
    action?: ReactNode;
    /** Wide cards put the status beside the extra rows from `sm` up instead of stacking them. */
    wide?: boolean;
    className?: string;
}

/** Health status with its plain-language meaning. Non-clinical: safe for coaches and fighters. */
export function HealthStatusCard({ status, children, action, wide = false, className }: HealthStatusCardProps) {
    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title="Health status" icon={<HeartPulse />} action={action} />
            <CardContent className={cn("flex flex-col gap-3", wide && "sm:grid sm:grid-cols-2 sm:items-start sm:gap-5")}>
                <div className="min-w-0">
                    <HealthStatusBadge status={status} />
                    <p className="mt-1.5 text-sm text-pretty text-fg-muted">{HEALTH_STATUS_DESCRIPTIONS[status]}</p>
                </div>
                {wide ? children && <div className="flex min-w-0 flex-col gap-3">{children}</div> : children}
            </CardContent>
        </Card>
    );
}
