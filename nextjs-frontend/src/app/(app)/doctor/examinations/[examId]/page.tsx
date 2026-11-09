import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { examinationMetadata, examinationOwner } from "@/components/doctor/views/examination-detail";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/doctor/examinations/[examId]">): Promise<Metadata> {
    return examinationMetadata((await params).examId);
}

/** Kept for old links and redirects: the record always opens inside its fighter's profile. */
export default async function ExaminationDetailPage({ params, searchParams }: PageProps<"/doctor/examinations/[examId]">) {
    const [{ examId }, query] = await Promise.all([params, searchParams]);
    const fighterId = await examinationOwner(examId);
    if (!fighterId) notFound();
    redirect(hrefWith(routes.doctor.fighterExamination(fighterId, examId), query, {}));
}
