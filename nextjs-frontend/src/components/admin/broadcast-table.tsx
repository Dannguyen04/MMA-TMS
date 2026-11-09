import { RoleBadge } from "@/components/domain/status-badges";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { NotificationBroadcast } from "@/lib/domain/types";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type Translator } from "@/lib/i18n/translate";
import { BroadcastStatusBadge, ChannelLabel } from "./admin-badges";
import { countLabel } from "./admin-format";

export interface BroadcastTableProps {
    broadcasts: NotificationBroadcast[];
    caption: string;
    now: string;
    creatorNames: Record<string, string>;
    /** The viewer's language. */
    locale: Locale;
}

function whenFor(broadcast: NotificationBroadcast, t: Translator): { label: string; iso: string } {
    if (broadcast.status === "sent" && broadcast.sentAt) return { label: t("screens.admin.broadcastTable.sent"), iso: broadcast.sentAt };
    if (broadcast.status === "scheduled" && broadcast.scheduledFor) return { label: t("screens.admin.broadcastTable.sends"), iso: broadcast.scheduledFor };
    return { label: t("screens.admin.broadcastTable.created"), iso: broadcast.createdAt };
}

/**
 * Broadcast list with audience, channel, status, timing and reach. Fixed column widths keep the
 * Scheduled, Drafts and Sent tables aligned with each other; phones get a stacked list.
 */
export function BroadcastTable({ broadcasts, caption, now, creatorNames, locale }: BroadcastTableProps) {
    const t = createTranslator(locale);
    const creator = (broadcast: NotificationBroadcast) => creatorNames[broadcast.createdById] ?? t("screens.admin.broadcastTable.formerAdmin");

    return (
        <>
            <ul className="divide-y divide-border md:hidden" aria-label={caption}>
                {broadcasts.map((broadcast) => {
                    const when = whenFor(broadcast, t);
                    return (
                        <li key={broadcast.id} className="flex flex-col gap-2 px-4 py-3.5">
                            <div className="flex items-start justify-between gap-3">
                                <p className="min-w-0 text-sm font-medium text-fg">{broadcast.title}</p>
                                <BroadcastStatusBadge status={broadcast.status} size="sm" className="shrink-0" locale={locale} />
                            </div>
                            <p className="line-clamp-2 text-[13px] text-fg-muted">{broadcast.body}</p>
                            <div className="flex flex-wrap gap-1">
                                {broadcast.audience.map((role) => (
                                    <RoleBadge key={role} role={role} size="sm" locale={locale} />
                                ))}
                            </div>
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                                <ChannelLabel channel={broadcast.channel} locale={locale} />
                                <span>
                                    {when.label}{" "}
                                    <time dateTime={when.iso} title={formatRelative(when.iso, now, locale)}>
                                        {formatDateTime(when.iso, locale)}
                                    </time>
                                </span>
                                {broadcast.status !== "draft" && <span>{countLabel(t, "screens.admin.count.recipients", broadcast.recipientCount)}</span>}
                                <span>{t("screens.admin.broadcastTable.by", { name: creator(broadcast) })}</span>
                            </p>
                        </li>
                    );
                })}
            </ul>

            <div className="hidden md:block">
                <Table caption={caption} className="min-w-[860px] table-fixed">
                    <colgroup>
                        <col className="w-[32%]" />
                        <col className="w-[20%]" />
                        <col className="w-[14%]" />
                        <col className="w-[10%]" />
                        <col className="w-[16%]" />
                        <col className="w-[8%]" />
                    </colgroup>
                    <THead>
                        <tr>
                            <TH>{t("screens.admin.broadcastTable.broadcast")}</TH>
                            <TH>{t("screens.admin.broadcastTable.audience")}</TH>
                            <TH>{t("screens.admin.broadcastTable.channel")}</TH>
                            <TH>{t("screens.admin.common.status")}</TH>
                            <TH>{t("screens.admin.broadcastTable.when")}</TH>
                            <TH className="text-right">{t("screens.admin.broadcastTable.recipients")}</TH>
                        </tr>
                    </THead>
                    <TBody>
                        {broadcasts.map((broadcast) => {
                            const when = whenFor(broadcast, t);
                            return (
                                <TR key={broadcast.id}>
                                    <TD>
                                        <p className="font-medium text-fg">{broadcast.title}</p>
                                        <p className="mt-0.5 truncate text-[13px] text-fg-muted" title={broadcast.body}>
                                            {broadcast.body}
                                        </p>
                                        <p className="mt-0.5 text-xs text-fg-subtle">{t("screens.admin.broadcastTable.by", { name: creator(broadcast) })}</p>
                                    </TD>
                                    <TD>
                                        <span className="flex flex-wrap gap-1">
                                            {broadcast.audience.map((role) => (
                                                <RoleBadge key={role} role={role} size="sm" locale={locale} />
                                            ))}
                                        </span>
                                    </TD>
                                    <TD className="text-[13px]">
                                        <ChannelLabel channel={broadcast.channel} locale={locale} />
                                    </TD>
                                    <TD>
                                        <BroadcastStatusBadge status={broadcast.status} size="sm" locale={locale} />
                                    </TD>
                                    <TD>
                                        <span className="block text-xs text-fg-subtle">{when.label}</span>
                                        <time dateTime={when.iso} title={formatRelative(when.iso, now, locale)} className="text-[13px] whitespace-nowrap text-fg">
                                            {formatDateTime(when.iso, locale)}
                                        </time>
                                    </TD>
                                    <TD className="text-right">
                                        {broadcast.status === "draft" ? <span className="text-fg-subtle">—</span> : formatNumber(broadcast.recipientCount)}
                                    </TD>
                                </TR>
                            );
                        })}
                    </TBody>
                </Table>
            </div>
        </>
    );
}
