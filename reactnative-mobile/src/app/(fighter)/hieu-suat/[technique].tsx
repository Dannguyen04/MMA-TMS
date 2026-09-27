import { blocked } from "@/i18n/blocked";
import { BlockedFighterPage, EmptyBlockedList } from "@/screens/parity/blocked-workspace";

export default function FighterTechniqueRoute() {
  return (
    <BlockedFighterPage title="Kỹ thuật" extra={blocked.performance}>
      <EmptyBlockedList />
    </BlockedFighterPage>
  );
}
