import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";

/** Chưa có API backend — xem out/06-API-can-bo-sung.md. */
export default function CoachClearanceRoute() {
  return <CoachBlockedPage title={blocked.clearance} extra={"Bảng giấy phép chung chưa có. Xem giấy phép trong hồ sơ sức khỏe của từng võ sĩ."} inStack={false} />;
}
