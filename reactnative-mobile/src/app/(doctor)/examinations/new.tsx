import { blocked } from "@/i18n/blocked";
import { DoctorBlockedPage } from "@/screens/doctor/blocked-page";
import { DisabledForm } from "@/screens/parity/blocked-workspace";

export default function DoctorNewExamRoute() {
  return (
    <DoctorBlockedPage title={blocked.newExam} extra={blocked.clinicalWrite}>
      <DisabledForm
        fields={[
          { label: "Loại khám (web mock: examination type)" },
          { label: "Tóm tắt" },
          { label: "Khuyến nghị" },
        ]}
      />
    </DoctorBlockedPage>
  );
}
