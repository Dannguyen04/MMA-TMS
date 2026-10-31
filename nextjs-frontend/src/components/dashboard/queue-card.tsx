import { ListTodo, type LucideIcon } from "lucide-react";

import { AttentionList, type AttentionItem } from "@/components/medical/attention-list";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { createTranslator, plural, type Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

/** The unfiltered queue shows this many; picking a group shows all of it. */
const QUEUE_PREVIEW = 8;

export interface QueueGroupMeta {
    label: string;
    icon: LucideIcon;
    /** What an empty group says. */
    empty: { title: string; description: string };
}

export interface QueueCardProps<Q extends string> {
    title: string;
    /** Accessible name of the group filter. */
    filterLabel: string;
    /** Every item, most urgent first; each carries its `group`. */
    items: AttentionItem[];
    /** Groups offered on this page, in filter order. */
    queues: readonly Q[];
    meta: Record<Q, QueueGroupMeta>;
    /** The selected group, or undefined for all of them. */
    active: Q | undefined;
    /** Link that selects a group (null for all). */
    hrefFor: (queue: Q | null) => string;
    /** What the whole queue says when nothing is waiting. */
    emptyAll: { title: string; description: string };
    /** The viewer's language; English when omitted. */
    t?: Translator;
    className?: string;
}

/**
 * A role's Today queue (coach corner queue, doctor triage): one list, most urgent first, filtered by group through the
 * URL. Empty groups stay out of the filter unless they're the one selected.
 */
export function QueueCard<Q extends string>({
    title,
    filterLabel,
    items,
    queues,
    meta,
    active,
    hrefFor,
    emptyAll,
    t = createTranslator("en"),
    className,
}: QueueCardProps<Q>) {
    const inQueue = active ? items.filter((item) => item.group === active) : items;
    const shown = active ? inQueue : inQueue.slice(0, QUEUE_PREVIEW);

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader
                title={title}
                icon={<ListTodo />}
                description={items.length > 0 ? plural(t, "queue.items", items.length) : t("queue.allClear")}
            />
            {items.length > 0 && (
                <div className="border-t border-border px-5 py-3">
                    <SegmentedLinks
                        label={filterLabel}
                        items={[
                            { href: hrefFor(null), label: t("queue.all"), count: items.length, active: !active },
                            ...queues
                                .map((queue) => ({
                                    href: hrefFor(queue),
                                    label: meta[queue].label,
                                    icon: meta[queue].icon,
                                    count: items.filter((item) => item.group === queue).length,
                                    active: active === queue,
                                }))
                                .filter((chip) => chip.count > 0 || chip.active),
                        ]}
                    />
                </div>
            )}
            <AttentionList
                items={shown}
                empty={active ? meta[active].empty : emptyAll}
                forFighter={(name) => t("queue.forFighter", { name })}
                className="border-t border-border"
            />
            {!active && inQueue.length > shown.length && (
                <CardFooter className="text-fg-muted">
                    {t("queue.showing", { shown: shown.length, total: inQueue.length })}
                </CardFooter>
            )}
        </Card>
    );
}
