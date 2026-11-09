import type { ReactNode } from "react";

import { PageHead } from "../ui";

/**
 * The heading of a medical list. On its own page it is the page title with its actions; inside a fighter's profile the
 * profile header is already the page title and carries the tab's action, so the list gets a plain section heading.
 */
export function ListHead({ scoped, title, sub, actions }: { scoped: boolean; title: string; sub?: ReactNode; actions?: ReactNode }) {
    if (!scoped) return <PageHead title={title} sub={sub} actions={actions} />;
    return (
        <header className="hs-sec-head">
            <div>
                <h2>{title}</h2>
                {sub && <p>{sub}</p>}
            </div>
        </header>
    );
}
