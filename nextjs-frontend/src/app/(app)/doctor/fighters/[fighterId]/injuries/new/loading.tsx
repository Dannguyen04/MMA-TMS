import { FormSk, HeadSk, Skel } from "@/components/doctor/skeletons";

/** Shown under the profile header and tabs (which stay) while this section loads. */
export default function Loading() {
    return (
        <Skel label="Đang tải biểu mẫu chấn thương">
            <HeadSk actions={0} />
            <FormSk />
        </Skel>
    );
}
