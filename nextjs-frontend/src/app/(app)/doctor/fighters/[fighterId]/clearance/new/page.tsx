import type { Metadata } from "next";

import { NewClearanceView } from "@/components/doctor/new-clearance-view";

export const metadata: Metadata = { title: "Cấp giấy phép" };

export default async function FighterGrantClearancePage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/clearance/new">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <NewClearanceView query={query} fighterId={fighterId} />;
}
