import { FighterHomeScreen } from "@/screens/fighter/home-screen";
import { usePostIntroRedirect } from "@/session/role-gate";
import { useSession } from "@/session/session-context";

/**
 * Fighter home stays on `/` under the ice. Other gates replace this route
 * while the glass is still up, so shatter opens onto login or the role home.
 */
export default function Index() {
  const { gate } = useSession();
  usePostIntroRedirect();

  if (gate === "fighter") {
    return <FighterHomeScreen />;
  }
  return null;
}
