import {
    BatteryCharging,
    Crosshair,
    Dumbbell,
    Hand,
    HandFist,
    HandGrab,
    PersonStanding,
    Swords,
    type LucideIcon,
} from "lucide-react";

import { TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { TrainingType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/** One distinct icon per training type, used in schedules, session lists and restrictions. */
export const TRAINING_TYPE_ICONS: Record<TrainingType, LucideIcon> = {
    shadow_boxing: PersonStanding,
    pad_work: Hand,
    heavy_bag: HandFist,
    sparring: Swords,
    technical_drilling: Crosshair,
    grappling: HandGrab,
    strength_conditioning: Dumbbell,
    recovery_mobility: BatteryCharging,
};

export interface TrainingTypeIconProps {
    type: TrainingType;
    /** Announce the training type label. Leave false when the label is already visible next to the icon. */
    labelled?: boolean;
    className?: string;
}

export function TrainingTypeIcon({ type, labelled = false, className }: TrainingTypeIconProps) {
    const Icon = TRAINING_TYPE_ICONS[type];
    return labelled ? (
        <Icon role="img" aria-label={TRAINING_TYPE_LABELS[type]} className={cn("size-4 shrink-0", className)} />
    ) : (
        <Icon aria-hidden className={cn("size-4 shrink-0", className)} />
    );
}
