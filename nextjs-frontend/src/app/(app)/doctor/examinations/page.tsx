import type { Metadata } from "next";

import { ExaminationsView } from "@/components/doctor/views/examinations-view";

export const metadata: Metadata = { title: "Phiếu khám" };

export default async function DoctorExaminationsPage({ searchParams }: PageProps<"/doctor/examinations">) {
    return (
        <div className="yt-page">
            <ExaminationsView query={await searchParams} />
        </div>
    );
}
