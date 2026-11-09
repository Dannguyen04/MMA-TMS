import { FilterSk, SecHeadSk, Skel, TableSk } from "@/components/doctor/skeletons";

/** Shown under the profile header and tabs (which stay) while this section loads. */
export default function Loading() {
    return (
        <Skel label="Đang tải phiếu khám">
            <SecHeadSk />
            <FilterSk n={3} />
            <TableSk rows={5} cols={6} />
        </Skel>
    );
}
