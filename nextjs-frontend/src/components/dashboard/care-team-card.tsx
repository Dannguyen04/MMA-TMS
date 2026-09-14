import { UsersRound } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CareTeamMember {
    id: string;
    name: string;
    /** Job title from the account, e.g. "Sports Medicine Physician". */
    title: string;
    specialty: string;
    role: "doctor" | "coach";
    primary?: boolean;
}

/** Lower-case words without dashes, so "Sports-medicine physician" matches "Sports Medicine Physician". */
const comparable = (text: string) =>
    text
        .toLowerCase()
        .replace(/[-\u2010-\u2015]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

/** The specialty only adds information when the job title doesn't already say it. */
function specialtyToShow({ title, specialty }: CareTeamMember): string | null {
    const words = comparable(specialty);
    return words && !comparable(title).includes(words) ? specialty : null;
}

/** The sports doctors and coaches looking after a fighter. */
export function CareTeamCard({ members, className }: { members: CareTeamMember[]; className?: string }) {
    const groups: { label: string; items: CareTeamMember[] }[] = [
        { label: "Sports medicine", items: members.filter((member) => member.role === "doctor") },
        { label: "Coaching", items: members.filter((member) => member.role === "coach") },
    ];

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title="Your care team" icon={<UsersRound />} />
            <div className="flex flex-col gap-4 px-5 pb-5">
                {groups
                    .filter((group) => group.items.length > 0)
                    .map((group) => (
                        <div key={group.label}>
                            <h3 className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">{group.label}</h3>
                            <ul className="flex flex-col gap-3">
                                {group.items.map((member) => {
                                    const specialty = specialtyToShow(member);
                                    return (
                                        <li key={member.id} className="flex items-start gap-3">
                                            <Avatar name={member.name} size="sm" />
                                            <div className="min-w-0">
                                                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-fg">
                                                    {member.name}
                                                    {member.primary && (
                                                        <Badge size="sm" tone="primary">
                                                            {member.role === "coach" ? "Primary coach" : "Primary doctor"}
                                                        </Badge>
                                                    )}
                                                </p>
                                                <p className="text-[13px] text-fg-muted">{member.title}</p>
                                                {specialty && <p className="text-xs text-fg-subtle">{specialty}</p>}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
            </div>
        </Card>
    );
}
