import { SecHeadSk, Skel, TableSk } from "@/components/doctor/skeletons";

/** Shown under the profile header and tabs (which stay) while this section loads. */
export default function Loading() {
    return (
        <Skel label="Đang tải chấn thương">
            <SecHeadSk />
            <TableSk title rows={3} cols={5} />
            <TableSk title rows={2} cols={5} />
        </Skel>
    );
}
