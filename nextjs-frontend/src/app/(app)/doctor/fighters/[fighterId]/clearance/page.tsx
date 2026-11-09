import type { Metadata } from "next";

import { ClearanceView } from "@/components/doctor/views/clearance-view";

export const metadata: Metadata = { title: "Giấy phép" };

export default async function FighterClearancePage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/clearance">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <ClearanceView query={query} fighterId={fighterId} />;
}
