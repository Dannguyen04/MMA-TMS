import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";

import { HealthStatusBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import type { Fighter } from "@/lib/domain/types";

export interface FighterChooserProps {
    fighters: Fighter[];
    /** Link for a chosen fighter, e.g. the same form with ?fighter=. */
    hrefFor: (fighterId: string) => string;
    /** The question the form asks, e.g. "Who did you examine?". */
    title: string;
    /** A fighter was chosen but their medical record couldn't be read: the chooser asks again and says why. */
    unreadable?: Fighter;
}

/**
 * First step of a clinical form: pick the fighter. Every clinical read is audited, so a form loads one fighter's
 * record after this choice instead of every assigned fighter's up front.
 */
export function FighterChooser({ fighters, hrefFor, title, unreadable }: FighterChooserProps) {
    return (
        <Card className="max-w-2xl overflow-hidden">
            <CardHeader
                title={unreadable ? `Không đọc được hồ sơ y tế của ${unreadable.name}` : title}
                description={unreadable ? "Có thể bạn không còn phụ trách võ sĩ này. Hãy chọn lại." : "Chỉ hiện võ sĩ bạn phụ trách."}
                icon={<Users />}
            />
            {fighters.length === 0 ? (
                <EmptyState compact icon={<Users />} title="Chưa có võ sĩ được phân công" description="Quản trị viên phân công võ sĩ cho bạn. Hãy hỏi nếu thiếu ai." className="border-t border-border" />
            ) : (
                <ul className="divide-y divide-border border-t border-border">
                    {[...fighters]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((fighter) => (
                            <li key={fighter.id}>
                                <Link href={hrefFor(fighter.id)} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover">
                                    <Avatar name={fighter.name} shape="octagon" size="sm" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-fg">{fighter.name}</span>
                                        <span className="block text-[13px] text-fg-muted">{WEIGHT_CLASS_LABELS[fighter.weightClass]}</span>
                                    </span>
                                    <HealthStatusBadge status={fighter.healthStatus} size="sm" />
                                    <ChevronRight aria-hidden className="size-4 text-fg-subtle" />
                                </Link>
                            </li>
                        ))}
                </ul>
            )}
        </Card>
    );
}
