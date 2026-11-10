import type { Metadata } from "next";

import { ExaminationDetail, examinationMetadata } from "@/components/doctor/views/examination-detail";

export async function generateMetadata({ params }: PageProps<"/doctor/fighters/[fighterId]/examinations/[examId]">): Promise<Metadata> {
    return examinationMetadata((await params).examId);
}

export default async function Page({ params, searchParams }: PageProps<"/doctor/fighters/[fighterId]/examinations/[examId]">) {
    const [p, query] = await Promise.all([params, searchParams]);
    return <ExaminationDetail examId={p.examId} query={query} fighterId={p.fighterId} />;
}
