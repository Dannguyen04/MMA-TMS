import type { Metadata } from "next";

import { LabWorkbench } from "@/components/lab/lab-workbench";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Phòng thử UI" };

/** Prototype bench for T-042 / T-043: every variant on one page, static data only. */
export default async function LabPage({ searchParams }: { searchParams: Promise<{ phan?: string }> }) {
    const { phan } = await searchParams;
    return (
        <div className="mx-auto w-full max-w-7xl">
            <PageHeader
                title="Phòng thử UI"
                description="Bản thử cho cơ thể 3D, diễn lại hiệp và dòng thời gian camp. Dữ liệu mẫu, dùng đúng các trường app đang lưu."
            />
            <LabWorkbench defaultTab={phan} />
        </div>
    );
}
