import type { Metadata } from "next";

import { HistoryView } from "@/components/doctor/views/history-view";

export const metadata: Metadata = { title: "Lịch sử y tế" };

export default async function DoctorHistoryPage({ searchParams }: PageProps<"/doctor/history">) {
    return (
        <div className="yt-page">
            <HistoryView query={await searchParams} />
        </div>
    );
}
