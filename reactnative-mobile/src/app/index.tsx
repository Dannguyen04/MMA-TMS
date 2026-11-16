import { FighterHomeV2 } from "@/screens/fighter/home/fighter-home-v2";
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
    // Redesign 2026-11-11: the old home (screens/fighter/home-screen.tsx) stays in the code, unused.
    return <FighterHomeV2 />;
  }
  return null;
}
