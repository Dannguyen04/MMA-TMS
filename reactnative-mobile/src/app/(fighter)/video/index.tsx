import { blocked } from "@/i18n/blocked";
import {
  BlockedFighterPage,
  BlockedLink,
  EmptyBlockedList,
} from "@/screens/parity/blocked-workspace";
import { SectionLabel } from "@/screens/fighter/screen";

export default function FighterVideosRoute() {
  return (
    <BlockedFighterPage title={blocked.videos} extra={blocked.relatedJobs}>
      <BlockedLink href={"/video/tai-len"} label={blocked.upload} />
      <BlockedLink href={"/video/truc-tiep"} label={blocked.liveCheck} />
      <BlockedLink href={"/video/xem"} label={blocked.review} />
      <SectionLabel text={blocked.videos} />
      <EmptyBlockedList />
    </BlockedFighterPage>
  );
}
