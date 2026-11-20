import { campApi, type Suspension } from "@/api/fight-camp";
import { liveSuspensions, suspensionHeadline, suspensionReasonLabel } from "@/screens/fight-camp/camp-rules";

/** Pages of 50; a gym's whole suspension history fits well inside this, and the cap keeps a bad cursor from looping. */
const MAX_PAGES = 10;

/**
 * Every suspension the caller may read (the list is scope-aware: a coach gets their fighters, an admin everyone),
 * then only the ones that still limit training today or soon (UPCOMING, ACTIVE, AWAITING_CLEARANCE, graded return),
 * grouped by fighter, most binding first.
 */
export async function loadLiveSuspensionsByFighter(): Promise<Map<string, Suspension[]>> {
  const all: Suspension[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await campApi.suspensions(cursor ? { cursor } : undefined);
    all.push(...page.data);
    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  const out = new Map<string, Suspension[]>();
  for (const s of liveSuspensions(all)) {
    if (!s.fighterId) continue;
    out.set(s.fighterId, [...(out.get(s.fighterId) ?? []), s]);
  }
  return out;
}

/**
 * What a coach can act on, one fact per line (owner 2026-11-18: two lines, not one line joined by "·" and cut with
 * "…"): ["Đang đình chỉ đến 30/11", "Nghỉ bắt buộc"].
 */
export function suspensionNote(s: Suspension): string[] {
  const reason = suspensionReasonLabel[s.reason];
  return reason ? [suspensionHeadline(s), reason] : [suspensionHeadline(s)];
}
