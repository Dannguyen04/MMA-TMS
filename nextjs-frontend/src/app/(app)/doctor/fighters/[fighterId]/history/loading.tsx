import { FilterSk, HistorySk, SecHeadSk, Skel } from "@/components/doctor/skeletons";

/** Shown under the profile header and tabs (which stay) while this section loads. */
export default function Loading() {
    return (
        <Skel label="Đang tải lịch sử y tế">
            <SecHeadSk action={false} />
            <FilterSk n={6} />
            <HistorySk />
        </Skel>
    );
}
