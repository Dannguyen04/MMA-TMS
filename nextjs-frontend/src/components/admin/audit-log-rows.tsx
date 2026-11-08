"use client";

import { Bot, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Avatar } from "@/components/ui/avatar";
import { DescriptionList } from "@/components/ui/description-list";
import type { AuditLog } from "@/lib/domain/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { actorCaption, auditResourceLabel } from "./admin-format";
import { AuditStatus } from "./admin-badges";

const COLUMN_COUNT = 7;

/** Audit table body with rows that expand in place to show the full entry. */
export function AuditLogRows({ entries, now }: { entries: AuditLog[]; now: string }) {
    const [expanded, setExpanded] = useState<string | null>(null);
    const t = useT();
    const locale = t.locale === "en" ? "en" : "vi";

    return (
        <tbody className="divide-y divide-border">
            {entries.map((entry) => {
                const open = expanded === entry.id;
                const detailsId = `audit-details-${entry.id}`;
                return (
                    <Fragment key={entry.id}>
                        <tr className={cn("transition-colors hover:bg-surface-muted/50", open && "bg-surface-muted/50")}>
                            <td className="w-10 py-2 pr-0 pl-3 align-middle">
                                <button
                                    type="button"
                                    onClick={() => setExpanded(open ? null : entry.id)}
                                    aria-expanded={open}
                                    aria-controls={detailsId}
                                    className="flex size-8 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-hover hover:text-fg"
                                >
                                    <ChevronRight aria-hidden className={cn("size-4 transition-transform", open && "rotate-90")} />
                                    <span className="sr-only">
                                        {t("adminBody.audit.detailsFor", { verb: open ? t("adminBody.audit.hide") : t("adminBody.audit.show"), action: entry.action, name: entry.actorName })}
                                    </span>
                                </button>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                                <time dateTime={entry.timestamp} className="text-fg">
                                    {formatDateTime(entry.timestamp)}
                                </time>
                                <span className="block text-xs text-fg-subtle">{formatRelative(entry.timestamp, now, locale)}</span>
                            </td>
                            <td className="px-4 py-3">
                                <span className="flex items-center gap-2 whitespace-nowrap">
                                    {entry.actorRole === "system" ? (
                                        <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-ai-soft text-ai-fg ring-1 ring-ai-border">
                                            <Bot className="size-3.5" />
                                        </span>
                                    ) : (
                                        <Avatar name={entry.actorName} size="xs" shape={entry.actorRole === "fighter" ? "octagon" : "circle"} />
                                    )}
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium text-fg">{entry.actorName}</span>
                                        <span className="block text-xs text-fg-subtle">{actorCaption(entry.actorRole, t)}</span>
                                    </span>
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs whitespace-nowrap text-fg ring-1 ring-border ring-inset">
                                    {entry.action}
                                </code>
                            </td>
                            <td className="max-w-60 px-4 py-3">
                                <span className="block text-xs text-fg-subtle">{auditResourceLabel(t, entry.resourceType)}</span>
                                <span className="block truncate text-sm text-fg" title={entry.resourceLabel}>
                                    {entry.resourceLabel}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                <AuditStatus status={entry.status} compact />
                            </td>
                            <td className="px-4 py-3 pr-5 font-mono text-xs whitespace-nowrap text-fg-muted">{entry.ipAddress}</td>
                        </tr>
                        <tr id={detailsId} hidden={!open} className="bg-surface-muted/40">
                            <td colSpan={COLUMN_COUNT} className="px-5 pt-3 pb-4 pl-[3.25rem]">
                                <DescriptionList
                                    columns={3}
                                    items={[
                                        { label: t("adminBody.audit.details"), value: entry.details ?? <span className="font-normal text-fg-subtle">{t("adminBody.audit.noDetails")}</span>, wide: true },
                                        { label: t("adminBody.audit.resource"), value: `${auditResourceLabel(t, entry.resourceType)} · ${entry.resourceLabel}` },
                                        { label: t("adminBody.audit.resourceId"), value: <code className="font-mono text-[13px]">{entry.resourceId}</code> },
                                        { label: t("adminBody.audit.entryId"), value: <code className="font-mono text-[13px]">{entry.id}</code> },
                                        { label: t("adminBody.audit.actorId"), value: entry.actorId ? <code className="font-mono text-[13px]">{entry.actorId}</code> : t("adminBody.audit.systemProcess") },
                                        { label: t("adminBody.audit.exactTime"), value: <code className="font-mono text-[13px]">{entry.timestamp}</code> },
                                        { label: t("adminBody.audit.ip"), value: <code className="font-mono text-[13px]">{entry.ipAddress}</code> },
                                    ]}
                                />
                            </td>
                        </tr>
                    </Fragment>
                );
            })}
        </tbody>
    );
}
