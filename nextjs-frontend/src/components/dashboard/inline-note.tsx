import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { TONE_SOFT, type Tone } from "@/components/ui/tone";
import { cn } from "@/lib/utils";

export interface InlineNoteProps {
    icon: LucideIcon;
    tone?: Tone;
    children: ReactNode;
    className?: string;
}

/** Small, calm tinted note inside a card: what applies and what to do. The icon is decorative; the text carries the meaning. */
export function InlineNote({ icon: Icon, tone = "neutral", children, className }: InlineNoteProps) {
    return (
        <p className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-[13px] text-pretty ring-1 ring-inset", TONE_SOFT[tone], className)}>
            <Icon aria-hidden className="mt-px size-4 shrink-0" />
            <span className="min-w-0">{children}</span>
        </p>
    );
}
