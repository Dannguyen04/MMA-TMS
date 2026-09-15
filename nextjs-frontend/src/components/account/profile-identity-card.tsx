import { Mail, Phone } from "lucide-react";

import { RoleBadge, UserStatusBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import type { User } from "@/lib/domain/types";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";

export interface ProfileIdentityCardProps {
    user: Pick<User, "name" | "email" | "phone" | "role" | "title" | "status" | "createdAt" | "lastActiveAt">;
    /** Fighter ring name, shown after the name. */
    nickname?: string | null;
    /** One line of key facts under the title, e.g. discipline and weight class. */
    facts?: string[];
    now: string;
}

/** Who you are on the platform: avatar, name, role and contact details. */
export function ProfileIdentityCard({ user, nickname, facts, now }: ProfileIdentityCardProps) {
    const isFighter = user.role === "fighter";
    const factLine = (facts ?? []).filter((fact) => fact && fact !== user.title);

    return (
        <Card className="min-w-0">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5">
                <Avatar name={user.name} size="xl" shape={isFighter ? "octagon" : "circle"} className="max-sm:size-16 max-sm:text-xl" />
                <div className="min-w-0">
                    <h2 className="text-xl leading-tight font-semibold tracking-tight text-balance text-fg">
                        {user.name}
                        {nickname && <span className="ml-2 text-base font-normal tracking-normal text-fg-muted">“{nickname}”</span>}
                    </h2>
                    <p className="mt-1 text-sm text-fg-muted">{user.title}</p>
                    {factLine.length > 0 && <p className="mt-0.5 text-[13px] text-fg-subtle">{factLine.join(" · ")}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <RoleBadge role={user.role} />
                        <UserStatusBadge status={user.status} />
                    </div>
                </div>
            </div>
            <div className="border-t border-border px-5 py-4">
                <DescriptionList
                    items={[
                        {
                            label: "Email",
                            value: (
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <Mail aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
                                    <span className="break-all">{user.email}</span>
                                </span>
                            ),
                        },
                        {
                            label: "Phone",
                            value: user.phone ? (
                                <span className="flex items-center gap-1.5">
                                    <Phone aria-hidden className="size-3.5 shrink-0 text-fg-subtle" />
                                    {user.phone}
                                </span>
                            ) : (
                                <span className="font-normal text-fg-subtle">Not added</span>
                            ),
                        },
                        {
                            label: "Member since",
                            value: (
                                <span>
                                    <time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time>
                                    <span className="font-normal text-fg-muted"> · {formatRelative(user.createdAt, now)}</span>
                                </span>
                            ),
                        },
                        {
                            label: "Last active",
                            value: user.lastActiveAt ? (
                                <time dateTime={user.lastActiveAt} title={formatDateTime(user.lastActiveAt)}>
                                    {formatRelative(user.lastActiveAt, now)}
                                </time>
                            ) : (
                                <span className="font-normal text-fg-subtle">Not signed in yet</span>
                            ),
                        },
                    ]}
                />
            </div>
        </Card>
    );
}
