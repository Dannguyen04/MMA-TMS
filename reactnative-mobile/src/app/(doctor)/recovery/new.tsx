import { blocked } from "@/i18n/blocked";
import { DoctorBlockedPage } from "@/screens/doctor/blocked-page";
import { DisabledForm } from "@/screens/parity/blocked-workspace";

export default function DoctorNewRecoveryRoute() {
  return (
    <DoctorBlockedPage title="Kế hoạch hồi phục mới" extra={blocked.clinicalWrite}>
      <DisabledForm fields={[{ label: "Tóm tắt" }, { label: "Ghi chú" }]} />
    </DoctorBlockedPage>
  );
}
