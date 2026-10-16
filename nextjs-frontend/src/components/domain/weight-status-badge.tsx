import { Badge } from "@/components/ui/badge";
import { weightStatusLabel, type WeightStatus } from "@/lib/domain/weight-chart";
import type { Tone } from "@/components/ui/tone";

const STATUS_TONE: Record<WeightStatus, Tone> = {
    GREEN: "success",
    YELLOW: "warning",
    RED: "danger",
    GREY: "neutral",
};

export function WeightStatusBadge({ status }: { status: WeightStatus }) {
    return (
        <Badge tone={STATUS_TONE[status]} dot>
            {weightStatusLabel(status)}
        </Badge>
    );
}
