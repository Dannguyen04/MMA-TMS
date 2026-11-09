import { ColumnsSk, FilterSk, HeadSk, Skel } from "@/components/doctor/skeletons";

/** Shown the moment the page is opened, in the page's own layout, until its data arrives. */
export default function Loading() {
    return (
        <div className="yt-page">
            <Skel label="Đang tải giấy phép">
                <HeadSk />
                <FilterSk n={5} />
                <ColumnsSk cards={[2, 2, 1]} />
            </Skel>
        </div>
    );
}
