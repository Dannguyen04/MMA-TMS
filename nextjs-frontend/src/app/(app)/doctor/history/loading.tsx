import { FilterSk, HeadSk, HistorySk, Skel } from "@/components/doctor/skeletons";

/** Shown the moment the page is opened, in the page's own layout, until its data arrives. */
export default function Loading() {
    return (
        <div className="yt-page">
            <Skel label="Đang tải lịch sử y tế">
                <HeadSk actions={0} />
                <FilterSk n={6} />
                <HistorySk />
            </Skel>
        </div>
    );
}
