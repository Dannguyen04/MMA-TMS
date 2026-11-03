import { ListSkeleton } from "@/components/doctor/ui";

export default function Loading() {
    return <ListSkeleton label="Đang tải phân loại hôm nay" rows={5} />;
}
