import type { Tone } from "@/components/ui/tone";

/**
 * Triage order: what blocks training first (danger), then what is about to (warning), then AI observations for a
 * clinician's eye, then routine items. Within one urgency the item that fell due earliest goes first, so an overdue
 * follow-up is never buried under a clearance that merely expires soon. Pure, so the order is tested.
 */
const URGENCY: Partial<Record<Tone, number>> = { danger: 0, warning: 1, ai: 2, info: 3 };
const LAST = 9;

export interface TriageSortable {
    tone: Tone;
    /** ISO time the item fell or falls due; items without one go after dated items of the same urgency. */
    at?: string;
}

function compareTriage(a: TriageSortable, b: TriageSortable): number {
    const urgency = (URGENCY[a.tone] ?? LAST) - (URGENCY[b.tone] ?? LAST);
    if (urgency !== 0) return urgency;
    if (a.at && b.at) return a.at.localeCompare(b.at);
    return a.at ? -1 : b.at ? 1 : 0;
}

/** A sorted copy; items that compare equal keep their order. */
export function sortTriage<T extends TriageSortable>(items: readonly T[]): T[] {
    return [...items].sort(compareTriage);
}
