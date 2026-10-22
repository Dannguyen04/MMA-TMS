import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import { buildFighterJourney, type FighterJourney, type JourneyInput, type JourneyViewer } from "@/lib/domain/journey";
import { nullIfServiceFails } from "./api-helpers";
import { getClearanceStatus } from "./medical";
import { coachesForFighter, doctorsForFighter } from "./people";
import { listPlans } from "./training";
import { listVideos } from "./videos";

export type { FighterJourney } from "@/lib/domain/journey";

export interface FighterJourneyOptions {
    /** Whose words the journey speaks in. Defaults to the signed-in user's role. */
    viewer?: JourneyViewer;
    /** The fighter's plans (any status) when the page reads them anyway, so they aren't read twice. Null means unreadable. */
    plans?: Promise<JourneyInput["plans"]>;
    /** The fighter's uploads when the page reads them anyway. Null means unreadable. */
    videos?: Promise<JourneyInput["videos"]>;
}

/**
 * The fighter's journey (account → sports doctor → baseline exam → Medical Clearance → training plan → first AI
 * analysis) from the services the app already reads, all at once. Works for every role within its permissions: a read
 * the role may not make, or a service that doesn't answer, leaves that step unknown instead of failing the page.
 *
 * In API mode the clearance verdict comes from the medical dossier, which is read once per request and shared with the
 * page's own medical reads, so the journey adds no clinical access record of its own.
 */
export async function getFighterJourney(fighterId: string, options: FighterJourneyOptions = {}): Promise<FighterJourney> {
    const ids = [fighterId];
    const [viewer, doctors, coaches, status, plans, videos] = await Promise.all([
        options.viewer ?? getCurrentUser().then((user) => user?.role ?? "fighter"),
        nullIfServiceFails(doctorsForFighter(fighterId)),
        nullIfServiceFails(coachesForFighter(fighterId)),
        nullIfServiceFails(getClearanceStatus(fighterId)),
        options.plans ?? nullIfServiceFails(listPlans({ fighterIds: ids })),
        options.videos ?? nullIfServiceFails(listVideos({ fighterIds: ids })),
    ]);
    return buildFighterJourney({
        viewer,
        doctors,
        coaches,
        eligibility: status?.eligibility ?? null,
        restricted: status?.state === "restricted",
        plans,
        videos,
    });
}
