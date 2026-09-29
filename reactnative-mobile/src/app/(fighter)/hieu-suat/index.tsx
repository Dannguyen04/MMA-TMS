import { blocked } from "@/i18n/blocked";
import {
  BlockedFighterPage,
  BlockedLink,
  EmptyBlockedList,
} from "@/screens/parity/blocked-workspace";

export default function FighterPerformanceRoute() {
  return (
    <BlockedFighterPage title={blocked.performanceNav} extra={blocked.performance}>
      <BlockedLink href={"/hieu-suat/ky-thuat"} label="Kỹ thuật (giữ chỗ)" />
      <EmptyBlockedList />
    </BlockedFighterPage>
  );
}
