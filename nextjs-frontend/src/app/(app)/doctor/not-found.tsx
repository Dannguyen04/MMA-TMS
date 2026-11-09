import { Empty } from "@/components/doctor/ui";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export default function DoctorNotFound() {
    return (
        <div className="flex flex-col gap-6">
            <Empty
                title="Không tìm thấy hồ sơ"
                action={
                    <ButtonLink href={routes.doctor.dashboard}>Về Hôm nay</ButtonLink>
                }
            >
                Hồ sơ này không tồn tại hoặc võ sĩ không còn được giao cho bạn.
            </Empty>
        </div>
    );
}
