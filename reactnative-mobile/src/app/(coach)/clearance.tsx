import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";
import { CoachBanner } from "@/screens/coach/coach-ui";

export default function CoachClearanceRoute() {
  return (
    <CoachBlockedPage title={blocked.clearance} extra={blocked.clearanceRead} inStack={false}>
      <CoachBanner message="Bảng giấy phép tổng: chỉ đọc tóm tắt trên hồ sơ võ sĩ (medical-summary). Không có board riêng trên Nest." />
    </CoachBlockedPage>
  );
}
