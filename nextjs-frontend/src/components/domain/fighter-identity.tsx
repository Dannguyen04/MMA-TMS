import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { STANCE_LABELS, TRAINING_LEVEL_LABELS, WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import type { Fighter } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { HealthStatusBadge } from "./status-badges";

/** The fighter fields identity components need — pass a full `Fighter` or a lighter projection. */
export type FighterIdentityData = Pick<Fighter, "name" | "nickname" | "weightClass" | "stance" | "level" | "healthStatus">;

export type FighterIdentitySize = "sm" | "md" | "lg";

export interface FighterIdentityProps {
    fighter: FighterIdentityData;
    size?: FighterIdentitySize;
    /** Makes the name a link. */
    href?: string;
    /** Stretches the name link over the nearest `relative` ancestor (whole-card links). */
    stretchedLink?: boolean;
    showHealth?: boolean;
    /** Hide the "weight class · stance · level" line in dense rows. */
    showMeta?: boolean;
    className?: string;
}

const NAME_CLASS: Record<FighterIdentitySize, string> = {
    sm: "text-sm",
    md: "text-[15px]",
    lg: "text-lg",
};

/** Octagon avatar + name (+ nickname) + meta line + optional health badge. */
export function FighterIdentity({
    fighter,
    size = "md",
    href,
    stretchedLink = false,
    showHealth = false,
    showMeta = true,
    className,
}: FighterIdentityProps) {
    const meta = [WEIGHT_CLASS_LABELS[fighter.weightClass], STANCE_LABELS[fighter.stance], TRAINING_LEVEL_LABELS[fighter.level]].join(" · ");

    return (
        <div className={cn("flex min-w-0 items-center", size === "lg" ? "gap-4" : "gap-3", className)}>
            <Avatar name={fighter.name} shape="octagon" size={size} />
            <div className="min-w-0">
                <p className={cn("flex min-w-0 flex-wrap items-baseline gap-x-1.5 leading-snug", NAME_CLASS[size])}>
                    {href ? (
                        <Link
                            href={href}
                            className={cn(
                                "truncate rounded-sm font-semibold text-fg hover:underline",
                                stretchedLink && "after:absolute after:inset-0 after:rounded-xl after:content-['']",
                            )}
                        >
                            {fighter.name}
                        </Link>
                    ) : (
                        <span className="truncate font-semibold text-fg">{fighter.name}</span>
                    )}
                    {fighter.nickname && (
                        <span className={cn("truncate text-fg-muted", size === "sm" ? "text-xs" : "text-[13px]")}>
                            “{fighter.nickname}”
                        </span>
                    )}
                </p>
                {showMeta && <p className={cn("truncate text-fg-muted", size === "sm" ? "text-xs" : "text-[13px]")}>{meta}</p>}
                {showHealth && (
                    <div className="mt-1.5">
                        <HealthStatusBadge status={fighter.healthStatus} size="sm" />
                    </div>
                )}
            </div>
        </div>
    );
}
