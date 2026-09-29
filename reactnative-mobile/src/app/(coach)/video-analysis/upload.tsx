import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";
import { DisabledForm } from "@/screens/parity/blocked-workspace";

export default function CoachVideoUploadRoute() {
  return (
    <CoachBlockedPage title={blocked.upload} extra={blocked.relatedJobs}>
      <DisabledForm
        cta={blocked.pickVideo}
        fields={[{ label: "Tiêu đề" }, { label: "Võ sĩ" }, { label: "Ghi chú" }]}
      />
    </CoachBlockedPage>
  );
}
