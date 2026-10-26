import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";
import { CoachBanner } from "@/screens/coach/coach-ui";

export default function CoachClearanceRoute() {
  return (
    <CoachBlockedPage title={blocked.clearance} extra={blocked.clearanceRead} inStack={false}>
      <CoachBanner message="Chưa có bảng giấy phép chung. Xem giấy phép trong hồ sơ của từng võ sĩ." />
    </CoachBlockedPage>
  );
}
