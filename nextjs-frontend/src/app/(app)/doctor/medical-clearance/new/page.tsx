import type { Metadata } from "next";

import { NewClearanceView } from "@/components/doctor/new-clearance-view";

export const metadata: Metadata = { title: "Cập nhật giấy phép" };

export default async function GrantClearancePage({ searchParams }: PageProps<"/doctor/medical-clearance/new">) {
    return <NewClearanceView query={await searchParams} />;
}
