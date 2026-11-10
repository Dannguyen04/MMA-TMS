import { DashboardSk, Skel } from "@/components/doctor/skeletons";

/** Shown the moment the page is opened, in the page's own layout, until its data arrives. */
export default function Loading() {
    return (
        <div className="yt-page">
            <Skel label="Đang tải phân loại hôm nay">
                <DashboardSk />
            </Skel>
        </div>
    );
}
