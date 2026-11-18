import { Suspense } from "react";

import { FighterHead } from "@/components/doctor/fighter-head";
import { FighterTabs } from "@/components/doctor/fighter-nav";
import { loadFighterRow } from "@/components/doctor/fighter-row";
import { FighterHeadSk } from "@/components/doctor/skeletons";

/**
 * The fighter's header and tabs, shared by every page of the profile. As a layout it stays mounted while the doctor
 * moves between tabs, so only the tab's content below is fetched and rendered again. On first open the header streams
 * in behind a placeholder (with the real tabs already usable), so the profile appears at once instead of after its data.
 */
export default async function FighterProfileLayout({ params, children }: LayoutProps<"/doctor/fighters/[fighterId]">) {
    const { fighterId } = await params;
    return (
        <div className="yt-page">
            <Suspense fallback={<FighterHeadSk tabs={<FighterTabs fighterId={fighterId} />} />}>
                <FighterHeader fighterId={fighterId} />
            </Suspense>
            {children}
        </div>
    );
}

async function FighterHeader({ fighterId }: { fighterId: string }) {
    const { row } = await loadFighterRow(fighterId);
    return <FighterHead fighter={row.fighter} training={row.training} competition={row.competition} tag={row.tag} items={row.items} />;
}
