import { HeadSk, Skel, TableSk } from "@/components/doctor/skeletons";

/** Shown the moment the page is opened, in the page's own layout, until its data arrives. */
export default function Loading() {
    return (
        <div className="yt-page">
            <Skel label="Đang tải bệnh án">
                <HeadSk actions={0} />
                <TableSk rows={8} cols={5} />
            </Skel>
        </div>
    );
}
