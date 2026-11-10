import { FormSk, HeadSk, Skel } from "@/components/doctor/skeletons";

/** Shown the moment the page is opened, in the page's own layout, until its data arrives. */
export default function Loading() {
    return (
        <div className="yt-page">
            <Skel label="Đang tải biểu mẫu kế hoạch">
                <HeadSk actions={0} />
                <FormSk />
            </Skel>
        </div>
    );
}
