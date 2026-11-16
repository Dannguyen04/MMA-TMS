import { Redirect, useLocalSearchParams, type Href } from "expo-router";

import { adminVideosHref } from "@/screens/admin/tools/admin-paths";

/** Old video library link (step 23): now the Thư viện tab of Video, on the fighter when given. */
export default function AdminVideoLibraryLegacyRoute() {
  const { fighterId } = useLocalSearchParams<{ fighterId?: string }>();
  return <Redirect href={adminVideosHref({ seg: "library", fighterId }) as unknown as Href} />;
}
