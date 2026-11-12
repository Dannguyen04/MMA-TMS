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

import { TRAINING_TYPE_LABELS, trainingTypeLabel } from "@/lib/domain/labels";
import type { SessionType } from "@/lib/domain/medical-contract";
import { TRAINING_TYPE_FOR } from "@/lib/domain/training-contract";
import type { TrainingType } from "@/lib/domain/types";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate-client";
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

/**
 * The interface training type for a session type from any source: the training service's upper-case types
 * (`RECOVERY`, `PHYSICAL_THERAPY`…, which don't match by lower-casing) or the interface's own. Unknown values read as
 * recovery, so an icon is always found.
 */
export function trainingTypeOf(value: string): TrainingType {
    if (value in TRAINING_TYPE_FOR) return TRAINING_TYPE_FOR[value as SessionType];
    if (value in TRAINING_TYPE_ICONS) return value as TrainingType;
    return "recovery_mobility";
}

export interface TrainingTypeIconProps {
    type: TrainingType;
    /** Announce the training type label. Leave false when the label is already visible next to the icon. */
    labelled?: boolean;
    className?: string;
    locale?: Locale;
}

export function TrainingTypeIcon({ type, labelled = false, className, locale }: TrainingTypeIconProps) {
    const Icon = TRAINING_TYPE_ICONS[type];
    const label = locale ? trainingTypeLabel(createTranslator(locale), type) : TRAINING_TYPE_LABELS[type];
    return labelled ? (
        <Icon role="img" aria-label={label} className={cn("size-4 shrink-0", className)} />
    ) : (
        <Icon aria-hidden className={cn("size-4 shrink-0", className)} />
    );
}
