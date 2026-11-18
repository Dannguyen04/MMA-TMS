import type { LucideIcon } from "lucide-react";
import { SegmentedLinks } from "@/components/ui/segmented-links";

import { hrefWith, type SearchParams } from "@/lib/query";

export interface ViewOption {
    value: string;
    label: string;
    icon: LucideIcon;
}

export interface ViewToggleProps {
    label: string;
    options: ViewOption[];
    active: string;
    /** The option that is used when ?view= is absent (its link drops the param). */
    defaultValue: string;
    pathname: string;
    searchParams: SearchParams;
    /** Params to drop when switching, e.g. pagination or sorting that only applies to one view. */
    reset?: string[];
}

/** Segmented link control for ?view=. Uses aria-current so it reads as navigation, not a form control. */
export function ViewToggle({ label, options, active, defaultValue, pathname, searchParams, reset = [] }: ViewToggleProps) {
    const items = options.map((option) => {
        const updates: Record<string, string | null> = { view: option.value === defaultValue ? null : option.value };
        reset.forEach((key) => (updates[key] = null));
        return {
            href: hrefWith(pathname, searchParams, updates),
            label: option.label,
            icon: option.icon,
            active: option.value === active,
        };
    });
    return <SegmentedLinks label={label} items={items} />;
}
