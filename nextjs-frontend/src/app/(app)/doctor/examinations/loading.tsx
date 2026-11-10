import { FilterSk, HeadSk, Skel, TableSk } from "@/components/doctor/skeletons";

/** Shown the moment the page is opened, in the page's own layout, until its data arrives. */
export default function Loading() {
    return (
        <div className="yt-page">
            <Skel label="Đang tải phiếu khám">
                <HeadSk />
                <FilterSk n={5} />
                <TableSk rows={7} cols={6} />
            </Skel>
        </div>
    );
}
