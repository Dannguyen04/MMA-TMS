import { blocked } from "@/i18n/blocked";
import { CoachBlockedPage } from "@/screens/coach/blocked-page";

/** Chưa có API backend — xem out/06-API-can-bo-sung.md. */
export default function CoachPerformanceRoute() {
  return <CoachBlockedPage title={blocked.performanceNav} extra={"Hiệu suất và kỹ thuật của võ sĩ sẽ hiển thị tại đây."} inStack={false} />;
}
