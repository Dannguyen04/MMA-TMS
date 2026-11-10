import type { Metadata } from "next";

import { NewExaminationView } from "@/components/doctor/new-examination-view";

export const metadata: Metadata = { title: "Tạo phiếu khám" };

export default async function FighterNewExaminationPage({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/examinations/new">) {
    const [{ fighterId }, query] = await Promise.all([params, searchParams]);
    return <NewExaminationView query={query} fighterId={fighterId} />;
}
