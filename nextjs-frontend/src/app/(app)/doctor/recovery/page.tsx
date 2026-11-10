import type { Metadata } from "next";

import { RecoveryView } from "@/components/doctor/views/recovery-view";

export const metadata: Metadata = { title: "Kế hoạch phục hồi" };

export default async function DoctorRecoveryPage({ searchParams }: PageProps<"/doctor/recovery">) {
    return (
        <div className="yt-page">
            <RecoveryView query={await searchParams} />
        </div>
    );
}
