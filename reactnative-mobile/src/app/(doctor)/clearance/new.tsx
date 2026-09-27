import { blocked } from "@/i18n/blocked";
import { DoctorBlockedPage } from "@/screens/doctor/blocked-page";
import { DisabledForm } from "@/screens/parity/blocked-workspace";

export default function DoctorGrantClearanceRoute() {
  return (
    <DoctorBlockedPage title={blocked.grantClearance} extra={blocked.clinicalWrite}>
      <DisabledForm fields={[{ label: "Loại giấy phép" }, { label: "Ghi chú" }]} />
    </DoctorBlockedPage>
  );
}
