import Link from "next/link";

import { Empty } from "@/components/doctor/ui";
import { routes } from "@/lib/routes";

export default function DoctorNotFound() {
    return (
        <div className="yt-page">
            <Empty
                title="Không tìm thấy hồ sơ"
                action={
                    <Link href={routes.doctor.dashboard} className="yt-btn" data-v="primary">
                        Về Hôm nay
                    </Link>
                }
            >
                Hồ sơ này không tồn tại hoặc võ sĩ không còn được giao cho bạn.
            </Empty>
        </div>
    );
}
