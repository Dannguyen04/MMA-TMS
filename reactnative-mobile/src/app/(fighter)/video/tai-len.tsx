import { blocked } from "@/i18n/blocked";
import { BlockedFighterPage, DisabledForm } from "@/screens/parity/blocked-workspace";

export default function FighterUploadRoute() {
  return (
    <BlockedFighterPage title={blocked.upload} extra={blocked.relatedJobs}>
      <DisabledForm
        cta={blocked.pickVideo}
        fields={[
          { label: "Tiêu đề" },
          { label: "Loại tập (web: video training type)" },
          { label: "Góc máy (front / side / diagonal trên web mock)" },
          { label: "Ghi chú" },
        ]}
      />
    </BlockedFighterPage>
  );
}
