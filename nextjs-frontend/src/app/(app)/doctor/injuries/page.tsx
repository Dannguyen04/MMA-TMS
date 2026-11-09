import type { Metadata } from "next";

import { InjuriesView } from "@/components/doctor/views/injuries-view";

export const metadata: Metadata = { title: "Chấn thương" };

export default async function DoctorInjuriesPage({ searchParams }: PageProps<"/doctor/injuries">) {
    return (
        <div className="yt-page">
            <InjuriesView query={await searchParams} />
        </div>
    );
}
