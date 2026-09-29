import { blocked } from "@/i18n/blocked";
import {
  BlockedFighterPage,
  EmptyBlockedList,
} from "@/screens/parity/blocked-workspace";

export default function FighterGoalsRoute() {
  return (
    <BlockedFighterPage title={blocked.goalsNav} extra={blocked.goals}>
      <EmptyBlockedList />
    </BlockedFighterPage>
  );
}
