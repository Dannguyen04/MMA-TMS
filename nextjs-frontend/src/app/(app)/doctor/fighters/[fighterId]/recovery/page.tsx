import type { Metadata } from "next";

import { RecoveryView } from "@/components/doctor/views/recovery-view";

export const metadata: Metadata = { title: "Phục hồi" };

export default async function FighterRecoveryPage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/recovery">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <RecoveryView query={query} fighterId={fighterId} />;
}
