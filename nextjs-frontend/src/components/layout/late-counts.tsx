import { Suspense, type ReactNode } from "react";

import type { NavCounts } from "./sidebar-nav";

type Render = (counts: NavCounts) => ReactNode;

async function Resolved({ base, late, render }: { base: NavCounts; late: Promise<NavCounts>; render: Render }) {
    const extra = await late;
    return render({ ...base, ...extra });
}

/**
 * Renders navigation with the badge counts known now, then swaps in the slower ones
 * (the doctor's triage counts) when they arrive, so the shell never waits on them.
 */
export function NavCountsSlot({ base, late, render }: { base: NavCounts; late?: Promise<NavCounts>; render: Render }) {
    if (!late) return render(base);
    return (
        <Suspense fallback={render(base)}>
            <Resolved base={base} late={late} render={render} />
        </Suspense>
    );
}
