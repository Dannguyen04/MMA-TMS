import { blocked } from "@/i18n/blocked";
import { DoctorBlockedPage } from "@/screens/doctor/blocked-page";
import { DisabledForm } from "@/screens/parity/blocked-workspace";

export default function DoctorNewInjuryRoute() {
  return (
    <DoctorBlockedPage title={blocked.newInjury} extra={blocked.clinicalWrite}>
      <DisabledForm
        fields={[
          { label: "Loại (web mock injury type)" },
          { label: "Vùng cơ thể" },
          { label: "Mô tả" },
        ]}
      />
    </DoctorBlockedPage>
  );
}
