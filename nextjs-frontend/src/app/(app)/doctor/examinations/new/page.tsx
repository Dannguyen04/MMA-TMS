import type { Metadata } from "next";

import { NewExaminationView } from "@/components/doctor/new-examination-view";

export const metadata: Metadata = { title: "Phiếu khám mới" };

export default async function NewExaminationPage({ searchParams }: PageProps<"/doctor/examinations/new">) {
    return <NewExaminationView query={await searchParams} />;
}
