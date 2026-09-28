import { blocked } from "@/i18n/blocked";
import { BlockedFighterPage, DisabledForm } from "@/screens/parity/blocked-workspace";

export default function FighterSettingsRoute() {
  return (
    <BlockedFighterPage title={blocked.settings} extra={blocked.notifications}>
      <DisabledForm fields={[{ label: "Kênh thông báo (email / push)" }]} />
    </BlockedFighterPage>
  );
}
