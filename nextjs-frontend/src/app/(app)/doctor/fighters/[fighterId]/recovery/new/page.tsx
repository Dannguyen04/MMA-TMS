import type { Metadata } from "next";

import { NewRecoveryView } from "@/components/doctor/views/new-recovery-view";

export const metadata: Metadata = { title: "Kế hoạch phục hồi mới" };

export default async function Page({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/recovery/new">) {
    const [p, query] = await Promise.all([params, searchParams]);
    return <NewRecoveryView query={{ ...query, fighter: p.fighterId }} />;
}
