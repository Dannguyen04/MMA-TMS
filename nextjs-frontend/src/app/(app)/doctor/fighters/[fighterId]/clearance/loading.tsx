import { ColumnsSk, SecHeadSk, Skel } from "@/components/doctor/skeletons";

/** Shown under the profile header and tabs (which stay) while this section loads. */
export default function Loading() {
    return (
        <Skel label="Đang tải giấy phép">
            <SecHeadSk />
            <ColumnsSk cards={[1, 1, 1]} />
        </Skel>
    );
}
