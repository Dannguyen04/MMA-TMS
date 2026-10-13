import { CARE_ROLE_LABELS, type CareRole, type CareTeamMember } from "./care-team";

/**
 * Whether a role's assignments changed since the administrator saw them, and what to tell them if so. Several
 * administrators get the same "assign a doctor" notification: the care team card reads the team again before its
 * form opens, and the assignment is refused if it changed after that, so nobody writes a second assignment by
 * accident. Safe for Server and Client Components.
 *
 * @param seen The role's staff ids as the administrator last saw them.
 * @param current The role's current members.
 * @returns A sentence saying what changed, or null when nothing did.
 */
export function careTeamChange(role: CareRole, seen: readonly string[], current: readonly Pick<CareTeamMember, "staffId" | "name">[]): string | null {
    const added = current.filter((member) => !seen.includes(member.staffId));
    if (added.length > 0) {
        const names = listNames(added.map((member) => member.name));
        return `${names} ${added.length === 1 ? "was" : "were"} assigned as ${CARE_ROLE_LABELS[role]} while this page was open. Check the care team before adding anyone else.`;
    }
    const ended = seen.some((staffId) => !current.some((member) => member.staffId === staffId));
    return ended ? `The ${CARE_ROLE_LABELS[role]} assignments changed while this page was open. Check the care team before assigning anyone.` : null;
}

function listNames(names: string[]): string {
    return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
