import { FilterSk, HeadSk, Skel, TableSk } from "@/components/doctor/skeletons";

/** Shown the moment the page is opened, in the page's own layout, until its data arrives. */
export default function Loading() {
    return (
        <div className="yt-page">
            <Skel label="Đang tải danh sách võ sĩ">
                <HeadSk actions={0} />
                <FilterSk n={4} />
                <TableSk rows={8} cols={5} />
            </Skel>
        </div>
    );
}
