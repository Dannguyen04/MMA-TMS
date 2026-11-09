import { FilterSk, HeadSk, Skel, TableSk } from "@/components/doctor/skeletons";

/** Shown the moment the page is opened, in the page's own layout, until its data arrives. */
export default function Loading() {
    return (
        <div className="yt-page">
            <Skel label="Đang tải quan sát AI">
                <HeadSk actions={0} />
                <FilterSk n={3} />
                <TableSk rows={6} cols={4} />
            </Skel>
        </div>
    );
}
