import type { Metadata } from "next";

import { ClearanceView } from "@/components/doctor/views/clearance-view";

export const metadata: Metadata = { title: "Giấy phép" };

export default async function DoctorClearancePage({ searchParams }: PageProps<"/doctor/medical-clearance">) {
    return (
        <div className="yt-page">
            <ClearanceView query={await searchParams} />
        </div>
    );
}
